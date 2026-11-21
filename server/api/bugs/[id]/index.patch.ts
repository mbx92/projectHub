import { eq } from 'drizzle-orm'

/**
 * Ubah bug. Admin: semua kolom. Developer: hanya bug yang ditugaskan kepadanya, status sampai Review
 * (Review → Selesai dilakukan Admin).
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'ditugaskan')
  const bug = await loadBugForUser(me, idParam(event))
  const body = await readBodyWith(event, z.object({
    status: z.enum(['open', 'dikerjakan', 'review', 'selesai']).optional(),
    assigneeId: zId.nullable().optional(),
    severity: z.enum(['kritis', 'tinggi', 'sedang', 'rendah']).optional(),
    targetDate: zDate.nullable().optional(),
    blocksTerm: z.boolean().optional(),
    title: z.string().trim().min(3).max(200).optional(),
    description: zOptText(5000).optional(),
    steps: zOptText(5000).optional(),
    expected: zOptText(2000).optional(),
    actual: zOptText(2000).optional(),
    module: zOptText(80).optional(),
  }))
  const isAdmin = can(me, 'bug', 'kelola')
  if (!isAdmin) {
    if (bug.assigneeId !== me.id) throw createError({ statusCode: 403, statusMessage: 'Anda hanya bisa mengubah bug yang ditugaskan kepada Anda.' })
    const allowed = ['status']
    const extra = Object.keys(body).filter(k => !allowed.includes(k))
    if (extra.length) throw createError({ statusCode: 403, statusMessage: 'Anda hanya bisa mengubah status bug yang ditugaskan.' })
    if (body.status === 'selesai') throw createError({ statusCode: 403, statusMessage: 'Pindahkan ke Review; pengelola bug yang menandai Selesai.' })
  }
  if (body.assigneeId) {
    const members = await projectMembersOf([bug.projectId])
    const [u] = await useDB().select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, body.assigneeId))
    if (!u || (u.role !== 'admin' && !members.some(m => m.userId === body.assigneeId))) {
      throw createError({ statusCode: 422, statusMessage: 'Penanggung jawab harus anggota tim proyek.' })
    }
  }

  const db = useDB()
  const names = new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users)).map(u => [u.id, u.name]))
  await db.transaction(async (tx) => {
    const patch: Partial<typeof schema.bugs.$inferInsert> = { ...body }
    if (body.status === 'selesai' && bug.status !== 'selesai') patch.resolvedAt = new Date()
    if (body.status && body.status !== 'selesai') patch.resolvedAt = null
    await tx.update(schema.bugs).set(patch).where(eq(schema.bugs.id, bug.id))
    if (body.status && body.status !== bug.status) await bugActivity(tx, bug.id, me.id, `memindahkan status ${STATUS_TEXT[bug.status]} → ${STATUS_TEXT[body.status]}`)
    if (body.assigneeId !== undefined && body.assigneeId !== bug.assigneeId) await bugActivity(tx, bug.id, me.id, body.assigneeId ? `menugaskan ke ${names.get(body.assigneeId)}` : 'menghapus penanggung jawab')
    if (body.severity && body.severity !== bug.severity) await bugActivity(tx, bug.id, me.id, `mengubah keparahan menjadi ${BUG_SEVERITY[body.severity].label}`)
    if (body.blocksTerm !== undefined && body.blocksTerm !== bug.blocksTerm) await bugActivity(tx, bug.id, me.id, body.blocksTerm ? 'menandai bug menghambat termin' : 'menghapus tanda menghambat termin')
    if (body.targetDate !== undefined && body.targetDate !== bug.targetDate) await bugActivity(tx, bug.id, me.id, `mengubah target selesai menjadi ${dateId(body.targetDate)}`)
  })

  const link = `/bugs/${bug.id}`
  if (body.assigneeId && body.assigneeId !== bug.assigneeId) {
    await notifyUsers([body.assigneeId], { type: 'bug_ditugaskan', title: `${bug.code} ditugaskan ke Anda`, body: bug.title, link }, me.id)
  } else if (body.status && body.status !== bug.status) {
    await notifyUsers([bug.assigneeId], { type: 'bug_ditugaskan', title: `${bug.code} dipindah ke ${STATUS_TEXT[body.status]}`, body: bug.title, link }, me.id)
  }
  if (body.status === 'review' && bug.status !== 'review') {
    await notifyUsers(await adminIds(), { type: 'bug_ditugaskan', title: `${bug.code} siap direview`, body: bug.title, link }, me.id)
  }
  if (body.status === 'selesai' && bug.status !== 'selesai') {
    await notifyUsers([bug.reporterUserId], { type: 'komentar_bug', title: `${bug.code} sudah selesai`, body: bug.title, link }, me.id)
  }
  if (body.severity === 'kritis' && bug.severity !== 'kritis') {
    await notifyUsers(await adminIds(), { type: 'bug_kritis', title: `Bug kritis ${bug.code}: ${bug.title}`, link }, me.id)
  }
  return { ok: true }
})
