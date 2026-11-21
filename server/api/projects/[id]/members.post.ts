import { and, eq } from 'drizzle-orm'

/**
 * Tambah satu anggota tim ke proyek dari halaman detail (tanpa membuka form edit).
 * Honor tetap hanya bisa diisi oleh pengguna dengan akses kelola Keuangan.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const body = await readBodyWith(event, z.object({
    userId: zId,
    roleInProject: zOptText(80),
    payType: z.enum(['bagi_hasil', 'tetap']).default('bagi_hasil'),
    fixedFee: zMoney.default(0),
    shareWeight: z.coerce.number().int().min(0).max(100).default(1),
  }))
  const db = useDB()
  const [project] = await db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) notFound('Proyek')
  const [u] = await db.select({ role: schema.users.role, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, body.userId))
  if (!u || u.status === 'nonaktif') throw createError({ statusCode: 422, statusMessage: 'Pengguna tidak ditemukan atau nonaktif.' })
  if (u.role === 'investor') throw createError({ statusCode: 422, statusMessage: 'Investor tidak bisa menjadi anggota tim proyek.' })
  const [dup] = await db.select({ userId: schema.projectMembers.userId }).from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, body.userId)))
  if (dup) throw createError({ statusCode: 422, statusMessage: 'Pengguna sudah menjadi anggota tim proyek ini.' })

  const money = can(me, 'keuangan', 'kelola')
  await db.insert(schema.projectMembers).values({
    projectId, userId: body.userId, roleInProject: body.roleInProject,
    payType: money ? body.payType : 'bagi_hasil', fixedFee: money && body.payType === 'tetap' ? body.fixedFee : 0,
    shareWeight: body.shareWeight, createdBy: me.id,
  })
  await notifyUsers([body.userId], { type: 'bug_ditugaskan', title: `Anda ditambahkan ke proyek ${project.name}`, body: 'Anda sekarang bisa melihat proyek dan bug yang ditugaskan.', link: `/projects/${projectId}`, email: false }, me.id)
  return { ok: true }
})
