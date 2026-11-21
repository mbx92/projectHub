import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAdmin(event)
  const id = idParam(event)
  const [u] = await useDB().select().from(schema.users).where(eq(schema.users.id, id))
  if (!u) notFound('Pengguna')
  if (u.status !== 'diundang') throw createError({ statusCode: 400, statusMessage: 'Pengguna sudah aktif.' })
  const inviteUrl = await sendInvite(u, me)
  return { ok: true, inviteUrl: import.meta.dev ? inviteUrl : undefined }
})
