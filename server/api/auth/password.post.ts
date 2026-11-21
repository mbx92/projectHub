import { eq } from 'drizzle-orm'

/** Ganti kata sandi akun sendiri. */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const body = await readBodyWith(event, z.object({ current: z.string(), password: z.string() }))
  validatePasswordStrength(body.password)
  const db = useDB()
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, me.id))
  if (!u?.passwordHash || !(await verifyPassword(body.current, u.passwordHash))) throw createError({ statusCode: 400, statusMessage: 'Kata sandi saat ini salah.' })
  await db.update(schema.users).set({ passwordHash: await hashPassword(body.password) }).where(eq(schema.users.id, me.id))
  return { ok: true }
})
