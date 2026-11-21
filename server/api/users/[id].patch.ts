import { and, eq, ne, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAdmin(event)
  const id = idParam(event)
  const body = await readBodyWith(event, z.object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(['admin', 'investor', 'developer']).optional(),
    status: z.enum(['aktif', 'nonaktif']).optional(),
    title: zOptText(80).optional(),
    phone: zOptText(40).optional(),
  }))
  const db = useDB()
  const [before] = await db.select().from(schema.users).where(eq(schema.users.id, id))
  if (!before) notFound('Pengguna')
  if (id === me.id && ((body.role && body.role !== 'admin') || body.status === 'nonaktif')) {
    throw createError({ statusCode: 400, statusMessage: 'Anda tidak bisa menurunkan peran atau menonaktifkan akun sendiri.' })
  }
  // Pengguna yang belum menerima undangan tidak bisa langsung diaktifkan oleh admin.
  if (body.status === 'aktif' && before.status === 'diundang') delete body.status
  const [after] = await db.update(schema.users).set(body).where(eq(schema.users.id, id)).returning()
  if (body.status === 'nonaktif') await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  if (body.role === 'investor') {
    await db.insert(schema.investors).values({ userId: id, status: 'calon', createdBy: me.id }).onConflictDoNothing()
  }
  const [row] = await db.select({ value: count() }).from(schema.users).where(and(eq(schema.users.role, 'admin'), ne(schema.users.status, 'nonaktif')))
  if (!row?.value) throw createError({ statusCode: 400, statusMessage: 'Minimal harus ada satu admin aktif.' })
  await logAudit(db, me.id, 'ubah', 'user', id, { role: before.role, status: before.status }, { role: after!.role, status: after!.status })
  return { ok: true }
})
