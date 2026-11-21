/**
 * Pindahkan file upload dari folder lokal (NUXT_STORAGE_DIR) ke bucket MinIO/S3.
 * Aman diulang: file yang sudah ada di bucket dilewati, dan file lokal TIDAK dihapus.
 *
 *   npm run files:to-s3             # unggah
 *   npm run files:to-s3 -- --dry    # hanya tampilkan yang akan diunggah
 *
 * Di container Coolify: `npx tsx server/database/upload-files-to-s3.ts` (membaca NUXT_S3_* dan NUXT_STORAGE_DIR).
 */
import 'dotenv/config'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3'

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const env = process.env
const endpoint = env.NUXT_S3_ENDPOINT
const bucket = env.NUXT_S3_BUCKET
if (!endpoint || !bucket || !env.NUXT_S3_ACCESS_KEY || !env.NUXT_S3_SECRET_KEY) {
  console.error('NUXT_S3_ENDPOINT, NUXT_S3_BUCKET, NUXT_S3_ACCESS_KEY, dan NUXT_S3_SECRET_KEY harus diisi.')
  process.exit(1)
}
const dry = process.argv.includes('--dry')
const root = resolve(env.NUXT_STORAGE_DIR || './storage')
const client = new S3Client({
  endpoint, region: env.NUXT_S3_REGION || 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: env.NUXT_S3_ACCESS_KEY, secretAccessKey: env.NUXT_S3_SECRET_KEY },
})

async function exists(key: string) {
  try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true } catch { return false }
}

async function main() {
  console.log(`[files] sumber ${root} → ${endpoint}/${bucket}${dry ? ' (dry run)' : ''}`)
  if (!dry) {
    await client.send(new HeadBucketCommand({ Bucket: bucket })).catch(async () => { await client.send(new CreateBucketCommand({ Bucket: bucket })) })
  }
  let up = 0, skipped = 0, failed = 0
  let folders: string[] = []
  try { folders = await readdir(root) } catch { console.error(`Folder ${root} tidak ditemukan.`); process.exit(1) }
  for (const folder of folders) {
    const dir = join(root, folder)
    if (!(await stat(dir)).isDirectory()) continue
    for (const name of await readdir(dir)) {
      const key = `${folder}/${name}`
      if (!/^[\w-]+\/[\w.-]+$/.test(key)) { console.log(`  lewati (nama tidak valid): ${key}`); skipped++; continue }
      if (await exists(key)) { skipped++; continue }
      if (dry) { console.log(`  akan diunggah: ${key}`); up++; continue }
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(join(dir, name)), ContentType: MIME[extname(name).toLowerCase()] || 'application/octet-stream' }))
        console.log(`  diunggah: ${key}`); up++
      } catch (e) { console.error(`  GAGAL ${key}: ${(e as Error).message}`); failed++ }
    }
  }
  console.log(`[files] selesai: ${up} ${dry ? 'akan diunggah' : 'diunggah'}, ${skipped} dilewati, ${failed} gagal.`)
  if (failed) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
