import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBodyWith(event, z.object({ token: z.string().min(10), password: z.string() }))
  validatePasswordStrength(body.password)
  const tok = await findValidToken(body.token, 'reset')
  if (!tok) throw createError({ statusCode: 400, statusMessage: 'Tautan tidak valid atau sudah kedaluwarsa.' })
  const db = useDB()
  await db.update(schema.users).set({ passwordHash: await hashPassword(body.password) }).where(eq(schema.users.id, tok.userId))
  await db.update(schema.userTokens).set({ usedAt: new Date() }).where(eq(schema.userTokens.id, tok.id))
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, tok.userId))
  return { ok: true }
})
