import { asc, desc, eq, inArray, sql } from 'drizzle-orm'

/**
 * Detail proyek, disaring sesuai matriks hak akses:
 *  - Keuangan ≥ ringkasan: termin, pengeluaran, laba, distribusi (bukti bayar & honor tetap butuh "lihat semua").
 *  - Bug ≥ lihat: daftar bug.  Tim & Dokumen ≥ lihat: anggota tim & dokumen.
 *  - Investor & Modal < lihat: rincian bagian modal hanya milik sendiri.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'lihat')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const db = useDB()
  const seeMoney = can(me, 'keuangan', 'ringkasan')
  const seeMoneyDetail = can(me, 'keuangan', 'lihat')
  const seeBugs = can(me, 'bug', 'lihat')
  const seeTeam = can(me, 'dokumen', 'lihat')

  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
  if (!p) notFound('Proyek')
  const [client] = p.clientId ? await db.select().from(schema.clients).where(eq(schema.clients.id, p.clientId)) : []
  const [pic] = p.picId ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.picId)) : []
  const [scheme] = p.schemeId ? await db.select().from(schema.profitSchemes).where(eq(schema.profitSchemes.id, p.schemeId)) : []

  const investorIds = can(me, 'proyek', 'kelola') || can(me, 'investor', 'lihat')
    ? (await db.select({ id: schema.projectInvestors.investorId }).from(schema.projectInvestors).where(eq(schema.projectInvestors.projectId, id))).map(r => r.id)
    : []
  const milestones = await db.select().from(schema.milestones).where(eq(schema.milestones.projectId, id)).orderBy(asc(schema.milestones.sortOrder))
  const members = seeTeam ? await projectMembersOf([id]) : []

  const bugRows = seeBugs
    ? await db.select({
        id: schema.bugs.id, code: schema.bugs.code, title: schema.bugs.title, module: schema.bugs.module, severity: schema.bugs.severity,
        status: schema.bugs.status, assigneeId: schema.bugs.assigneeId, assigneeName: schema.users.name, createdAt: schema.bugs.createdAt,
        blocksTerm: schema.bugs.blocksTerm, targetDate: schema.bugs.targetDate,
      }).from(schema.bugs).leftJoin(schema.users, eq(schema.users.id, schema.bugs.assigneeId))
        .where(eq(schema.bugs.projectId, id)).orderBy(desc(schema.bugs.createdAt))
    : []
  const [bugCounts] = await db.select({
    open: sql<number>`count(*) filter (where ${schema.bugs.status} <> 'selesai')::int`,
    critical: sql<number>`count(*) filter (where ${schema.bugs.status} <> 'selesai' and ${schema.bugs.severity} = 'kritis')::int`,
    done: sql<number>`count(*) filter (where ${schema.bugs.status} = 'selesai')::int`,
    blocking: sql<number>`count(*) filter (where ${schema.bugs.status} <> 'selesai' and ${schema.bugs.blocksTerm})::int`,
  }).from(schema.bugs).where(eq(schema.bugs.projectId, id))

  let finance = null
  if (seeMoney) {
    const terms = await termsWithInvoices([id])
    const expenses = await db.select({
      id: schema.expenses.id, date: schema.expenses.date, description: schema.expenses.description, category: schema.expenses.category,
      amount: schema.expenses.amount, source: schema.expenses.source, isAsset: schema.expenses.isAsset, proofUrl: schema.expenses.proofUrl,
      createdByName: schema.users.name,
    }).from(schema.expenses).leftJoin(schema.users, eq(schema.users.id, schema.expenses.createdBy))
      .where(eq(schema.expenses.projectId, id)).orderBy(desc(schema.expenses.date), desc(schema.expenses.id))
    const pnl = await projectProfitAllTime(id)
    const dists = await db.select().from(schema.distributions).where(eq(schema.distributions.projectId, id)).orderBy(desc(schema.distributions.date))
    const lines = dists.length
      ? await db.select({ id: schema.distributionLines.id, distributionId: schema.distributionLines.distributionId, part: schema.distributionLines.part, amount: schema.distributionLines.amount, basisPct: schema.distributionLines.basisPct, recipientUserId: schema.distributionLines.recipientUserId, name: schema.users.name })
          .from(schema.distributionLines).leftJoin(schema.users, eq(schema.users.id, schema.distributionLines.recipientUserId))
          .where(inArray(schema.distributionLines.distributionId, dists.map(d => d.id)))
      : []
    // Tanpa akses lihat semua Investor & Modal: bagian modal hanya milik sendiri.
    const visibleLines = !can(me, 'investor', 'lihat') ? lines.filter(l => l.part !== 'modal' || l.recipientUserId === me.id) : lines
    const invested = terms.reduce((a, t) => a + t.amount, 0)
    finance = {
      terms: terms.map(t => ({ ...t, payments: t.payments.map(x => ({ ...x, proofUrl: seeMoneyDetail ? signedFileUrl(x.proofUrl, 'bukti') : null })) })),
      expenses: expenses.map(e => ({ ...e, proofUrl: seeMoneyDetail ? signedFileUrl(e.proofUrl, 'bukti') : null })),
      pnl,
      termsTotal: invested,
      paid: terms.reduce((a, t) => a + t.paid, 0),
      distributions: dists.map(d => ({ ...d, lines: visibleLines.filter(l => l.distributionId === d.id) })),
    }
  }

  const documents = !seeTeam ? [] : (await db.select().from(schema.documents).where(eq(schema.documents.projectId, id)).orderBy(desc(schema.documents.createdAt)))
    .map(({ content, layoutSnapshot: _ls, ...d }) => ({ ...d, hasContent: content != null, fileUrl: signedFileUrl(d.fileUrl, d.name) }))

  // Aktivitas terbaru: jejak audit proyek/termin/pembayaran + komentar bug.
  const activity = await db.execute(sql`
    select * from (
      select a.created_at, u.name as user_name, a.aksi as action, a.entitas as entity, a.sesudah->>'name' as label, null::text as body
      from audit_logs a left join users u on u.id = a.user_id
      where (a.entitas = 'project' and a.entity_id = ${id})
         or (a.entitas in ('term','invoice','payment') and (a.sesudah->>'projectId')::int = ${id})
         or (a.entitas = 'expense' and ((a.sesudah->>'projectId')::int = ${id} or (a.sebelum->>'projectId')::int = ${id}))
      ${seeBugs ? sql`union all
      select c.created_at, u.name, c.jenis, 'bug', b.kode || ' · ' || b.judul, c.isi
      from bug_comments c join bugs b on b.id = c.bug_id left join users u on u.id = c.user_id
      where b.project_id = ${id}` : sql``}
    ) x order by created_at desc limit 12`)

  const visibleActivity = (activity.rows as any[]).filter(a => seeMoney || !['term', 'invoice', 'payment', 'expense'].includes(a.entity))

  return {
    project: { ...p, contractValue: seeMoney ? p.contractValue : null, budget: seeMoney ? p.budget : null },
    client: client && can(me, 'proyek', 'kelola') ? client : client ? { id: client.id, name: client.name } : null,
    pic: pic ?? null,
    investorIds,
    scheme: scheme ?? null,
    milestones,
    members: members.map(m => ({ ...m, fixedFee: seeMoneyDetail ? m.fixedFee : null })),
    bugs: bugRows,
    bugCounts,
    finance,
    documents,
    activity: visibleActivity,
    can: {
      edit: can(me, 'proyek', 'kelola'), editMoney: can(me, 'keuangan', 'kelola'), money: seeMoney, moneyDetail: seeMoneyDetail, moneyManage: can(me, 'keuangan', 'kelola'),
      bugs: seeBugs, manageBugs: can(me, 'bug', 'ditugaskan'), team: seeTeam, manageDocs: can(me, 'dokumen', 'kelola'), distribute: can(me, 'investor', 'kelola'),
      progress: can(me, 'proyek', 'kelola') || p.picId === me.id,
    },
  }
})
