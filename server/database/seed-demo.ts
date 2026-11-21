/**
 * Seeder demo: 5 proyek lengkap (klien, termin, invoice, pembayaran, pengeluaran, bug, milestone, tim,
 * dokumen), investor + setoran modal, dan satu distribusi bagi hasil — semua konsisten dengan aturan aplikasi
 * (kas OCN, laba, piutang, neraca).
 *
 *   npm run db:seed:demo                 tambah data demo (dilewati bila sudah ada)
 *   npm run db:seed:demo -- --reset      hapus HANYA data demo yang dibuat seeder ini
 *   npm run db:seed:demo -- --fresh      hapus data demo lalu buat ulang
 *
 * Aman untuk data asli: seeder hanya MENAMBAH, mencatat ID baris yang dibuatnya (settings.demo_seed),
 * dan --reset hanya menghapus ID tersebut. Tanggal dihitung relatif terhadap hari ini.
 * Jalankan `npm run db:seed` lebih dulu (admin + template skema).
 */
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as schema from './schema'
import { addDays, rupiah, todayISO } from '../../shared/utils/format'
import { calcDistribution, termAmounts } from '../../shared/utils/money'

const FRESH = process.argv.includes('--fresh')
const RESET = process.argv.includes('--reset') || FRESH
const ONLY_RESET = process.argv.includes('--reset')
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'demo-ocn-2026'
const MANIFEST_KEY = 'demo_seed'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// ── Tanggal relatif hari ini ───────────────────────────────────────────
const today = todayISO()
const day = (n: number) => addDays(today, n)
/** Timestamp pukul `h` WITA pada hari ke-n relatif hari ini. */
const at = (n: number, h = 10) => new Date(`${day(n)}T${String(h - 8).padStart(2, '0')}:00:00Z`)

// ── Definisi data ──────────────────────────────────────────────────────
type UserKey = 'admin' | 'rizky' | 'putu' | 'made' | 'sari'
type ClientKey = 'bumdes' | 'cafe' | 'klinik' | 'desa' | 'kreasi'
type PStatus = 'persiapan' | 'berjalan' | 'tertunda' | 'selesai'

const DEMO_USERS: { key: Exclude<UserKey, 'admin'>, name: string, email: string, role: 'developer' | 'investor', title: string, color: string, investor?: 'aktif' | 'calon' }[] = [
  { key: 'rizky', name: 'Rizky Pratama', email: 'demo.rizky@example.com', role: 'developer', title: 'Freelancer Frontend', color: '#B54708' },
  { key: 'putu', name: 'Putu Ayu Lestari', email: 'demo.putu@example.com', role: 'developer', title: 'Backend Developer', color: '#1849A9' },
  { key: 'made', name: 'Made Wirawan', email: 'demo.made@example.com', role: 'investor', title: 'Investor', color: '#7A5AF8', investor: 'aktif' },
  { key: 'sari', name: 'Ni Luh Sari', email: 'demo.sari@example.com', role: 'investor', title: 'Calon investor', color: '#C11574', investor: 'calon' },
]

const DEMO_CLIENTS: Record<ClientKey, { name: string, contactName: string, whatsapp: string, email: string, address: string }> = {
  bumdes: { name: 'BUMDes Sumber Rejeki', contactName: 'Wayan Sudarta (Ketua)', whatsapp: '+62 812 0000 1001', email: 'bumdes.sumberrejeki@example.com', address: 'Desa Sumber Rejeki, Gianyar, Bali' },
  cafe: { name: '54DM Cafe', contactName: 'Dewi Anggraini (Owner)', whatsapp: '+62 812 0000 1002', email: 'owner@54dm-cafe.example.com', address: 'Jl. Raya Ubud, Gianyar, Bali' },
  klinik: { name: 'Klinik Pratama Sehat Sentosa', contactName: 'dr. Komang Adi (Direktur)', whatsapp: '+62 812 0000 1003', email: 'direktur@sehatsentosa.example.com', address: 'Jl. Ahmad Yani, Denpasar, Bali' },
  desa: { name: 'Pemerintah Desa Mekar Sari', contactName: 'Ketut Arsana (Sekretaris Desa)', whatsapp: '+62 812 0000 1004', email: 'sekdes@mekarsari.example.com', address: 'Desa Mekar Sari, Tabanan, Bali' },
  kreasi: { name: 'CV Bali Kreasi Mandiri', contactName: 'Agus Mahendra (Direktur)', whatsapp: '+62 812 0000 1005', email: 'agus@balikreasi.example.com', address: 'Jl. Teuku Umar, Denpasar, Bali' },
}

interface TermDef { name: string, percent: number, conditions: string, due: number | null, issue?: number, paid?: { day: number, method: string } }
interface ExpenseDef { day: number, description: string, category: string, amount: number, asset?: boolean, personal?: boolean }
interface BugDef {
  title: string, severity: 'kritis' | 'tinggi' | 'sedang' | 'rendah', status: 'open' | 'dikerjakan' | 'review' | 'selesai'
  module: string, day: number, reporter: string, assignee?: UserKey, target?: number, blocks?: boolean
  description: string, steps: string, expected: string, actual: string, resolvedDay?: number
  comments?: { by: UserKey, day: number, text: string }[]
}
interface ProjectDef {
  name: string, client: ClientKey, scheme: string, status: PStatus, description: string, stack: string
  contract: number, budget: number, start: number, target: number | null, progress: number, pic: UserKey
  members: { user: UserKey, role: string, pay: 'bagi_hasil' | 'tetap', fee?: number, weight?: number }[]
  milestones: { name: string, status: 'belum' | 'berjalan' | 'selesai', day: number }[]
  terms: TermDef[]
  expenses: ExpenseDef[]
  bugs: BugDef[]
  docs: { name: string, type: string, status: 'draf' | 'review' | 'final', day: number }[]
  distribute?: { day: number }
}

const PROJECTS: ProjectDef[] = [
  {
    name: 'Sistem Informasi BUMDes', client: 'bumdes', scheme: 'Pendiri 50:50', status: 'berjalan',
    description: 'Sistem informasi pengelolaan unit usaha BUMDes: simpan pinjam, penjualan, inventori, laporan keuangan bulanan, dan aplikasi mobile untuk petugas lapangan.',
    stack: 'Nuxt, PostgreSQL, aplikasi mobile Flutter',
    contract: 50_000_000, budget: 12_000_000, start: -108, target: 9, progress: 80, pic: 'admin',
    members: [
      { user: 'admin', role: 'Project manager & backend', pay: 'bagi_hasil' },
      { user: 'putu', role: 'Backend & database', pay: 'bagi_hasil' },
      { user: 'rizky', role: 'Frontend & aplikasi mobile Flutter', pay: 'tetap', fee: 5_500_000 },
    ],
    milestones: [
      { name: 'Analisis kebutuhan & desain', status: 'selesai', day: -90 },
      { name: 'Modul master data & simpan pinjam', status: 'selesai', day: -55 },
      { name: 'Modul penjualan & laporan keuangan', status: 'selesai', day: -20 },
      { name: 'UAT dan perbaikan bug', status: 'berjalan', day: 5 },
      { name: 'Serah terima & pelatihan pengurus', status: 'belum', day: 9 },
    ],
    terms: [
      { name: 'DP 30%', percent: 30, conditions: 'Saat kontrak ditandatangani', due: -108, issue: -108, paid: { day: -104, method: 'Transfer bank' } },
      { name: 'Termin 2 40%', percent: 40, conditions: 'Setelah modul simpan pinjam selesai', due: -40, issue: -50, paid: { day: -45, method: 'Transfer bank' } },
      { name: 'Pelunasan 30%', percent: 30, conditions: 'Setelah UAT dan serah terima', due: 9 },
    ],
    expenses: [
      { day: -100, description: 'Sewa VPS & domain bumdes untuk 1 tahun', category: 'Server & hosting', amount: 2_400_000 },
      { day: -75, description: 'Honor freelancer frontend — tahap 1', category: 'Honor freelancer', amount: 3_000_000 },
      { day: -40, description: 'Honor freelancer frontend — tahap 2', category: 'Honor freelancer', amount: 2_500_000 },
      { day: -92, description: 'Transport survei & wawancara pengurus BUMDes', category: 'Transportasi', amount: 300_000 },
    ],
    bugs: [
      {
        title: 'Laporan simpanan anggota tidak cocok dengan buku kas', severity: 'kritis', status: 'dikerjakan', module: 'Simpan Pinjam', day: -6,
        reporter: 'Bendahara BUMDes', assignee: 'putu', target: 5, blocks: true,
        description: 'Total simpanan di laporan bulanan berbeda dengan saldo di buku kas harian.',
        steps: '1. Buka Laporan › Simpanan anggota\n2. Pilih periode bulan lalu\n3. Bandingkan total dengan Buku Kas',
        expected: 'Total simpanan sama dengan saldo buku kas.', actual: 'Ada selisih Rp 1.250.000 pada periode yang sama.',
        comments: [
          { by: 'admin', day: -5, text: 'Mohon dicek apakah setoran yang dibatalkan ikut terhitung di laporan.' },
          { by: 'putu', day: -4, text: 'Ketemu: setoran yang dibatalkan masih ikut dihitung di query laporan. Perbaikan sedang diuji.' },
        ],
      },
      {
        title: 'Data transaksi hilang saat koneksi terputus di aplikasi mobile', severity: 'kritis', status: 'open', module: 'Mobile', day: -3,
        reporter: 'Petugas lapangan', assignee: 'rizky', target: 7, blocks: true,
        description: 'Transaksi yang diinput saat sinyal putus tidak tersimpan dan tidak muncul setelah sinyal kembali.',
        steps: '1. Aktifkan mode pesawat\n2. Input transaksi simpanan\n3. Matikan mode pesawat, buka daftar transaksi',
        expected: 'Transaksi tersimpan lokal lalu tersinkron otomatis.', actual: 'Transaksi tidak ada di daftar.',
        comments: [{ by: 'admin', day: -3, text: 'Menghambat UAT. Mohon dikerjakan setelah bug laporan simpanan.' }],
      },
      {
        title: 'Format tanggal laporan bulanan tertukar (bulan-hari)', severity: 'sedang', status: 'review', module: 'Laporan', day: -9,
        reporter: 'Admin BUMDes', assignee: 'putu',
        description: 'Tanggal di kop laporan tampil sebagai 11-21-2026.', steps: '1. Buka Laporan bulanan\n2. Lihat kop laporan',
        expected: 'Tanggal tampil 21 Nov 2026.', actual: 'Tanggal tampil 11-21-2026.',
        comments: [{ by: 'putu', day: -2, text: 'Sudah diperbaiki dan siap direview.' }],
      },
      {
        title: 'Pencarian anggota lambat pada data di atas 500 anggota', severity: 'tinggi', status: 'open', module: 'Master Data', day: -4,
        reporter: 'Admin BUMDes', assignee: 'putu', target: 12,
        description: 'Mengetik nama di kolom pencarian anggota butuh beberapa detik sebelum hasil muncul.', steps: '1. Buka Master Data › Anggota\n2. Ketik nama di kolom pencarian',
        expected: 'Hasil muncul kurang dari 1 detik.', actual: 'Hasil muncul setelah 4–5 detik.',
      },
      {
        title: 'Logo BUMDes tidak muncul pada cetak struk', severity: 'rendah', status: 'selesai', module: 'Cetak', day: -20,
        reporter: 'Kasir unit usaha', assignee: 'rizky', resolvedDay: -12,
        description: 'Struk hanya menampilkan nama BUMDes tanpa logo.', steps: '1. Cetak struk penjualan',
        expected: 'Logo tampil di kop struk.', actual: 'Logo tidak tampil.',
      },
      {
        title: 'Tombol ekspor Excel tidak aktif di Safari', severity: 'sedang', status: 'dikerjakan', module: 'Laporan', day: -2,
        reporter: 'Admin BUMDes', assignee: 'rizky',
        description: 'Tombol Ekspor Excel tidak bereaksi saat diklik di Safari.', steps: '1. Buka Laporan di Safari\n2. Klik Ekspor Excel',
        expected: 'File Excel terunduh.', actual: 'Tidak terjadi apa-apa.',
      },
    ],
    docs: [
      { name: 'Kontrak Kerja Sistem Informasi BUMDes.pdf', type: 'Kontrak', status: 'final', day: -109 },
      { name: 'Spesifikasi Kebutuhan Sistem.docx', type: 'Spesifikasi', status: 'final', day: -95 },
      { name: 'Laporan UAT Tahap 1.docx', type: 'Laporan UAT', status: 'draf', day: -5 },
      { name: 'Berita Acara Serah Terima.docx', type: 'BAST', status: 'draf', day: -1 },
    ],
  },
  {
    name: 'POS Resto', client: 'cafe', scheme: 'Didanai investor', status: 'berjalan',
    description: 'Aplikasi kasir (POS) untuk kafe: pesanan meja, stok bahan, promo, cetak struk thermal, dan laporan penjualan harian.',
    stack: 'Nuxt, PostgreSQL, tablet Android',
    contract: 18_000_000, budget: 6_000_000, start: -45, target: 29, progress: 25, pic: 'admin',
    members: [{ user: 'admin', role: 'Full-stack developer', pay: 'bagi_hasil' }],
    milestones: [
      { name: 'Analisis alur kasir & menu', status: 'selesai', day: -35 },
      { name: 'Modul kasir & stok bahan', status: 'berjalan', day: 7 },
      { name: 'Laporan penjualan', status: 'belum', day: 18 },
      { name: 'Pelatihan staf & go-live', status: 'belum', day: 29 },
    ],
    terms: [
      { name: 'DP 30%', percent: 30, conditions: 'Saat kontrak ditandatangani', due: -38, issue: -45, paid: { day: -42, method: 'QRIS' } },
      { name: 'Termin 1 40%', percent: 40, conditions: 'Setelah modul kasir selesai', due: 19, issue: -1 },
      { name: 'Pelunasan 30%', percent: 30, conditions: 'Saat go-live', due: 29 },
    ],
    expenses: [
      { day: -40, description: 'Sewa VPS 3 bulan untuk server POS & backup', category: 'Server & hosting', amount: 1_200_000 },
      { day: -35, description: 'Tablet kasir Samsung Galaxy Tab A9+ (perangkat uji & demo)', category: 'Perangkat', amount: 3_500_000, asset: true },
      { day: -30, description: 'Lisensi font & paket ikon desain struk', category: 'Lisensi & software', amount: 600_000 },
      { day: -28, description: 'Domain pos-resto (dibayar pribadi)', category: 'Domain', amount: 250_000, personal: true },
    ],
    bugs: [
      {
        title: 'Struk tidak tercetak pada printer thermal 58 mm', severity: 'tinggi', status: 'open', module: 'Kasir', day: -5,
        reporter: 'Dewi (54DM Cafe)', assignee: 'admin', target: 10,
        description: 'Printer thermal 58 mm tidak mengeluarkan struk; printer 80 mm normal.', steps: '1. Hubungkan printer 58 mm\n2. Selesaikan pesanan\n3. Tekan Cetak struk',
        expected: 'Struk tercetak.', actual: 'Printer tidak merespons.',
      },
      {
        title: 'Diskon persen tidak terhitung pada item promo', severity: 'sedang', status: 'dikerjakan', module: 'Promo', day: -7,
        reporter: 'Kasir 54DM Cafe', assignee: 'admin',
        description: 'Item yang sudah masuk promo tidak mendapat potongan persen tambahan.', steps: '1. Tambah item promo ke pesanan\n2. Beri diskon 10%',
        expected: 'Total dipotong 10%.', actual: 'Total tidak berubah.',
        comments: [{ by: 'admin', day: -6, text: 'Aturan promo dan diskon manual saling menimpa; sedang dirapikan.' }],
      },
      {
        title: 'Nama menu panjang terpotong di layar tablet', severity: 'rendah', status: 'selesai', module: 'Kasir', day: -15,
        reporter: 'Kasir 54DM Cafe', assignee: 'admin', resolvedDay: -11,
        description: 'Nama menu lebih dari 25 karakter terpotong.', steps: '1. Buka layar kasir di tablet',
        expected: 'Nama menu tampil utuh.', actual: 'Nama terpotong.',
      },
    ],
    docs: [
      { name: 'Kontrak Pengembangan POS Resto.pdf', type: 'Kontrak', status: 'final', day: -46 },
      { name: 'Proposal & Penawaran POS Resto.pdf', type: 'Proposal', status: 'final', day: -55 },
      { name: 'Spesifikasi Modul Kasir.docx', type: 'Spesifikasi', status: 'draf', day: -30 },
    ],
  },
  {
    name: 'Sistem Klinik Pratama', client: 'klinik', scheme: 'Didanai investor', status: 'persiapan',
    description: 'Sistem informasi klinik pratama: pendaftaran pasien, rekam medis elektronik, farmasi, dan laporan kunjungan.',
    stack: 'Nuxt, PostgreSQL',
    contract: 32_500_000, budget: 10_000_000, start: -3, target: 100, progress: 10, pic: 'admin',
    members: [
      { user: 'admin', role: 'Project manager', pay: 'bagi_hasil' },
      { user: 'putu', role: 'Backend & database', pay: 'bagi_hasil' },
    ],
    milestones: [
      { name: 'Analisis alur pelayanan', status: 'berjalan', day: 14 },
      { name: 'Desain database & API', status: 'belum', day: 28 },
      { name: 'Modul pendaftaran pasien', status: 'belum', day: 50 },
      { name: 'Modul rekam medis & farmasi', status: 'belum', day: 78 },
      { name: 'UAT & serah terima', status: 'belum', day: 100 },
    ],
    terms: [
      { name: 'DP 30%', percent: 30, conditions: 'Saat kontrak ditandatangani', due: -5, issue: -10, paid: { day: -6, method: 'Transfer bank' } },
      { name: 'Termin 2 40%', percent: 40, conditions: 'Setelah modul pendaftaran selesai', due: 45 },
      { name: 'Pelunasan 30%', percent: 30, conditions: 'Setelah UAT dan serah terima', due: 100 },
    ],
    expenses: [{ day: -8, description: 'Survei alur pelayanan klinik (transport & konsumsi)', category: 'Transportasi', amount: 450_000 }],
    bugs: [],
    docs: [
      { name: 'Kontrak Sistem Klinik Pratama.pdf', type: 'Kontrak', status: 'final', day: -11 },
      { name: 'Proposal Sistem Klinik Pratama.pdf', type: 'Proposal', status: 'final', day: -20 },
    ],
  },
  {
    name: 'Aplikasi Absensi Desa', client: 'desa', scheme: 'Proyek solo', status: 'tertunda',
    description: 'Aplikasi absensi perangkat desa berbasis lokasi, rekap kehadiran bulanan, dan laporan untuk kecamatan. Pengerjaan ditunda menunggu kepastian anggaran desa.',
    stack: 'Nuxt, PostgreSQL, PWA',
    contract: 10_000_000, budget: 3_000_000, start: -120, target: null, progress: 35, pic: 'putu',
    members: [{ user: 'putu', role: 'Developer', pay: 'bagi_hasil' }],
    milestones: [
      { name: 'Analisis kebutuhan', status: 'selesai', day: -105 },
      { name: 'Modul absensi & lokasi', status: 'selesai', day: -70 },
      { name: 'Rekap & laporan kehadiran', status: 'berjalan', day: -30 },
      { name: 'Uji coba lapangan', status: 'belum', day: 30 },
    ],
    terms: [
      { name: 'DP 30%', percent: 30, conditions: 'Saat kontrak ditandatangani', due: -118, issue: -125, paid: { day: -120, method: 'Transfer bank' } },
      { name: 'Termin 2 40%', percent: 40, conditions: 'Setelah modul absensi selesai', due: -30, issue: -44 },
      { name: 'Pelunasan 30%', percent: 30, conditions: 'Setelah uji coba lapangan', due: null },
    ],
    expenses: [
      { day: -110, description: 'Sewa server uji coba 3 bulan', category: 'Server & hosting', amount: 900_000 },
      { day: -100, description: 'Transport survei ke kantor desa', category: 'Transportasi', amount: 350_000 },
    ],
    bugs: [
      {
        title: 'Absen tidak tercatat saat sinyal lemah', severity: 'sedang', status: 'open', module: 'Absensi', day: -40,
        reporter: 'Sekretaris Desa', assignee: 'putu',
        description: 'Perangkat desa di wilayah dengan sinyal lemah gagal melakukan absen.', steps: '1. Buka aplikasi di area sinyal lemah\n2. Tekan Absen masuk',
        expected: 'Absen tersimpan dan tersinkron nanti.', actual: 'Muncul pesan gagal menyimpan.',
      },
    ],
    docs: [
      { name: 'Kontrak Aplikasi Absensi Desa.pdf', type: 'Kontrak', status: 'final', day: -126 },
      { name: 'Proposal Aplikasi Absensi Desa.pdf', type: 'Proposal', status: 'final', day: -135 },
      { name: 'Spesifikasi Absensi & Lokasi.docx', type: 'Spesifikasi', status: 'final', day: -112 },
    ],
  },
  {
    name: 'Website Company Profile', client: 'kreasi', scheme: 'Didanai investor', status: 'selesai',
    description: 'Website company profile responsif dengan galeri portofolio, blog, formulir kontak, dan optimasi SEO dasar.',
    stack: 'Nuxt, Tailwind CSS',
    contract: 12_000_000, budget: 5_000_000, start: -100, target: -52, progress: 100, pic: 'admin',
    members: [
      { user: 'admin', role: 'Developer & PM', pay: 'bagi_hasil' },
      { user: 'rizky', role: 'Desain UI & frontend', pay: 'bagi_hasil' },
    ],
    milestones: [
      { name: 'Desain UI', status: 'selesai', day: -85 },
      { name: 'Pengembangan halaman & blog', status: 'selesai', day: -65 },
      { name: 'UAT & serah terima', status: 'selesai', day: -52 },
    ],
    terms: [
      { name: 'DP 50%', percent: 50, conditions: 'Saat kontrak ditandatangani', due: -93, issue: -100, paid: { day: -98, method: 'Transfer bank' } },
      { name: 'Pelunasan 50%', percent: 50, conditions: 'Setelah serah terima', due: -49, issue: -56, paid: { day: -52, method: 'Transfer bank' } },
    ],
    expenses: [
      { day: -90, description: 'Desain UI & aset visual oleh freelancer', category: 'Honor freelancer', amount: 2_800_000 },
      { day: -85, description: 'Hosting & SSL 1 tahun', category: 'Server & hosting', amount: 900_000 },
      { day: -85, description: 'Domain .co.id 1 tahun', category: 'Domain', amount: 300_000 },
      { day: -80, description: 'Lisensi tema & plugin premium', category: 'Lisensi & software', amount: 800_000 },
    ],
    bugs: [
      {
        title: 'Formulir kontak tidak mengirim email ke Gmail', severity: 'sedang', status: 'selesai', module: 'Formulir', day: -70,
        reporter: 'Agus (Bali Kreasi)', assignee: 'admin', resolvedDay: -66,
        description: 'Email dari formulir kontak tidak sampai ke Gmail penerima.', steps: '1. Isi formulir kontak\n2. Kirim',
        expected: 'Email masuk ke kotak masuk.', actual: 'Email tidak diterima.',
      },
      {
        title: 'Gambar galeri lambat dimuat di HP', severity: 'rendah', status: 'selesai', module: 'Galeri', day: -62,
        reporter: 'Agus (Bali Kreasi)', assignee: 'rizky', resolvedDay: -58,
        description: 'Halaman galeri butuh waktu lama di koneksi seluler.', steps: '1. Buka galeri di HP dengan data seluler',
        expected: 'Gambar tampil cepat.', actual: 'Gambar muncul lambat.',
      },
    ],
    docs: [
      { name: 'Kontrak Website Company Profile.pdf', type: 'Kontrak', status: 'final', day: -101 },
      { name: 'Spesifikasi Halaman & Konten.docx', type: 'Spesifikasi', status: 'final', day: -95 },
      { name: 'Laporan UAT Website.docx', type: 'Laporan UAT', status: 'final', day: -55 },
      { name: 'Berita Acara Serah Terima.pdf', type: 'BAST', status: 'final', day: -52 },
    ],
    distribute: { day: -50 },
  },
]

// ── Hapus data demo (hanya ID yang dicatat di manifest) ────────────────
interface Manifest { projectIds: number[], clientIds: number[], userIds: number[], depositIds: number[], notificationIds: number[] }

async function recomputeBalances(tx: Tx) {
  await tx.execute(sql`
    update cash_ledger c set saldo = s.running
    from (
      select id, sum(case when jenis = 'masuk' then nominal else -nominal end) over (order by tanggal, id) as running
      from cash_ledger
    ) s
    where c.id = s.id and c.saldo is distinct from s.running`)
}

async function resetDemo(tx: Tx): Promise<boolean> {
  const [row] = await tx.select().from(schema.settings).where(eq(schema.settings.key, MANIFEST_KEY))
  if (!row) { console.log('Tidak ada data demo yang tercatat; tidak ada yang dihapus.'); return false }
  const m = row.value as Manifest
  if (m.projectIds.length) {
    await tx.delete(schema.cashLedger).where(inArray(schema.cashLedger.projectId, m.projectIds))
    await tx.delete(schema.expenses).where(inArray(schema.expenses.projectId, m.projectIds))
  }
  if (m.depositIds.length) {
    await tx.delete(schema.cashLedger).where(and(eq(schema.cashLedger.refType, 'capital_deposit'), inArray(schema.cashLedger.refId, m.depositIds)))
    await tx.delete(schema.capitalDeposits).where(inArray(schema.capitalDeposits.id, m.depositIds))
  }
  if (m.notificationIds.length) await tx.delete(schema.notifications).where(inArray(schema.notifications.id, m.notificationIds))
  await tx.delete(schema.auditLogs).where(sql`${schema.auditLogs.after}->>'demo' = 'true'`)
  if (m.projectIds.length) await tx.delete(schema.projects).where(inArray(schema.projects.id, m.projectIds)) // cascade: termin, invoice, pembayaran, tim, milestone, bug, dokumen, distribusi
  if (m.clientIds.length) await tx.delete(schema.clients).where(inArray(schema.clients.id, m.clientIds))
  if (m.userIds.length) await tx.delete(schema.users).where(inArray(schema.users.id, m.userIds))
  await tx.delete(schema.settings).where(eq(schema.settings.key, MANIFEST_KEY))
  await recomputeBalances(tx)
  console.log(`Data demo dihapus: ${m.projectIds.length} proyek, ${m.clientIds.length} klien, ${m.userIds.length} pengguna, ${m.depositIds.length} setoran modal.`)
  return true
}

// ── Buat data demo ─────────────────────────────────────────────────────
async function seedDemo(tx: Tx) {
  const [existing] = await tx.select().from(schema.settings).where(eq(schema.settings.key, MANIFEST_KEY))
  if (existing) {
    console.log('Data demo sudah ada — dilewati. Pakai `-- --fresh` untuk membuat ulang atau `-- --reset` untuk menghapusnya.')
    return
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@ocn.dev').toLowerCase()
  let [admin] = await tx.select().from(schema.users).where(eq(schema.users.email, adminEmail))
  if (!admin) [admin] = await tx.select().from(schema.users).where(eq(schema.users.role, 'admin')).limit(1)
  if (!admin) throw new Error('Admin belum ada. Jalankan `npm run db:seed` lebih dulu.')
  const schemes = await tx.select().from(schema.profitSchemes)
  const schemeBy = (name: string) => {
    const s = schemes.find(x => x.name === name)
    if (!s) throw new Error(`Template skema "${name}" belum ada. Jalankan \`npm run db:seed\` lebih dulu.`)
    return s
  }

  const manifest: Manifest = { projectIds: [], clientIds: [], userIds: [], depositIds: [], notificationIds: [] }
  const ledger: (typeof schema.cashLedger.$inferInsert)[] = []
  const audits: (typeof schema.auditLogs.$inferInsert)[] = []
  const audit = (action: string, entity: string, entityId: number, after: Record<string, unknown>, when: Date) =>
    audits.push({ userId: admin.id, action, entity, entityId, before: null, after: { ...after, demo: true }, createdBy: admin.id, createdAt: when, updatedAt: when })

  // ── Pengguna demo ──
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const uid: Record<UserKey, number> = { admin: admin.id, rizky: 0, putu: 0, made: 0, sari: 0 }
  const uname: Record<UserKey, string> = { admin: admin.name, rizky: '', putu: '', made: '', sari: '' }
  const investorId: Partial<Record<UserKey, number>> = {}
  for (const u of DEMO_USERS) {
    let [row] = await tx.select().from(schema.users).where(eq(schema.users.email, u.email))
    if (!row) {
      ;[row] = await tx.insert(schema.users).values({ name: u.name, email: u.email, role: u.role, status: 'aktif', title: u.title, avatarColor: u.color, passwordHash, createdBy: admin.id, createdAt: at(-170), updatedAt: at(-170) }).returning()
      manifest.userIds.push(row!.id)
    }
    uid[u.key] = row!.id
    uname[u.key] = row!.name
    if (u.investor) {
      let [inv] = await tx.select().from(schema.investors).where(eq(schema.investors.userId, row!.id))
      if (!inv) {
        ;[inv] = await tx.insert(schema.investors).values({
          userId: row!.id, status: u.investor, notes: u.investor === 'calon' ? `Rencana modal ${rupiah(25_000_000)}` : null, createdBy: admin.id, createdAt: at(-170), updatedAt: at(-170),
        }).returning()
      }
      investorId[u.key] = inv!.id
    }
  }

  // ── Klien ──
  const cid = {} as Record<ClientKey, number>
  for (const [key, c] of Object.entries(DEMO_CLIENTS) as [ClientKey, (typeof DEMO_CLIENTS)[ClientKey]][]) {
    let [row] = await tx.select().from(schema.clients).where(eq(schema.clients.name, c.name))
    if (!row) {
      ;[row] = await tx.insert(schema.clients).values({ ...c, createdBy: admin.id, createdAt: at(-130), updatedAt: at(-130) }).returning()
      manifest.clientIds.push(row!.id)
    }
    cid[key] = row!.id
  }

  // ── Setoran modal investor (Made) ──
  const deposits = [
    { day: -160, amount: 20_000_000, purpose: 'Kas operasional proyek semester dua — tahap 1' },
    { day: -100, amount: 10_000_000, purpose: 'Penambahan kas operasional — tahap 2' },
  ]
  const madeDeposits = await tx.select({ id: schema.capitalDeposits.id }).from(schema.capitalDeposits).where(eq(schema.capitalDeposits.investorId, investorId.made!))
  if (!madeDeposits.length) {
    for (const d of deposits) {
      const [dep] = await tx.insert(schema.capitalDeposits).values({
        investorId: investorId.made!, date: day(d.day), amount: d.amount, purpose: d.purpose, createdBy: admin.id, createdAt: at(d.day), updatedAt: at(d.day),
      }).returning()
      manifest.depositIds.push(dep!.id)
      ledger.push({ date: day(d.day), type: 'masuk', amount: d.amount, refType: 'capital_deposit', refId: dep!.id, description: `Setoran modal ${uname.made} · ${d.purpose}`, createdBy: admin.id, createdAt: at(d.day) })
      audit('buat', 'capital_deposit', dep!.id, { name: `${uname.made} ${rupiah(d.amount)}` }, at(d.day))
    }
  }

  // ── Penomoran invoice & bug (berurut kronologis, melanjutkan nomor yang sudah ada) ──
  const toCreate = []
  for (const def of PROJECTS) {
    const [dupe] = await tx.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.name, def.name))
    if (dupe) console.log(`  ! Proyek "${def.name}" sudah ada (bukan data demo) — dilewati.`)
    else toCreate.push(def)
  }
  const counters = new Map<string, number>()
  for (const { n } of await tx.select({ n: schema.invoices.number }).from(schema.invoices)) {
    const m = n.match(/^INV-(\d{4})-(\d+)$/)
    if (m) counters.set(m[1]!, Math.max(counters.get(m[1]!) ?? 0, Number(m[2])))
  }
  const invPlan: { key: string, issue: number }[] = []
  const bugPlan: { key: string, day: number }[] = []
  toCreate.forEach((def, pi) => {
    def.terms.forEach((t, ti) => { if (t.issue !== undefined) invPlan.push({ key: `${pi}:${ti}`, issue: t.issue }) })
    def.bugs.forEach((b, bi) => bugPlan.push({ key: `${pi}:${bi}`, day: b.day }))
  })
  const invNo = new Map<string, string>()
  for (const p of invPlan.sort((a, b) => a.issue - b.issue)) {
    const y = day(p.issue).slice(0, 4)
    const v = (counters.get(y) ?? 0) + 1
    counters.set(y, v)
    invNo.set(p.key, `INV-${y}-${String(v).padStart(3, '0')}`)
  }
  let bugMax = 0
  for (const { c } of await tx.select({ c: schema.bugs.code }).from(schema.bugs)) bugMax = Math.max(bugMax, Number(c.replace(/\D/g, '')) || 0)
  const bugNo = new Map<string, string>()
  for (const p of bugPlan.sort((a, b) => a.day - b.day)) bugNo.set(p.key, `BUG-${String(++bugMax).padStart(3, '0')}`)

  // ── Proyek beserta isinya ──
  const created: { id: number, def: ProjectDef, revenue: number, expenses: number, criticalBugIds: number[] }[] = []
  const notifs: (typeof schema.notifications.$inferInsert)[] = []

  for (const [pi, def] of toCreate.entries()) {
    const scheme = schemeBy(def.scheme)
    const [project] = await tx.insert(schema.projects).values({
      name: def.name, description: def.description, stack: def.stack, status: def.status, clientId: cid[def.client],
      contractValue: def.contract, budget: def.budget, startDate: day(def.start), targetDate: def.target === null ? null : day(def.target),
      progress: def.progress, picId: uid[def.pic], schemeId: scheme.id, capitalPct: scheme.capitalPct, workerPct: scheme.workerPct, cashPct: scheme.cashPct,
      createdBy: admin.id, createdAt: at(def.start - 3), updatedAt: at(Math.min(0, def.start + 10)),
    }).returning()
    const pid = project!.id
    manifest.projectIds.push(pid)
    audit('buat', 'project', pid, { name: def.name }, at(def.start - 3))

    await tx.insert(schema.projectMembers).values(def.members.map(m => ({
      projectId: pid, userId: uid[m.user], roleInProject: m.role, payType: m.pay, fixedFee: m.fee ?? 0, shareWeight: m.weight ?? 1, createdBy: admin.id, createdAt: at(def.start - 3),
    })))
    await tx.insert(schema.milestones).values(def.milestones.map((m, i) => ({
      projectId: pid, name: m.name, status: m.status, targetDate: day(m.day), sortOrder: i, createdBy: admin.id, createdAt: at(def.start - 3),
    })))

    // Termin, invoice, pembayaran
    const amounts = termAmounts(def.contract, def.terms.map(t => t.percent))
    let revenue = 0
    for (const [ti, t] of def.terms.entries()) {
      const amount = amounts[ti]!
      const issue = t.issue
      const status = t.paid ? 'lunas' as const : issue !== undefined ? 'terkirim' as const : 'terjadwal' as const
      const [term] = await tx.insert(schema.terms).values({
        projectId: pid, name: t.name, percent: t.percent, amount, conditions: t.conditions, dueDate: t.due === null ? null : day(t.due), status, sortOrder: ti,
        createdBy: admin.id, createdAt: at(def.start - 3),
      }).returning()
      if (issue === undefined) continue

      const number = invNo.get(`${pi}:${ti}`)!
      const dueDate = day(t.due ?? issue + 14)
      const [inv] = await tx.insert(schema.invoices).values({
        number, termId: term!.id, projectId: pid, issueDate: day(issue), dueDate, subtotal: amount, discount: 0, taxPercent: 0, taxAmount: 0, total: amount,
        notes: 'Terima kasih atas kepercayaan Anda. Mohon cantumkan nomor invoice saat transfer.', status: t.paid ? 'lunas' : 'terkirim',
        sentAt: at(issue), paidAt: t.paid ? at(t.paid.day) : null, createdBy: admin.id, createdAt: at(issue), updatedAt: at(t.paid?.day ?? issue),
      }).returning()
      await tx.insert(schema.invoiceItems).values({
        invoiceId: inv!.id, description: `${t.name.replace(/\s*\d+%$/, '')} (${t.percent}% nilai kontrak) — ${def.name}`, qty: 1, price: amount, sortOrder: 0, createdBy: admin.id, createdAt: at(issue),
      })
      audit('buat', 'invoice', inv!.id, { projectId: pid, name: number }, at(issue))
      audit('kirim', 'invoice', inv!.id, { projectId: pid, name: number, status: 'terkirim' }, at(issue, 11))

      if (t.paid) {
        const [pay] = await tx.insert(schema.payments).values({
          invoiceId: inv!.id, amount, date: day(t.paid.day), method: t.paid.method, createdBy: admin.id, createdAt: at(t.paid.day),
        }).returning()
        revenue += amount
        ledger.push({ date: day(t.paid.day), type: 'masuk', amount, refType: 'payment', refId: pay!.id, description: `Pembayaran ${number} · ${def.name}`, projectId: pid, createdBy: admin.id, createdAt: at(t.paid.day) })
        audit('buat', 'payment', pay!.id, { projectId: pid, name: `${number} ${rupiah(amount)}` }, at(t.paid.day))
        notifs.push({ userId: admin.id, type: 'pembayaran_diterima', title: `Pembayaran ${rupiah(amount)} diterima`, body: `${number} · ${def.name} · termin lunas`, link: `/projects/${pid}?tab=pembayaran`, read: t.paid.day < -14, createdBy: admin.id, createdAt: at(t.paid.day, 12) })
      } else if (t.due !== null && t.due < 0) {
        notifs.push({ userId: admin.id, type: 'termin_jatuh_tempo', title: `${t.name} ${def.name} sudah lewat jatuh tempo`, body: `${number} · sisa ${rupiah(amount)} · jatuh tempo ${day(t.due)}`, link: `/invoices/${inv!.id}`, read: false, createdBy: admin.id, createdAt: at(t.due + 1, 8) })
      }
    }

    // Pengeluaran
    let expenseTotal = 0
    for (const e of def.expenses) {
      const [exp] = await tx.insert(schema.expenses).values({
        projectId: pid, date: day(e.day), description: e.description, category: e.category, amount: e.amount,
        source: e.personal ? 'pribadi' : 'kas_ocn', isAsset: !!e.asset, createdBy: admin.id, createdAt: at(e.day),
      }).returning()
      if (!e.asset) expenseTotal += e.amount
      if (!e.personal) ledger.push({ date: day(e.day), type: 'keluar', amount: e.amount, refType: 'expense', refId: exp!.id, description: `${e.asset ? 'Aset: ' : ''}${e.description} · ${def.name}`, projectId: pid, createdBy: admin.id, createdAt: at(e.day) })
      audit('buat', 'expense', exp!.id, { projectId: pid, name: e.description }, at(e.day))
    }

    // Dokumen
    if (def.docs.length) {
      await tx.insert(schema.documents).values(def.docs.map(d => ({ projectId: pid, name: d.name, type: d.type, status: d.status, fileUrl: null, createdBy: admin.id, createdAt: at(d.day), updatedAt: at(d.day) })))
    }

    // Bug + komentar + aktivitas
    const FLOW = ['open', 'dikerjakan', 'review', 'selesai'] as const
    const LABEL = { open: 'Open', dikerjakan: 'Dikerjakan', review: 'Review', selesai: 'Selesai' }
    const criticalBugIds: number[] = []
    for (const [bi, b] of def.bugs.entries()) {
      const [bug] = await tx.insert(schema.bugs).values({
        code: bugNo.get(`${pi}:${bi}`)!, projectId: pid, title: b.title, description: b.description, steps: b.steps, expected: b.expected, actual: b.actual, module: b.module,
        severity: b.severity, status: b.status, assigneeId: b.assignee ? uid[b.assignee] : null, reporter: b.reporter, reporterUserId: admin.id,
        targetDate: b.target === undefined ? null : day(b.target), blocksTerm: !!b.blocks,
        resolvedAt: b.status === 'selesai' ? at(b.resolvedDay ?? Math.min(b.day + 5, -1)) : null, createdBy: admin.id, createdAt: at(b.day), updatedAt: at(Math.min(0, b.day + 3)),
      }).returning()
      const events: { userId: number, body: string, kind: 'comment' | 'activity', when: Date }[] = [{ userId: admin.id, body: 'melaporkan bug', kind: 'activity', when: at(b.day) }]
      if (b.assignee) events.push({ userId: admin.id, body: `menugaskan ke ${uname[b.assignee]}`, kind: 'activity', when: at(b.day, 11) })
      for (let i = 1; i <= FLOW.indexOf(b.status); i++) {
        const last = FLOW[i] === 'selesai'
        events.push({ userId: last || !b.assignee ? admin.id : uid[b.assignee], body: `memindahkan status ${LABEL[FLOW[i - 1]!]} → ${LABEL[FLOW[i]!]}`, kind: 'activity', when: at(Math.min(b.day + i * 2, b.resolvedDay ?? 0), 14) })
      }
      for (const c of b.comments ?? []) events.push({ userId: uid[c.by], body: c.text, kind: 'comment', when: at(c.day, 15) })
      events.sort((x, y) => +x.when - +y.when)
      await tx.insert(schema.bugComments).values(events.map(e => ({ bugId: bug!.id, userId: e.userId, body: e.body, kind: e.kind, createdBy: e.userId, createdAt: e.when, updatedAt: e.when })))
      if (b.severity === 'kritis' && b.status !== 'selesai') criticalBugIds.push(bug!.id)
      if (b.severity === 'kritis' && b.status !== 'selesai') {
        notifs.push({ userId: admin.id, type: 'bug_kritis', title: `Bug kritis ${bug!.code}: ${b.title}`, body: `Proyek ${def.name}${b.blocks ? ' · menghambat termin' : ''}`, link: `/bugs/${bug!.id}`, read: false, createdBy: admin.id, createdAt: at(b.day, 9) })
      }
      if (b.assignee && b.status !== 'selesai') {
        notifs.push({ userId: uid[b.assignee], type: 'bug_ditugaskan', title: `${bug!.code} ditugaskan ke Anda`, body: `${b.title} · ${def.name}`, link: `/bugs/${bug!.id}`, read: false, createdBy: admin.id, createdAt: at(b.day, 11) })
      }
    }
    created.push({ id: pid, def, revenue, expenses: expenseTotal, criticalBugIds })
  }

  // ── Distribusi bagi hasil (proyek selesai & didanai investor) ──
  for (const c of created) {
    if (!c.def.distribute) continue
    const scheme = schemeBy(c.def.scheme)
    const netProfit = c.revenue - c.expenses
    const capital = deposits.reduce((s, d) => s + (d.day <= c.def.distribute!.day ? d.amount : 0), 0)
    const workers = c.def.members.filter(m => m.pay === 'bagi_hasil').map(m => ({ userId: uid[m.user], name: uname[m.user], weight: m.weight ?? 1 }))
    const calc = calcDistribution({
      netProfit, capitalPct: scheme.capitalPct, workerPct: scheme.workerPct, cashPct: scheme.cashPct,
      investors: [{ investorId: investorId.made!, userId: uid.made, name: uname.made, capital }], workers,
    })
    const [dist] = await tx.insert(schema.distributions).values({
      projectId: c.id, date: day(c.def.distribute.day), netProfit, notes: 'Pencairan laba setelah pelunasan klien diterima.',
      schemeSnapshot: {
        schemeId: scheme.id, schemeName: scheme.name, capitalPct: scheme.capitalPct, workerPct: scheme.workerPct, cashPct: scheme.cashPct,
        revenue: c.revenue, expenses: c.expenses, fixedFees: 0, netProfit,
        capitalShares: [{ investorId: investorId.made!, userId: uid.made, name: uname.made, capital, portion: 100 }],
        workerShares: workers,
      },
      createdBy: admin.id, createdAt: at(c.def.distribute.day), updatedAt: at(c.def.distribute.day),
    }).returning()
    await tx.insert(schema.distributionLines).values(calc.lines.map(l => ({
      distributionId: dist!.id, recipientUserId: l.recipientUserId, part: l.part, amount: l.amount, basisPct: l.basisPct, createdBy: admin.id, createdAt: at(c.def.distribute!.day),
    })))
    const payout = calc.lines.filter(l => l.part !== 'kas').reduce((s, l) => s + l.amount, 0)
    ledger.push({ date: day(c.def.distribute.day), type: 'keluar', amount: payout, refType: 'distribution', refId: dist!.id, description: `Distribusi bagi hasil ${c.def.name}`, projectId: c.id, createdBy: admin.id, createdAt: at(c.def.distribute.day) })
    audit('buat', 'distribution', dist!.id, { projectId: c.id, name: `${c.def.name} ${rupiah(netProfit)}` }, at(c.def.distribute.day))
    notifs.push({ userId: uid.made, type: 'distribusi', title: `Bagi hasil ${c.def.name}: ${rupiah(calc.lines.find(l => l.part === 'modal')?.amount ?? 0)}`, body: `Bagian Modal dari laba bersih ${rupiah(netProfit)}`, link: '/', read: true, createdBy: admin.id, createdAt: at(c.def.distribute.day, 13) })
  }

  // ── Kas OCN, jejak audit, notifikasi, manifest ──
  if (ledger.length) await tx.insert(schema.cashLedger).values(ledger.map(l => ({ ...l, balance: 0, updatedAt: l.createdAt })))
  await recomputeBalances(tx)
  const [minRow] = (await tx.execute(sql`select min(saldo) as m from cash_ledger`)).rows as { m: string | null }[]
  if (Number(minRow?.m ?? 0) < 0) throw new Error(`Saldo kas OCN menjadi negatif (${minRow?.m}) — data demo dibatalkan.`)
  if (audits.length) await tx.insert(schema.auditLogs).values(audits)
  if (notifs.length) {
    const rows = await tx.insert(schema.notifications).values(notifs.map(n => ({ ...n, updatedAt: n.createdAt }))).returning({ id: schema.notifications.id })
    manifest.notificationIds = rows.map(r => r.id)
  }
  await tx.insert(schema.settings).values({ key: MANIFEST_KEY, value: manifest, createdBy: admin.id })

  const [saldo] = (await tx.execute(sql`select coalesce(sum(case when jenis='masuk' then nominal else -nominal end),0) as s from cash_ledger`)).rows as { s: string }[]
  console.log(`\nSelesai. Dibuat: ${created.length} proyek, ${created.reduce((s, c) => s + c.def.terms.length, 0)} termin, ${invNo.size} invoice, ${bugNo.size} bug, `
    + `${created.reduce((s, c) => s + c.def.expenses.length, 0)} pengeluaran, ${manifest.userIds.length} pengguna demo, ${manifest.clientIds.length} klien, ${manifest.depositIds.length} setoran modal.`)
  console.log(`Saldo kas OCN sekarang ${rupiah(Number(saldo?.s ?? 0))}.`)
  console.log('Pengguna demo (peran Developer/Investor) memakai kata sandi dari SEED_DEMO_PASSWORD (lihat .env.example).')
}

try {
  await db.transaction(async (tx) => {
    if (RESET) await resetDemo(tx)
    if (!ONLY_RESET) await seedDemo(tx)
  })
} catch (e) {
  console.error('Seeder gagal, tidak ada perubahan yang disimpan:', (e as Error).message)
  process.exitCode = 1
} finally {
  await pool.end()
}
