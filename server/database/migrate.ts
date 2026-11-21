/**
 * Jalankan migrasi dengan pengaman data (dipakai saat deploy ke database yang sudah berisi data):
 *  1. Migrasi yang BELUM diterapkan dipindai; bila memuat perintah destruktif (DROP TABLE/COLUMN/TYPE/SCHEMA,
 *     TRUNCATE, DELETE FROM, ubah tipe kolom) migrasi dibatalkan kecuali ALLOW_DESTRUCTIVE_MIGRATION=1.
 *  2. Bila tabel aplikasi sudah ada tetapi riwayat migrasi Drizzle belum ada (database dibuat tanpa migrator),
 *     migrasi dihentikan agar `0000_init` tidak dijalankan ke skema yang sudah ada.
 * Migrasi dijalankan dalam satu transaksi oleh Drizzle: gagal di tengah = tidak ada yang berubah.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const FOLDER = './server/database/migrations'
const DESTRUCTIVE = [
  /\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA|DATABASE)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i,
]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function fail(msg: string): Promise<never> {
  console.error(`[migrasi] DIBATALKAN: ${msg}`)
  await pool.end()
  process.exit(1)
}

try {
  const journal = JSON.parse(readFileSync(`${FOLDER}/meta/_journal.json`, 'utf8')) as { entries: { when: number, tag: string }[] }
  const hasHistory = (await pool.query(`select to_regclass('drizzle.__drizzle_migrations') as t`)).rows[0].t !== null
  let lastApplied = 0
  if (hasHistory) {
    const r = await pool.query('select max(created_at) as last from drizzle.__drizzle_migrations')
    lastApplied = Number(r.rows[0].last ?? 0)
  } else {
    const existing = (await pool.query(`select to_regclass('public.users') as t`)).rows[0].t !== null
    if (existing) await fail('tabel aplikasi sudah ada tetapi riwayat migrasi Drizzle belum ada. Database ini dibuat tanpa migrator; samakan dulu riwayat migrasinya secara manual agar tidak menimpa skema yang ada.')
  }

  const pending = journal.entries.filter(e => e.when > lastApplied)
  for (const e of pending) {
    // "ON DELETE cascade/set null" pada foreign key bukan perintah hapus data.
    const sql = readFileSync(`${FOLDER}/${e.tag}.sql`, 'utf8').replace(/\bON\s+DELETE\s+(cascade|set null|no action|restrict|set default)\b/gi, '')
    const hit = DESTRUCTIVE.find(re => re.test(sql))
    if (hit && process.env.ALLOW_DESTRUCTIVE_MIGRATION !== '1') {
      await fail(`migrasi ${e.tag} memuat perintah destruktif (${hit}). Tinjau dulu; bila memang disengaja, set ALLOW_DESTRUCTIVE_MIGRATION=1 setelah backup database.`)
    }
  }
  console.log(pending.length ? `[migrasi] menerapkan: ${pending.map(e => e.tag).join(', ')}` : '[migrasi] tidak ada migrasi baru.')

  await migrate(drizzle(pool), { migrationsFolder: FOLDER })
  console.log('Migrasi selesai.')
  await pool.end()
} catch (err) {
  console.error('[migrasi] gagal:', (err as Error).message)
  await pool.end().catch(() => {})
  process.exit(1)
}
