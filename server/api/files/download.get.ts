import { extname } from 'node:path'

/** Unduh file privat lewat URL bertanda tangan (k = kunci, e = kedaluwarsa, s = tanda tangan). */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const key = String(q.k || '')
  if (!verifySignature(key, Number(q.e), String(q.s || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Tautan file tidak valid atau sudah kedaluwarsa.' })
  }
  let data: Buffer
  try { data = await readStoredFile(key) }
  catch { throw createError({ statusCode: 404, statusMessage: 'File tidak ditemukan.' }) }
  const ext = extname(key).toLowerCase()
  const name = String(q.n || key.split('/').pop())
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
  setResponseHeaders(event, {
    'Content-Type': mime,
    'Content-Disposition': `${mime.startsWith('image/') || mime === 'application/pdf' ? 'inline' : 'attachment'}; filename="${encodeURIComponent(name)}"`,
    'Cache-Control': 'private, max-age=600',
    'X-Content-Type-Options': 'nosniff',
    ...(ext === '.svg' ? { 'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'' } : {}),
  })
  return data
})
