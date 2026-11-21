import { and, desc, eq, sql } from 'drizzle-orm'

/** Daftar invoice (Admin) + termin yang belum punya invoice, untuk tab "Invoice & Termin". */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const db = useDB()
  const ids = await accessibleProjectIds(me)
  const today = todayISO()
  const invoices = await db.select({
    id: schema.invoices.id, number: schema.invoices.number, projectId: schema.invoices.projectId, projectName: schema.projects.name,
    termId: schema.invoices.termId, termName: schema.terms.name, total: schema.invoices.total, issueDate: schema.invoices.issueDate,
    dueDate: schema.invoices.dueDate, status: schema.invoices.status, clientName: schema.clients.name,
    paid: sql<number>`coalesce((select sum(nominal) from payments where invoice_id = ${schema.invoices.id}), 0)::bigint`,
  }).from(schema.invoices)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.invoices.projectId))
    .leftJoin(schema.clients, eq(schema.clients.id, schema.projects.clientId))
    .leftJoin(schema.terms, eq(schema.terms.id, schema.invoices.termId))
    .where(projectScope(ids, schema.invoices.projectId))
    .orderBy(desc(schema.invoices.issueDate), desc(schema.invoices.id))

  const unbilled = await db.select({
    termId: schema.terms.id, termName: schema.terms.name, projectId: schema.projects.id, projectName: schema.projects.name,
    amount: schema.terms.amount, dueDate: schema.terms.dueDate, percent: schema.terms.percent,
  }).from(schema.terms).innerJoin(schema.projects, eq(schema.projects.id, schema.terms.projectId))
    .where(and(sql`${schema.terms.status} = 'terjadwal' and not ${schema.projects.archived}`, projectScope(ids, schema.terms.projectId)))
    .orderBy(schema.terms.dueDate)

  return {
    invoices: invoices.map(i => ({ ...i, paid: Number(i.paid), displayStatus: i.status === 'terkirim' && i.dueDate < today ? 'terlambat' : i.status })),
    unbilled,
  }
})
