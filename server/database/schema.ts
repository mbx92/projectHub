/**
 * Skema database OCN Project Hub (Drizzle ORM, PostgreSQL).
 * - Semua uang disimpan sebagai bilangan bulat rupiah (bigint, mode number).
 * - Semua tabel punya created_at, updated_at, created_by.
 */
import {
  pgTable, pgEnum, serial, integer, bigint, text, varchar, boolean, date, timestamp,
  numeric, jsonb, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core'

// ── Enum ──────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['admin', 'investor', 'developer'])
export const userStatusEnum = pgEnum('user_status', ['diundang', 'aktif', 'nonaktif'])
export const projectStatusEnum = pgEnum('project_status', ['persiapan', 'berjalan', 'tertunda', 'selesai'])
export const payTypeEnum = pgEnum('pay_type', ['bagi_hasil', 'tetap'])
export const milestoneStatusEnum = pgEnum('milestone_status', ['belum', 'berjalan', 'selesai'])
export const termStatusEnum = pgEnum('term_status', ['terjadwal', 'draf', 'terkirim', 'lunas'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draf', 'terkirim', 'lunas', 'batal'])
export const ledgerTypeEnum = pgEnum('ledger_type', ['masuk', 'keluar'])
export const investorStatusEnum = pgEnum('investor_status', ['aktif', 'calon'])
export const sharePartEnum = pgEnum('share_part', ['modal', 'pekerja', 'kas'])
export const bugSeverityEnum = pgEnum('bug_severity', ['kritis', 'tinggi', 'sedang', 'rendah'])
export const bugStatusEnum = pgEnum('bug_status', ['open', 'dikerjakan', 'review', 'selesai'])
export const tokenTypeEnum = pgEnum('token_type', ['undangan', 'reset'])

const money = (name: string) => bigint(name, { mode: 'number' })
const pct = (name: string) => numeric(name, { precision: 6, scale: 2, mode: 'number' })

const audit = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdBy: integer('created_by'),
}

// ── Pengguna & sesi ───────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 190 }).notNull(),
  passwordHash: text('password_hash'),
  role: roleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('diundang'),
  title: varchar('title', { length: 80 }),
  phone: varchar('phone', { length: 40 }),
  avatarColor: varchar('avatar_color', { length: 9 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...audit,
}, t => [uniqueIndex('users_email_uq').on(t.email)])

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(), // sha256 dari token cookie
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 64 }),
  ...audit,
}, t => [index('sessions_user_idx').on(t.userId)])

export const userTokens = pgTable('user_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: tokenTypeEnum('type').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  ...audit,
}, t => [uniqueIndex('user_tokens_hash_uq').on(t.tokenHash)])

// ── Klien & proyek ────────────────────────────────────────────────────
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  contactName: varchar('contact_name', { length: 120 }),
  whatsapp: varchar('whatsapp', { length: 40 }),
  email: varchar('email', { length: 190 }),
  address: text('address'),
  ...audit,
})

export const profitSchemes = pgTable('profit_schemes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  capitalPct: pct('persen_modal').notNull().default(0),
  workerPct: pct('persen_pekerja').notNull().default(0),
  cashPct: pct('persen_kas').notNull().default(0),
  /** Label tampilan tiap bagian, mis. { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN' } */
  shareLabels: jsonb('label_bagian').$type<{ modal: string, pekerja: string, kas: string }>(),
  isDefault: boolean('is_default').notNull().default(false),
  ...audit,
})

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  stack: varchar('stack', { length: 200 }),
  status: projectStatusEnum('status').notNull().default('persiapan'),
  clientId: integer('client_id').references(() => clients.id),
  contractValue: money('nilai_kontrak').notNull().default(0),
  budget: money('anggaran').notNull().default(0),
  startDate: date('mulai'),
  targetDate: date('target_selesai'),
  progress: integer('progress').notNull().default(0),
  picId: integer('pj_id').references(() => users.id),
  schemeId: integer('skema_id').references(() => profitSchemes.id),
  /** Persentase skema yang berlaku di proyek ini (salinan dari template, bisa diubah per proyek). */
  capitalPct: pct('persen_modal').notNull().default(0),
  workerPct: pct('persen_pekerja').notNull().default(0),
  cashPct: pct('persen_kas').notNull().default(0),
  archived: boolean('diarsipkan').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...audit,
}, t => [index('projects_client_idx').on(t.clientId)])

export const projectMembers = pgTable('project_members', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleInProject: varchar('peran_di_proyek', { length: 80 }),
  payType: payTypeEnum('cara_bayar').notNull().default('bagi_hasil'),
  /** Honor tetap (rupiah) bila cara_bayar = tetap. */
  fixedFee: money('honor_tetap').notNull().default(0),
  /** Bobot pembagian di dalam bagian pekerja (default sama rata). */
  shareWeight: integer('bobot').notNull().default(1),
  ...audit,
}, t => [primaryKey({ columns: [t.projectId, t.userId] })])

export const milestones = pgTable('milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  targetDate: date('target'),
  status: milestoneStatusEnum('status').notNull().default('belum'),
  sortOrder: integer('urutan').notNull().default(0),
  ...audit,
})

export const terms = pgTable('terms', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  percent: pct('persen').notNull(),
  amount: money('nominal').notNull(),
  conditions: text('syarat'),
  dueDate: date('jatuh_tempo'),
  status: termStatusEnum('status').notNull().default('terjadwal'),
  sortOrder: integer('urutan').notNull().default(0),
  ...audit,
}, t => [index('terms_project_idx').on(t.projectId)])

// ── Keuangan ──────────────────────────────────────────────────────────
export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  bankName: varchar('bank', { length: 80 }).notNull(),
  accountNumber: varchar('nomor', { length: 60 }).notNull(),
  accountName: varchar('atas_nama', { length: 120 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  active: boolean('aktif').notNull().default(true),
  ...audit,
})

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  number: varchar('nomor', { length: 60 }).notNull(),
  termId: integer('term_id').references(() => terms.id),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  issueDate: date('terbit').notNull(),
  dueDate: date('jatuh_tempo').notNull(),
  subtotal: money('subtotal').notNull().default(0),
  discount: money('diskon').notNull().default(0),
  taxPercent: pct('pajak_persen').notNull().default(0),
  taxAmount: money('pajak').notNull().default(0),
  total: money('total').notNull().default(0),
  notes: text('catatan'),
  bankAccountId: integer('rekening_id').references(() => bankAccounts.id),
  showQris: boolean('tampil_qris').notNull().default(false),
  status: invoiceStatusEnum('status').notNull().default('draf'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  /** Template dokumen yang dibekukan saat invoice terkirim; null = layout bawaan. */
  templateRef: jsonb('template_ref').$type<TemplateRef | null>(),
  ...audit,
}, t => [uniqueIndex('invoices_number_uq').on(t.number), index('invoices_term_idx').on(t.termId)])

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('deskripsi').notNull(),
  qty: numeric('qty', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
  price: money('harga').notNull(),
  sortOrder: integer('urutan').notNull().default(0),
  ...audit,
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  amount: money('nominal').notNull(),
  date: date('tanggal').notNull(),
  method: varchar('metode', { length: 60 }).notNull(),
  proofUrl: text('bukti_url'),
  notes: text('catatan'),
  /** Template kuitansi yang dibekukan saat pembayaran dicatat; null = layout bawaan. */
  templateRef: jsonb('template_ref').$type<TemplateRef | null>(),
  ...audit,
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  date: date('tanggal').notNull(),
  description: text('keterangan').notNull(),
  category: varchar('kategori', { length: 60 }).notNull(),
  amount: money('nominal').notNull(),
  source: varchar('sumber', { length: 60 }).notNull().default('kas_ocn'),
  isAsset: boolean('adalah_aset').notNull().default(false),
  proofUrl: text('bukti_url'),
  ...audit,
}, t => [index('expenses_project_idx').on(t.projectId)])

export const cashLedger = pgTable('cash_ledger', {
  id: serial('id').primaryKey(),
  date: date('tanggal').notNull(),
  type: ledgerTypeEnum('jenis').notNull(),
  amount: money('nominal').notNull(),
  refType: varchar('ref_type', { length: 40 }).notNull(), // payment | expense | capital_deposit | distribution | saldo_awal
  refId: integer('ref_id'),
  description: text('keterangan'),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  balance: money('saldo').notNull().default(0),
  ...audit,
}, t => [index('cash_ledger_ref_idx').on(t.refType, t.refId), index('cash_ledger_date_idx').on(t.date)])

// ── Investor & bagi hasil ─────────────────────────────────────────────
export const investors = pgTable('investors', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: investorStatusEnum('status').notNull().default('calon'),
  notes: text('catatan'),
  ...audit,
}, t => [uniqueIndex('investors_user_uq').on(t.userId)])

export const capitalDeposits = pgTable('capital_deposits', {
  id: serial('id').primaryKey(),
  investorId: integer('investor_id').notNull().references(() => investors.id, { onDelete: 'cascade' }),
  date: date('tanggal').notNull(),
  amount: money('nominal').notNull(),
  purpose: text('peruntukan'),
  proofUrl: text('bukti_url'),
  ...audit,
})

export type SchemeSnapshot = {
  schemeId: number | null
  schemeName: string
  capitalPct: number
  workerPct: number
  cashPct: number
  revenue: number
  expenses: number
  fixedFees: number
  netProfit: number
  capitalShares: { investorId: number, userId: number, name: string, capital: number, portion: number }[]
  workerShares: { userId: number, name: string, weight: number }[]
}

export const distributions = pgTable('distributions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  date: date('tanggal').notNull(),
  netProfit: money('laba_bersih').notNull(),
  schemeSnapshot: jsonb('snapshot_skema').$type<SchemeSnapshot>().notNull(),
  notes: text('catatan'),
  ...audit,
})

export const distributionLines = pgTable('distribution_lines', {
  id: serial('id').primaryKey(),
  distributionId: integer('distribution_id').notNull().references(() => distributions.id, { onDelete: 'cascade' }),
  recipientUserId: integer('penerima').references(() => users.id),
  part: sharePartEnum('bagian').notNull(),
  amount: money('nominal').notNull(),
  basisPct: pct('persen').notNull().default(0),
  ...audit,
})

// ── Bug tracker ───────────────────────────────────────────────────────
export const bugs = pgTable('bugs', {
  id: serial('id').primaryKey(),
  code: varchar('kode', { length: 20 }).notNull(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  /** bug | fitur | tugas */
  type: varchar('jenis', { length: 20 }).notNull().default('bug'),
  title: varchar('judul', { length: 200 }).notNull(),
  description: text('deskripsi'),
  steps: text('langkah'),
  expected: text('seharusnya'),
  actual: text('kenyataan'),
  module: varchar('modul', { length: 80 }),
  /** Daftar centang: [{ text, done }] */
  checklist: jsonb('checklist').$type<{ text: string, done: boolean }[]>().notNull().default([]),
  severity: bugSeverityEnum('keparahan').notNull().default('sedang'),
  status: bugStatusEnum('status').notNull().default('open'),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  reporter: varchar('pelapor', { length: 120 }),
  reporterUserId: integer('pelapor_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetDate: date('target'),
  blocksTerm: boolean('menghambat_termin').notNull().default(false),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  ...audit,
}, t => [uniqueIndex('bugs_code_uq').on(t.code), index('bugs_project_idx').on(t.projectId)])

export const bugComments = pgTable('bug_comments', {
  id: serial('id').primaryKey(),
  bugId: integer('bug_id').notNull().references(() => bugs.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('isi').notNull(),
  /** comment = komentar pengguna, activity = catatan aktivitas otomatis */
  kind: varchar('jenis', { length: 20 }).notNull().default('comment'),
  ...audit,
})

export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 40 }).notNull(), // bug
  entityId: integer('entity_id').notNull(),
  fileKey: text('file_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mime: varchar('mime', { length: 120 }),
  size: integer('size'),
  ...audit,
}, t => [index('attachments_entity_idx').on(t.entityType, t.entityId)])

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('nama', { length: 200 }).notNull(),
  type: varchar('jenis', { length: 60 }).notNull(),
  status: varchar('status', { length: 40 }).notNull().default('draf'),
  fileUrl: text('file_url'),
  /** Isi dokumen yang diedit di aplikasi (dokumen JSON dari editor); null untuk dokumen berupa file. */
  content: jsonb('isi').$type<Record<string, unknown>>(),
  docNumber: varchar('nomor', { length: 60 }),
  /** Salinan kop & footer saat dokumen difinalkan, agar perubahan Pengaturan tidak mengubah dokumen final. */
  layoutSnapshot: jsonb('tata_letak').$type<DocLayoutSnapshot>(),
  ...audit,
})

// ── Sistem ────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('jenis', { length: 40 }).notNull(),
  title: varchar('judul', { length: 200 }).notNull(),
  body: text('isi'),
  link: text('link'),
  read: boolean('dibaca').notNull().default(false),
  ...audit,
}, t => [index('notifications_user_idx').on(t.userId, t.read)])

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: varchar('aksi', { length: 40 }).notNull(),
  entity: varchar('entitas', { length: 40 }).notNull(),
  entityId: integer('entity_id'),
  before: jsonb('sebelum'),
  after: jsonb('sesudah'),
  ...audit,
}, t => [index('audit_logs_entity_idx').on(t.entity, t.entityId)])

export const settings = pgTable('settings', {
  key: varchar('kunci', { length: 80 }).primaryKey(),
  value: jsonb('nilai').notNull(),
  ...audit,
})

// ── Permintaan tanda tangan klien (berita acara / persetujuan) ────────
export const signatureRequests = pgTable('signature_requests', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('judul', { length: 200 }).notNull(),
  body: text('isi').notNull(),
  /** Token acak pada tautan publik klien. */
  token: varchar('token', { length: 64 }).notNull(),
  /** menunggu | ditandatangani | dibatalkan (kedaluwarsa dihitung dari expires_at) */
  status: varchar('status', { length: 20 }).notNull().default('menunggu'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  sentTo: varchar('dikirim_ke', { length: 190 }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signerName: varchar('penandatangan', { length: 160 }),
  signatureKey: text('tanda_tangan'),
  signerIp: varchar('ip', { length: 64 }),
  signerAgent: varchar('perangkat', { length: 300 }),
  contentHash: varchar('hash_isi', { length: 64 }),
  ...audit,
}, t => [uniqueIndex('signature_requests_token_uq').on(t.token), index('signature_requests_project_idx').on(t.projectId)])

/** Investor pendana per proyek. Kosong = bagian modal dibagi ke semua investor aktif (perilaku lama). */
export const projectInvestors = pgTable('project_investors', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  investorId: integer('investor_id').notNull().references(() => investors.id, { onDelete: 'cascade' }),
  ...audit,
}, t => [primaryKey({ columns: [t.projectId, t.investorId] })])
