import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBodyWith(event, z.object({
    email: z.string().trim().toLowerCase().email('email tidak valid'),
    password: z.string().min(1, 'wajib diisi'),
    remember: z.boolean().optional().default(false),
  }))
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  rateLimit(`login:ip:${ip}`, 20, 15 * 60_000)
  rateLimit(`login:email:${body.email}`, 5, 15 * 60_000)

  const db = useDB()
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
  const ok = !!user?.passwordHash && await verifyPassword(body.password, user.passwordHash)
  if (!user || !ok) throw createError({ statusCode: 401, statusMessage: 'Email atau kata sandi salah.' })
  if (user.status !== 'aktif') throw createError({ statusCode: 403, statusMessage: 'Akun belum aktif atau dinonaktifkan. Hubungi admin OCN.' })

  resetRateLimit(`login:email:${body.email}`)
  await createSession(event, user.id, body.remember)
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id))
  return { role: user.role, redirect: await homeFor(user.role) }
})
