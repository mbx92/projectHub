import { and, eq, inArray, ne } from 'drizzle-orm'

/**
 * Keluarkan anggota dari tim proyek. Bug yang belum selesai dan ditugaskan kepadanya dilepas
 * (ia tidak lagi punya akses ke proyek), dan ia tidak boleh masih menjadi penanggung jawab proyek.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const userId = idParam(event, 'userId')
  const db = useDB()
  const [member] = await db.select().from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
  if (!member) notFound('Anggota tim')
  const [project] = await db.select({ picId: schema.projects.picId, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId))
  if (project?.picId === userId) {
    throw createError({ statusCode: 422, statusMessage: 'Anggota ini penanggung jawab proyek. Ganti penanggung jawab dulu di Edit Proyek.' })
  }

  const released = await db.transaction(async (tx) => {
    const bugs = await tx.select({ id: schema.bugs.id }).from(schema.bugs)
      .where(and(eq(schema.bugs.projectId, projectId), eq(schema.bugs.assigneeId, userId), ne(schema.bugs.status, 'selesai')))
    if (bugs.length) {
      await tx.update(schema.bugs).set({ assigneeId: null }).where(inArray(schema.bugs.id, bugs.map(b => b.id)))
      for (const b of bugs) await bugActivity(tx, b.id, me.id, 'melepas penanggung jawab (anggota dikeluarkan dari tim)')
    }
    await tx.delete(schema.projectMembers)
      .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)))
    await logAudit(tx, me.id, 'hapus', 'project_member', projectId, member, null)
    return bugs.length
  })
  await notifyUsers([userId], { type: 'status_proyek', title: `Anda dikeluarkan dari proyek ${project?.name}`, link: '/', email: false }, me.id)
  return { ok: true, releasedBugs: released }
})
