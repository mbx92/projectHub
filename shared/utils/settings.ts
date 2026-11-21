export interface BusinessProfile {
  name: string
  legalForm: string
  npwp: string
  email: string
  whatsapp: string
  address: string
  timezone: string
  logoKey: string | null
}

export interface InvoiceSettings {
  /** Pola nomor invoice. Token: [TAHUN], [BULAN], [NOMOR], [NOMOR 3 DIGIT], [NOMOR 4 DIGIT] */
  numberFormat: string
  defaultDueDays: number
  showTax: boolean
  defaultTaxPercent: number
  footer: string
  qrisKey: string | null
  methods: { transfer: boolean, qris: boolean, tunai: boolean }
}

export type NotifEvent = 'termin_jatuh_tempo' | 'pembayaran_diterima' | 'bug_kritis' | 'bug_ditugaskan' | 'komentar_bug' | 'distribusi' | 'laporan_bulanan' | 'undangan' | 'bug_baru' | 'dokumen_baru' | 'status_proyek'

export interface NotifPref { app: boolean, email: boolean }

export const NOTIF_EVENTS: { key: NotifEvent, name: string, desc: string }[] = [
  { key: 'termin_jatuh_tempo', name: 'Termin akan jatuh tempo', desc: 'H-7 dan hari H' },
  { key: 'pembayaran_diterima', name: 'Pembayaran klien diterima', desc: 'Saat termin dicatat lunas' },
  { key: 'bug_kritis', name: 'Bug kritis dilaporkan', desc: 'Semua proyek' },
  { key: 'bug_ditugaskan', name: 'Bug ditugaskan ke saya', desc: 'Termasuk perubahan status' },
  { key: 'komentar_bug', name: 'Komentar baru di bug', desc: 'Pada bug yang saya laporkan atau tangani' },
  { key: 'distribusi', name: 'Distribusi bagi hasil', desc: 'Saat dana dicairkan' },
  { key: 'bug_baru', name: 'Bug baru dilaporkan', desc: 'Bug non-kritis di semua proyek' },
  { key: 'dokumen_baru', name: 'Dokumen proyek baru', desc: 'Pada proyek yang saya ikuti' },
  { key: 'status_proyek', name: 'Status proyek berubah', desc: 'Pada proyek yang saya ikuti' },
  { key: 'laporan_bulanan', name: 'Laporan investor bulanan', desc: 'Setiap tanggal 1' },
]

export const DEFAULT_NOTIF_PREFS: Record<NotifEvent, NotifPref> = {
  termin_jatuh_tempo: { app: true, email: true },
  pembayaran_diterima: { app: true, email: true },
  bug_kritis: { app: true, email: true },
  bug_ditugaskan: { app: true, email: false },
  komentar_bug: { app: true, email: false },
  distribusi: { app: true, email: true },
  laporan_bulanan: { app: false, email: true },
  undangan: { app: false, email: true },
  bug_baru: { app: true, email: false },
  dokumen_baru: { app: true, email: false },
  status_proyek: { app: true, email: false },
}

export const EXPENSE_CATEGORIES = ['Server & hosting', 'Domain', 'Lisensi & software', 'Honor freelancer', 'Transportasi', 'Konsumsi', 'Perangkat', 'Pemasaran', 'Operasional', 'Lainnya'] as const

export const DEFAULT_SETTINGS: { business: BusinessProfile, invoice: InvoiceSettings } = {
  business: {
    name: 'OCN Development',
    legalForm: 'Perorangan / UMKM',
    npwp: '',
    email: '',
    whatsapp: '',
    address: '',
    timezone: 'Asia/Makassar',
    logoKey: null,
  },
  invoice: {
    numberFormat: 'INV-[TAHUN]-[NOMOR 3 DIGIT]',
    defaultDueDays: 14,
    showTax: false,
    defaultTaxPercent: 11,
    footer: 'Terima kasih atas kepercayaan Anda. Mohon cantumkan nomor invoice saat transfer.',
    qrisKey: null,
    methods: { transfer: true, qris: true, tunai: false },
  },
}
