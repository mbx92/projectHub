import { and, asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'lihat')
  const bug = await loadBugForUser(me, idParam(event))
  const db = useDB()
  const [project] = await db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, bug.projectId))
  const [assignee] = bug.assigneeId ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.id, bug.assigneeId)) : []
  const comments = await db.select({
    id: schema.bugComments.id, body: schema.bugComments.body, kind: schema.bugComments.kind, createdAt: schema.bugComments.createdAt,
    userId: schema.bugComments.userId, userName: schema.users.name, avatarColor: schema.users.avatarColor,
  }).from(schema.bugComments).leftJoin(schema.users, eq(schema.users.id, schema.bugComments.userId))
    .where(eq(schema.bugComments.bugId, bug.id)).orderBy(asc(schema.bugComments.createdAt))
  const files = await db.select().from(schema.attachments).where(and(eq(schema.attachments.entityType, 'bug'), eq(schema.attachments.entityId, bug.id)))
  // Termin yang belum lunas (untuk peringatan "menghambat termin") — hanya admin yang melihat nominal.
  const terms = can(me, 'keuangan', 'ringkasan') && bug.blocksTerm
    ? (await termsWithInvoices([bug.projectId])).filter(t => t.status !== 'lunas').map(t => ({ id: t.id, name: t.name, amount: t.amount, dueDate: t.invoice?.dueDate ?? t.dueDate }))
    : []
  // Pengguna yang bisa ditugaskan: anggota proyek + admin.
  const members = await projectMembersOf([bug.projectId])
  const admins = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(and(eq(schema.users.role, 'admin'), eq(schema.users.status, 'aktif')))
  const assignable = [...new Map([...admins, ...members.map(m => ({ id: m.userId, name: m.name }))].map(u => [u.id, u])).values()]
  return {
    bug, project, assignee: assignee ?? null, comments,
    attachments: files.map(f => ({ ...f, url: signedFileUrl(f.fileKey, f.fileName) })),
    terms, assignable,
    can: {
      editAll: can(me, 'bug', 'kelola'),
      changeStatus: can(me, 'bug', 'kelola') || (can(me, 'bug', 'ditugaskan') && bug.assigneeId === me.id),
      close: can(me, 'bug', 'kelola'),
      comment: can(me, 'bug', 'ditugaskan'),
    },
  }
})
