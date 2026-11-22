import { and, desc, eq } from 'drizzle-orm'

/** Bug sesuai hak akses: Developer hanya melihat bug di proyek tempat ia ditugaskan. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'lihat')
  const q = getQuery(event)
  const ids = await accessibleProjectIds(me)
  const projectId = q.projectId ? Number(q.projectId) : null
  if (projectId) await assertProjectAccess(me, projectId)
  return useDB().select({
    id: schema.bugs.id, type: schema.bugs.type, code: schema.bugs.code, title: schema.bugs.title, module: schema.bugs.module, severity: schema.bugs.severity,
    status: schema.bugs.status, projectId: schema.bugs.projectId, projectName: schema.projects.name, assigneeId: schema.bugs.assigneeId,
    assigneeName: schema.users.name, assigneeColor: schema.users.avatarColor, reporter: schema.bugs.reporter, targetDate: schema.bugs.targetDate,
    blocksTerm: schema.bugs.blocksTerm, createdAt: schema.bugs.createdAt, resolvedAt: schema.bugs.resolvedAt,
  }).from(schema.bugs)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.bugs.projectId))
    .leftJoin(schema.users, eq(schema.users.id, schema.bugs.assigneeId))
    .where(and(projectScope(ids, schema.bugs.projectId), projectId ? eq(schema.bugs.projectId, projectId) : undefined, eq(schema.projects.archived, false)))
    .orderBy(desc(schema.bugs.createdAt))
})
