import { and, ilike, or, eq } from 'drizzle-orm'

/** Pencarian global (Ctrl K): proyek, invoice, bug — dibatasi sesuai hak akses. */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const q = String(getQuery(event).q || '').trim()
  if (q.length < 2) return { projects: [], invoices: [], bugs: [] }
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`
  const ids = await accessibleProjectIds(me)
  const db = useDB()

  const projects = await db.select({ id: schema.projects.id, name: schema.projects.name, client: schema.clients.name, status: schema.projects.status })
    .from(schema.projects).leftJoin(schema.clients, eq(schema.clients.id, schema.projects.clientId))
    .where(and(projectScope(ids, schema.projects.id), or(ilike(schema.projects.name, like), ilike(schema.clients.name, like))))
    .limit(6)

  const invoices = !can(me, 'keuangan', 'lihat') ? [] : await db.select({ id: schema.invoices.id, number: schema.invoices.number, total: schema.invoices.total, project: schema.projects.name, status: schema.invoices.status })
    .from(schema.invoices).innerJoin(schema.projects, eq(schema.projects.id, schema.invoices.projectId))
    .where(and(projectScope(ids, schema.invoices.projectId), or(ilike(schema.invoices.number, like), ilike(schema.projects.name, like))))
    .limit(6)

  const bugs = !can(me, 'bug', 'lihat') ? [] : await db.select({ id: schema.bugs.id, code: schema.bugs.code, title: schema.bugs.title, project: schema.projects.name, status: schema.bugs.status })
    .from(schema.bugs).innerJoin(schema.projects, eq(schema.projects.id, schema.bugs.projectId))
    .where(and(projectScope(ids, schema.bugs.projectId), or(ilike(schema.bugs.code, like), ilike(schema.bugs.title, like))))
    .limit(6)

  return { projects: can(me, 'proyek', 'lihat') ? projects : [], invoices, bugs }
})
