import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBodyWith(event, z.object({ token: z.string().min(10), name: z.string().trim().min(2).max(120), password: z.string() }))
  validatePasswordStrength(body.password)
  const tok = await findValidToken(body.token, 'undangan')
  if (!tok) throw createError({ statusCode: 400, statusMessage: 'Undangan tidak valid atau sudah kedaluwarsa.' })
  const db = useDB()
  const [user] = await db.update(schema.users)
    .set({ name: body.name, passwordHash: await hashPassword(body.password), status: 'aktif' })
    .where(eq(schema.users.id, tok.userId)).returning()
  await db.update(schema.userTokens).set({ usedAt: new Date() }).where(eq(schema.userTokens.id, tok.id))
  await createSession(event, user!.id, false)
  return { role: user!.role, redirect: await homeFor(user!.role) }
})
