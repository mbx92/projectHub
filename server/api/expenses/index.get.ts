import { and, desc, eq, gte, lte } from 'drizzle-orm'

/** Pengeluaran semua proyek (Admin & Investor untuk proyek yang didanai). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const q = getQuery(event)
  const period = parsePeriod(q)
  const ids = await accessibleProjectIds(me)
  const db = useDB()
  const rows = await db.select({
    id: schema.expenses.id, projectId: schema.expenses.projectId, projectName: schema.projects.name, date: schema.expenses.date,
    description: schema.expenses.description, category: schema.expenses.category, amount: schema.expenses.amount, source: schema.expenses.source,
    isAsset: schema.expenses.isAsset, proofUrl: schema.expenses.proofUrl, createdByName: schema.users.name,
  }).from(schema.expenses)
    .leftJoin(schema.projects, eq(schema.projects.id, schema.expenses.projectId))
    .leftJoin(schema.users, eq(schema.users.id, schema.expenses.createdBy))
    .where(and(
      ids === null ? undefined : projectScope(ids, schema.expenses.projectId),
      q.projectId ? eq(schema.expenses.projectId, Number(q.projectId)) : undefined,
      period.from ? gte(schema.expenses.date, period.from) : undefined,
      period.to ? lte(schema.expenses.date, period.to) : undefined,
    ))
    .orderBy(desc(schema.expenses.date), desc(schema.expenses.id))
  return rows.map(r => ({ ...r, proofUrl: signedFileUrl(r.proofUrl, 'bukti') }))
})
