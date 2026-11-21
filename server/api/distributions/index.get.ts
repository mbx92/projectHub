import { desc, eq, inArray } from 'drizzle-orm'

/** Riwayat distribusi. Investor hanya melihat distribusi proyek yang didanai, dengan bagian miliknya. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'sendiri')
  const ids = await accessibleProjectIds(me)
  const db = useDB()
  const dists = await db.select({
    id: schema.distributions.id, projectId: schema.distributions.projectId, projectName: schema.projects.name, date: schema.distributions.date,
    netProfit: schema.distributions.netProfit, snapshot: schema.distributions.schemeSnapshot, notes: schema.distributions.notes,
  }).from(schema.distributions).innerJoin(schema.projects, eq(schema.projects.id, schema.distributions.projectId))
    .where(projectScope(ids, schema.distributions.projectId))
    .orderBy(desc(schema.distributions.date), desc(schema.distributions.id))
  const lines = dists.length
    ? await db.select({ distributionId: schema.distributionLines.distributionId, part: schema.distributionLines.part, amount: schema.distributionLines.amount, basisPct: schema.distributionLines.basisPct, recipientUserId: schema.distributionLines.recipientUserId, name: schema.users.name })
        .from(schema.distributionLines).leftJoin(schema.users, eq(schema.users.id, schema.distributionLines.recipientUserId))
        .where(inArray(schema.distributionLines.distributionId, dists.map(d => d.id)))
    : []
  return dists.map((d) => {
    const all = lines.filter(l => l.distributionId === d.id)
    const totals = { modal: 0, pekerja: 0, kas: 0 }
    for (const l of all) totals[l.part] += l.amount
    const seeAll = can(me, 'investor', 'lihat')
    const visible = seeAll ? all : all.filter(l => l.recipientUserId === me.id)
    // Snapshot rinci (nama penerima lain) hanya untuk yang boleh melihat semua data investor.
    const snapshot = seeAll ? d.snapshot : { ...d.snapshot, capitalShares: d.snapshot.capitalShares.filter(c => c.userId === me.id), workerShares: [] }
    return { ...d, snapshot, totals, lines: visible, myShare: all.filter(l => l.recipientUserId === me.id).reduce((a, l) => a + l.amount, 0) }
  })
})
