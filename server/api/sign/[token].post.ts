import { and, eq, gt } from 'drizzle-orm'

/** Klien menandatangani: nama, persetujuan, dan gambar tanda tangan (PNG data URL). Hanya sekali. */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  rateLimit(`sign:post:${ip}`, 10, 15 * 60_000)
  const token = String(getRouterParam(event, 'token') || '')
  if (!/^[\w-]{10,64}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak valid.' })
  const body = await readBodyWith(event, z.object({
    name: z.string().trim().min(2, 'nama minimal 2 karakter').max(160),
    consent: z.literal(true, { error: 'centang pernyataan persetujuan' }),
    signature: z.string().max(600_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'tanda tangan tidak valid'),
  }))
  const png = Buffer.from(body.signature.split(',')[1]!, 'base64')
  if (png.length < 100 || png.length > 400_000 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw createError({ statusCode: 422, statusMessage: 'Tanda tangan tidak valid.' })
  }
  const db = useDB()
  const [r] = await db.select().from(schema.signatureRequests).where(eq(schema.signatureRequests.token, token))
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak ditemukan.' })
  if (signatureStatus(r) !== 'menunggu') throw createError({ statusCode: 409, statusMessage: 'Permintaan ini sudah tidak aktif (sudah ditandatangani, dibatalkan, atau kedaluwarsa).' })

  const key = await saveFile('tanda-tangan', 'ttd.png', png, 'image/png')
  // Penanda satu kali pakai: hanya satu permintaan serentak yang lolos.
  const done = await db.update(schema.signatureRequests).set({
    status: 'ditandatangani', signedAt: new Date(), signerName: body.name, signatureKey: key,
    signerIp: ip.slice(0, 64), signerAgent: (getHeader(event, 'user-agent') ?? '').slice(0, 300), contentHash: signatureContentHash(r.title, r.body),
  }).where(and(eq(schema.signatureRequests.id, r.id), eq(schema.signatureRequests.status, 'menunggu'), gt(schema.signatureRequests.expiresAt, new Date())))
    .returning({ id: schema.signatureRequests.id })
  if (!done.length) {
    await deleteStoredFile(key)
    throw createError({ statusCode: 409, statusMessage: 'Permintaan ini sudah tidak aktif.' })
  }
  await logAudit(db, null, 'ubah', 'signature_request', r.id, { status: 'menunggu' }, { status: 'ditandatangani', signerName: body.name })

  const [project] = await db.select({ name: schema.projects.name, picId: schema.projects.picId }).from(schema.projects).where(eq(schema.projects.id, r.projectId))
  await notifyUsers([...(await adminIds()), project?.picId], {
    type: 'persetujuan_klien', title: `${body.name} menandatangani: ${r.title}`, body: `Proyek ${project?.name ?? ''}`, link: `/projects/${r.projectId}?tab=dokumen`,
  })
  return { ok: true }
})
