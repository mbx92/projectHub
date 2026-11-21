/**
 * Penyimpanan file privat. File hanya bisa diunduh lewat URL bertanda tangan (HMAC + waktu kedaluwarsa)
 * yang dibuat untuk pengguna yang berhak; aplikasi yang membaca file lalu mengirimkannya, bukan bucket.
 * Backend: bucket S3-kompatibel (MinIO) bila NUXT_S3_* diisi; bila tidak, folder lokal (NUXT_STORAGE_DIR).
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|application\/pdf|text\/plain|text\/csv|application\/zip|application\/vnd\.openxmlformats-officedocument\.[\w.]+|application\/msword|application\/vnd\.ms-excel)$/

function storageRoot() {
  return resolve(useRuntimeConfig().storageDir || './storage')
}

interface S3Ctx { client: S3Client, bucket: string }
let s3: S3Ctx | null | undefined
let bucketReady: Promise<void> | null = null

/** Klien S3 bila dikonfigurasi lengkap (endpoint, bucket, access key, secret key); selain itu null (mode folder lokal). */
function s3Ctx(): S3Ctx | null {
  if (s3 !== undefined) return s3
  const c = useRuntimeConfig()
  if (!c.s3Endpoint || !c.s3Bucket || !c.s3AccessKey || !c.s3SecretKey) return (s3 = null)
  s3 = {
    bucket: String(c.s3Bucket),
    client: new S3Client({
      endpoint: String(c.s3Endpoint),
      region: String(c.s3Region || 'us-east-1'),
      forcePathStyle: true, // MinIO: bucket di path, bukan subdomain
      credentials: { accessKeyId: String(c.s3AccessKey), secretAccessKey: String(c.s3SecretKey) },
    }),
  }
  return s3
}

/** Pastikan bucket ada (dibuat bila belum ada dan kredensial mengizinkan). */
function ensureBucket(ctx: S3Ctx) {
  bucketReady ??= ctx.client.send(new HeadBucketCommand({ Bucket: ctx.bucket })).then(() => undefined).catch(async () => {
    await ctx.client.send(new CreateBucketCommand({ Bucket: ctx.bucket })).catch(() => { /* tanpa izin buat bucket: biarkan operasi berikutnya yang gagal bila memang tidak ada */ })
  })
  return bucketReady
}

export const storageBackend = () => (s3Ctx() ? 's3' : 'lokal') as 's3' | 'lokal'

function safeKey(key: string) {
  if (!/^[\w-]+\/[\w.-]+$/.test(key) || key.includes('..')) throw createError({ statusCode: 400, statusMessage: 'Kunci file tidak valid.' })
  return key
}

export async function saveFile(folder: string, filename: string, data: Buffer, mime?: string) {
  if (data.length > MAX_SIZE) throw createError({ statusCode: 413, statusMessage: 'Ukuran file maksimal 10 MB.' })
  if (mime && !ALLOWED.test(mime)) throw createError({ statusCode: 415, statusMessage: 'Jenis file tidak didukung.' })
  const ext = extname(filename).toLowerCase().replace(/[^.\w]/g, '').slice(0, 8)
  const key = `${folder.replace(/[^\w-]/g, '')}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
  const ctx = s3Ctx()
  if (ctx) {
    await ensureBucket(ctx)
    await ctx.client.send(new PutObjectCommand({ Bucket: ctx.bucket, Key: key, Body: data, ContentType: mime || MIME_BY_EXT[ext] || 'application/octet-stream' }))
    return key
  }
  const full = join(storageRoot(), key)
  await mkdir(join(storageRoot(), key.split('/')[0]!), { recursive: true })
  await writeFile(full, data)
  return key
}

export async function readStoredFile(key: string) {
  const ctx = s3Ctx()
  if (ctx) {
    try {
      const res = await ctx.client.send(new GetObjectCommand({ Bucket: ctx.bucket, Key: safeKey(key) }))
      return Buffer.from(await res.Body!.transformToByteArray())
    } catch (e) {
      // Masa peralihan: file lama yang belum dipindah ke bucket masih dibaca dari folder lokal.
      try { return await readFile(join(storageRoot(), safeKey(key))) } catch { throw e }
    }
  }
  return readFile(join(storageRoot(), safeKey(key)))
}

export async function deleteStoredFile(key: string | null | undefined) {
  if (!key) return
  const ctx = s3Ctx()
  if (ctx) await ctx.client.send(new DeleteObjectCommand({ Bucket: ctx.bucket, Key: safeKey(key) })).catch((e: Error) => console.error(`[files] gagal menghapus ${key} dari bucket: ${e.message}`))
  try { await unlink(join(storageRoot(), safeKey(key))) } catch { /* sudah tidak ada */ }
}

function sign(key: string, exp: number) {
  return createHmac('sha256', useRuntimeConfig().fileSecret || 'dev-file-secret').update(`${key}:${exp}`).digest('base64url')
}

/** URL bertanda tangan, berlaku `ttlSec` detik (default 15 menit). */
export function signedFileUrl(key: string | null | undefined, name?: string, ttlSec = 900): string | null {
  if (!key) return null
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const q = new URLSearchParams({ k: key, e: String(exp), s: sign(key, exp) })
  if (name) q.set('n', name)
  return `/api/files/download?${q.toString()}`
}

export function verifySignature(key: string, exp: number, sig: string) {
  if (!key || !exp || !sig || exp < Date.now() / 1000) return false
  const a = Buffer.from(sign(key, exp))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
