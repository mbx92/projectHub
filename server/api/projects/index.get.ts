import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'

/** Daftar proyek sesuai hak akses + ringkasan & termin jatuh tempo (panel kanan). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'lihat')
  const q = getQuery(event)
  const archived = q.archived === '1'
  const search = String(q.q || '').trim()
  const ids = await accessibleProjectIds(me)
  const db = useDB()
  const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`

  const rows = await db.select({
    id: schema.projects.id, name: schema.projects.name, status: schema.projects.status, progress: schema.projects.progress,
    contractValue: schema.projects.contractValue, targetDate: schema.projects.targetDate, startDate: schema.projects.startDate,
    archived: schema.projects.archived, clientName: schema.clients.name, capitalPct: schema.projects.capitalPct,
    updatedAt: schema.projects.updatedAt,
  }).from(schema.projects)
    .leftJoin(schema.clients, eq(schema.clients.id, schema.projects.clientId))
    .where(and(
      projectScope(ids, schema.projects.id),
      eq(schema.projects.archived, archived),
      search ? or(ilike(schema.projects.name, like), ilike(schema.clients.name, like)) : undefined,
    ))
    .orderBy(asc(schema.projects.status), desc(schema.projects.updatedAt))

  const pids = rows.map(r => r.id)
  const showMoney = can(me, 'keuangan', 'ringkasan')
  const showBugs = can(me, 'bug', 'lihat')
  const [members, totals, terms] = await Promise.all([
    projectMembersOf(pids),
    projectPaymentTotals(pids.length ? pids : []),
    showMoney ? termsWithInvoices(pids) : Promise.resolve([]),
  ])

  const list = rows.map((r) => {
    const t = totals.get(r.id)
    return {
      ...r,
      contractValue: showMoney ? r.contractValue : null,
      paid: showMoney ? (t?.paid ?? 0) : null,
      openBugs: !showBugs ? null : (t?.openBugs ?? 0),
      criticalBugs: !showBugs ? null : (t?.criticalBugs ?? 0),
      team: members.filter(m => m.projectId === r.id).map(m => ({ id: m.userId, name: m.name, avatarColor: m.avatarColor })),
    }
  })

  const today = todayISO()
  const soon = addDays(today, 14)
  const dues = terms
    .filter(t => t.status !== 'lunas' && (t.invoice?.dueDate ?? t.dueDate))
    .map((t) => {
      const due = (t.invoice?.dueDate ?? t.dueDate)!
      return { termId: t.id, projectId: t.projectId, project: rows.find(r => r.id === t.projectId)?.name ?? '', term: t.name, amount: t.amount - t.paid, dueDate: due, status: t.displayStatus, invoiceId: t.invoice?.id ?? null }
    })
    .filter(d => d.dueDate <= addDays(today, 30))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const active = list.filter(p => p.status === 'berjalan' || p.status === 'persiapan')
  const rec = showMoney ? await receivables(ids) : []
  return {
    projects: list,
    summary: {
      running: active.length,
      total: list.length,
      receivables: showMoney ? rec.reduce((a, r) => a + r.outstanding, 0) : null,
      dueSoon: dues.filter(d => d.dueDate <= soon).length,
      criticalBugs: !showBugs ? null : list.reduce((a, p) => a + (p.criticalBugs ?? 0), 0),
    },
    dues: dues.slice(0, 8),
  }
})
