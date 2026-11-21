import { eq } from 'drizzle-orm'

/** Info undangan untuk halaman terima undangan. */
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token || '')
  const tok = token ? await findValidToken(token, 'undangan') : null
  if (!tok) throw createError({ statusCode: 400, statusMessage: 'Undangan tidak valid atau sudah kedaluwarsa (berlaku 7 hari).' })
  const [u] = await useDB().select({ name: schema.users.name, email: schema.users.email, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, tok.userId))
  if (!u) throw createError({ statusCode: 404, statusMessage: 'Pengguna tidak ditemukan.' })
  return { ...u, expiresAt: tok.expiresAt }
})
