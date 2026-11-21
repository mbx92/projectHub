import { and, eq, isNull } from 'drizzle-orm'

/**
 * Admin mengatur kata sandi baru untuk pengguna lain (mis. lupa sandi tanpa email).
 * Pengguna yang masih "diundang" langsung aktif dan undangannya ditutup.
 * Opsional: keluarkan pengguna dari semua sesi yang sedang login.
 */
export default defineEventHandler(async (event) => {
  const me = requireAdmin(event)
  const id = idParam(event)
  if (id === me.id) throw createError({ statusCode: 400, statusMessage: 'Ubah kata sandi Anda sendiri lewat menu Akun & notifikasi.' })
  const body = await readBodyWith(event, z.object({ password: z.string(), logoutAll: z.boolean().default(true) }))
  validatePasswordStrength(body.password)
  const db = useDB()
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id))
  if (!u) notFound('Pengguna')
  await db.update(schema.users)
    .set({ passwordHash: await hashPassword(body.password), ...(u.status === 'diundang' ? { status: 'aktif' as const } : {}) })
    .where(eq(schema.users.id, id))
  if (u.status === 'diundang') {
    await db.update(schema.userTokens).set({ usedAt: new Date() })
      .where(and(eq(schema.userTokens.userId, id), eq(schema.userTokens.type, 'undangan'), isNull(schema.userTokens.usedAt)))
  }
  if (body.logoutAll) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  await logAudit(db, me.id, 'ubah_sandi', 'user', id, { status: u.status }, { status: u.status === 'diundang' ? 'aktif' : u.status, logoutAll: body.logoutAll })
  return { ok: true, activated: u.status === 'diundang' }
})
