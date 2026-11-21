/**
 * Seed data dasar: akun admin pertama, template skema bagi hasil, pengaturan default.
 * Aman dijalankan berulang (idempotent).
 */
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { DEFAULT_SETTINGS } from '../../shared/utils/settings'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@ocn.dev').toLowerCase()
const password = process.env.SEED_ADMIN_PASSWORD || 'ganti-saya'

const existing = await db.select().from(schema.users).where(eq(schema.users.email, email))
if (!existing.length) {
  await db.insert(schema.users).values({
    name: 'Pande', email, role: 'admin', status: 'aktif', title: 'Pendiri',
    passwordHash: await bcrypt.hash(password, 12), avatarColor: '#0B6E63',
  })
  console.log(`Admin dibuat: ${email}`)
} else {
  console.log(`Admin sudah ada: ${email}`)
}

const schemes = await db.select().from(schema.profitSchemes)
if (!schemes.length) {
  const labels = { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN' }
  await db.insert(schema.profitSchemes).values([
    { name: 'Didanai investor', description: 'Proyek yang biayanya memakai modal investor', capitalPct: 40, workerPct: 40, cashPct: 20, shareLabels: labels, isDefault: true },
    { name: 'Pendiri 50:50', description: 'Laba dibagi rata antar pendiri', capitalPct: 0, workerPct: 100, cashPct: 0, shareLabels: { ...labels, pekerja: 'Pendiri' } },
    { name: 'Proyek solo', description: 'Dikerjakan satu orang, sebagian masuk kas', capitalPct: 0, workerPct: 80, cashPct: 20, shareLabels: labels },
  ])
  console.log('Template skema bagi hasil dibuat.')
}

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key))
  if (!row.length) await db.insert(schema.settings).values({ key, value })
}
console.log('Pengaturan default siap.')

await pool.end()
