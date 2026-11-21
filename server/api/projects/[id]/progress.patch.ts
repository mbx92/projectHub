import { eq } from 'drizzle-orm'

/** Ubah progress / status milestone dari halaman detail (Admin & PJ proyek). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'lihat')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const body = await readBodyWith(event, z.object({
    progress: z.coerce.number().int().min(0).max(100).optional(),
    milestone: z.object({ id: zId, status: z.enum(['belum', 'berjalan', 'selesai']) }).optional(),
  }))
  const db = useDB()
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
  if (!p) notFound('Proyek')
  if (!can(me, 'proyek', 'kelola') && p.picId !== me.id) throw createError({ statusCode: 403, statusMessage: 'Hanya pengelola proyek atau penanggung jawab proyek.' })
  if (body.progress !== undefined) await db.update(schema.projects).set({ progress: body.progress }).where(eq(schema.projects.id, id))
  if (body.milestone) {
    const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, body.milestone.id))
    if (!m || m.projectId !== id) notFound('Milestone')
    await db.update(schema.milestones).set({ status: body.milestone.status }).where(eq(schema.milestones.id, m.id))
  }
  return { ok: true }
})
