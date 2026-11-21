import { eq } from 'drizzle-orm'

/** Halaman publik klien: isi permintaan (tanpa login, lewat token acak di tautan). */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  rateLimit(`sign:get:${ip}`, 60, 15 * 60_000)
  const token = String(getRouterParam(event, 'token') || '')
  if (!/^[\w-]{10,64}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid.' })
  const db = useDB()
  const [r] = await db.select().from(schema.signatureRequests).where(eq(schema.signatureRequests.token, token))
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak ditemukan.' })
  const [project] = await db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, r.projectId))
  const business = await getSetting('business')
  const status = signatureStatus(r)
  return {
    status,
    title: r.title,
    body: status === 'dibatalkan' ? '' : r.body,
    projectName: project?.name ?? '',
    businessName: business.name,
    expiresAt: r.expiresAt,
    signedAt: r.signedAt,
    signerName: r.signerName,
  }
})
