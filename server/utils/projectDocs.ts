/**
 * Dokumen proyek yang dibuat otomatis dari data sistem (BAST, Laporan UAT).
 * Isinya berupa dokumen JSON editor (TipTap/ProseMirror) yang bisa diedit di aplikasi;
 * kop dan footer dipasang saat tampil/ekspor, bukan bagian dari isi.
 */
import { eq, asc } from 'drizzle-orm'

export const GENERATABLE_DOCS = ['Kontrak', 'Spesifikasi', 'Laporan UAT', 'BAST'] as const
export type GeneratableDoc = typeof GENERATABLE_DOCS[number]

/** Simpul dokumen editor (subset skema TipTap yang dipakai). */
export interface DocNode { type: string, attrs?: Record<string, unknown>, content?: DocNode[], text?: string, marks?: { type: string }[] }

async function loadProjectDocData(projectId: number) {
  const db = useDB()
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) notFound('Proyek')
  const [client] = project.clientId ? await db.select().from(schema.clients).where(eq(schema.clients.id, project.clientId)) : []
  const [pic] = project.picId ? await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, project.picId)) : []
  const milestones = await db.select().from(schema.milestones).where(eq(schema.milestones.projectId, projectId)).orderBy(asc(schema.milestones.sortOrder), asc(schema.milestones.id))
  const bugs = await db.select().from(schema.bugs).where(eq(schema.bugs.projectId, projectId)).orderBy(asc(schema.bugs.id))
  const terms = await db.select().from(schema.terms).where(eq(schema.terms.projectId, projectId)).orderBy(asc(schema.terms.sortOrder), asc(schema.terms.id))
  const members = await db.select({ name: schema.users.name, role: schema.projectMembers.roleInProject }).from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId)).where(eq(schema.projectMembers.projectId, projectId))
  return { project, client: client ?? null, pic: pic ?? null, milestones, bugs, terms, members }
}
export type ProjectDocData = Awaited<ReturnType<typeof loadProjectDocData>>

const MS_LABEL = { belum: 'Belum', berjalan: 'Berjalan', selesai: 'Selesai' } as const
const SEV_LABEL = { kritis: 'Kritis', tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' } as const
const BUG_LABEL = { open: 'Terbuka', dikerjakan: 'Dikerjakan', review: 'Review', selesai: 'Selesai' } as const
const SEV_ORDER = ['kritis', 'tinggi', 'sedang', 'rendah'] as const

// ── Pembangun simpul ──
const text = (t: string, bold = false): DocNode => ({ type: 'text', text: t, ...(bold ? { marks: [{ type: 'bold' }] } : {}) })
const p = (...parts: (string | DocNode)[]): DocNode => {
  const content = parts.map(x => (typeof x === 'string' ? text(x) : x)).filter(n => n.text !== '')
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}
const h = (level: 1 | 2 | 3, t: string): DocNode => ({ type: 'heading', attrs: { level }, content: [text(t)] })
const cellNode = (t: string, header = false, bold = false): DocNode => ({ type: header ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [p(bold ? text(t, true) : t || ' ')] })
const table = (head: string[] | null, rows: string[][]): DocNode => ({
  type: 'table',
  content: [
    ...(head ? [{ type: 'tableRow', content: head.map(c => cellNode(c, true)) }] : []),
    ...rows.map(r => ({ type: 'tableRow', content: r.map(c => cellNode(c)) })),
  ],
})
/** Tabel label/nilai (kolom pertama tebal). */
const infoTable = (rows: [string, string][]): DocNode => ({
  type: 'table',
  content: rows.map(([k, v]) => ({ type: 'tableRow', content: [cellNode(k, true), cellNode(v)] })),
})
const list = (kind: 'bulletList' | 'orderedList', items: string[]): DocNode => ({ type: kind, content: items.map(t => ({ type: 'listItem', content: [p(t)] })) })
const ul = (items: string[]) => list('bulletList', items)
const ol = (items: string[]) => list('orderedList', items)
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content })
const DRAFT_NOTE = 'Catatan: dokumen ini disusun otomatis dari data proyek sebagai draf awal. Ganti isian dalam tanda [ ] dan tinjau seluruh isinya sebelum digunakan. Hapus catatan ini setelah selesai.'

export function bastContent(d: ProjectDocData, business: BusinessProfile, no: string): DocNode {
  const today = todayISO()
  const done = d.milestones.filter(m => m.status === 'selesai').length
  const period = [d.project.startDate ? dateId(d.project.startDate) : null, d.project.targetDate ? dateId(d.project.targetDate) : null].filter(Boolean).join(' – ') || '—'
  const info: [string, string][] = [
    ['Pihak Pertama (penyedia)', business.name],
    ['Pihak Kedua (klien)', d.client?.name ?? '—'],
    ['Proyek', d.project.name],
    ...(d.project.stack ? [['Teknologi', d.project.stack] as [string, string]] : []),
    ['Nilai kontrak', rupiah(d.project.contractValue)],
    ['Periode', period],
    ...(d.pic ? [['Penanggung jawab', d.pic.name] as [string, string]] : []),
  ]
  return doc(
    h(1, 'BERITA ACARA SERAH TERIMA'),
    p(`Nomor: ${no}`),
    p(`Pada hari ini, ${dateLongId(today)}, yang bertanda tangan di bawah ini menyatakan bahwa pekerjaan berikut telah diserahterimakan:`),
    infoTable(info),
    h(2, 'Rincian pekerjaan'),
    d.milestones.length
      ? table(['No', 'Tahapan', 'Target', 'Status'], d.milestones.map((m, i) => [String(i + 1), m.name, m.targetDate ? dateId(m.targetDate) : '—', MS_LABEL[m.status]]))
      : p('Belum ada tahapan pekerjaan yang dicatat.'),
    ...(d.milestones.length && done < d.milestones.length
      ? [p(`Catatan: ${d.milestones.length - done} dari ${d.milestones.length} tahapan belum berstatus selesai pada saat dokumen ini dibuat.`)]
      : []),
    p('Dengan ditandatanganinya berita acara ini, Pihak Kedua menyatakan telah menerima hasil pekerjaan tersebut dalam keadaan baik dan sesuai kesepakatan, dan kedua belah pihak sepakat bahwa pekerjaan telah diserahterimakan.'),
  )
}

export function uatContent(d: ProjectDocData, no: string): DocNode {
  const today = todayISO()
  const open = d.bugs.filter(b => b.status !== 'selesai')
  const finished = d.bugs.filter(b => b.status === 'selesai')
  const openSerious = open.filter(b => b.severity === 'kritis' || b.severity === 'tinggi')
  const verdict = !open.length ? 'LULUS' : openSerious.length ? 'BELUM LULUS' : 'LULUS BERSYARAT'
  const verdictText = verdict === 'LULUS'
    ? 'Seluruh temuan yang tercatat telah diselesaikan.'
    : verdict === 'BELUM LULUS'
      ? `Masih terdapat ${openSerious.length} temuan berkeparahan kritis/tinggi yang belum diselesaikan.`
      : `Masih terdapat ${open.length} temuan berkeparahan sedang/rendah yang belum diselesaikan; tidak ada temuan kritis/tinggi.`
  const bugRows = (rows: typeof d.bugs) => rows.map(b => [b.code, b.title + (b.module ? ` (${b.module})` : ''), SEV_LABEL[b.severity], BUG_LABEL[b.status]])
  return doc(
    h(1, 'LAPORAN USER ACCEPTANCE TEST'),
    p(`Nomor: ${no}`),
    infoTable([
      ['Proyek', d.project.name],
      ['Klien', d.client?.name ?? '—'],
      ['Tanggal laporan', dateLongId(today)],
      ['Total temuan', `${d.bugs.length} (${finished.length} selesai, ${open.length} terbuka)`],
    ]),
    h(2, 'Ringkasan per keparahan'),
    table(['Keparahan', 'Total', 'Selesai', 'Terbuka'], SEV_ORDER.map((s) => {
      const all = d.bugs.filter(b => b.severity === s)
      const fin = all.filter(b => b.status === 'selesai').length
      return [SEV_LABEL[s], String(all.length), String(fin), String(all.length - fin)]
    })),
    h(2, 'Temuan yang belum selesai'),
    open.length ? table(['Kode', 'Temuan', 'Keparahan', 'Status'], bugRows(open)) : p('Tidak ada temuan terbuka.'),
    ...(finished.length ? [h(2, 'Temuan yang telah diselesaikan'), table(['Kode', 'Temuan', 'Keparahan', 'Status'], bugRows(finished))] : []),
    h(2, 'Kesimpulan'),
    p(text(verdict, true), `  ${verdictText}`),
    p('Kesimpulan ini dihasilkan otomatis dari status temuan di sistem dan perlu dikonfirmasi oleh kedua belah pihak.'),
  )
}

export function kontrakContent(d: ProjectDocData, business: BusinessProfile, no: string): DocNode {
  const today = todayISO()
  const start = d.project.startDate ? dateId(d.project.startDate) : '[tanggal mulai]'
  const end = d.project.targetDate ? dateId(d.project.targetDate) : '[tanggal selesai]'
  const scope = d.milestones.length ? ol(d.milestones.map(m => m.name)) : p('[Uraikan ruang lingkup pekerjaan]')
  const termRows = d.terms.map(t => [t.name, percent(t.percent), rupiah(t.amount), t.dueDate ? dateId(t.dueDate) : '—'])
  return doc(
    h(1, 'PERJANJIAN KERJA PENGEMBANGAN PERANGKAT LUNAK'),
    p(`Nomor: ${no}`),
    p(DRAFT_NOTE),
    p(`Pada hari ini, ${dateLongId(today)}, kami yang bertanda tangan di bawah ini:`),
    infoTable([
      ['Pihak Pertama (penyedia)', business.name],
      ['Diwakili oleh', [business.signerName, business.signerTitle].filter(Boolean).join(', ') || '[nama dan jabatan]'],
      ['Alamat', business.address || '[alamat]'],
    ]),
    infoTable([
      ['Pihak Kedua (klien)', d.client?.name ?? '[nama klien]'],
      ['Diwakili oleh', d.client?.contactName || '[nama dan jabatan]'],
      ['Alamat', d.client?.address || '[alamat]'],
    ]),
    p('Kedua belah pihak sepakat untuk mengikatkan diri dalam perjanjian kerja berikut, dengan ketentuan sebagai berikut.'),
    h(2, 'Pasal 1 – Ruang Lingkup Pekerjaan'),
    p(`Pihak Pertama mengerjakan proyek "${d.project.name}"${d.project.stack ? ` dengan teknologi ${d.project.stack}` : ''}, yang meliputi tahapan berikut:`),
    scope,
    p('Pekerjaan di luar ruang lingkup di atas dibicarakan dan disepakati tertulis terlebih dahulu, dan dapat dikenakan biaya tambahan.'),
    h(2, 'Pasal 2 – Jangka Waktu'),
    p(`Pekerjaan dilaksanakan sejak ${start} sampai dengan ${end}. Perubahan jadwal akibat keterlambatan masukan, materi, atau persetujuan dari Pihak Kedua tidak dihitung sebagai keterlambatan Pihak Pertama.`),
    h(2, 'Pasal 3 – Nilai Kontrak dan Pembayaran'),
    p(`Nilai pekerjaan adalah ${rupiah(d.project.contractValue)} (${terbilang(d.project.contractValue)} rupiah). Pembayaran dilakukan bertahap sebagai berikut:`),
    termRows.length ? table(['Termin', 'Persen', 'Nominal', 'Jatuh tempo'], termRows) : p('[Uraikan jadwal pembayaran]'),
    p('Pembayaran dilakukan melalui transfer ke rekening Pihak Pertama sesuai invoice yang diterbitkan. Keterlambatan pembayaran dapat menunda pengerjaan tahap berikutnya.'),
    h(2, 'Pasal 4 – Kewajiban Pihak Pertama'),
    ul(['Mengerjakan pekerjaan sesuai ruang lingkup, jadwal, dan standar mutu yang wajar.', 'Memberi laporan kemajuan pekerjaan secara berkala.', 'Menyerahkan hasil pekerjaan dan dokumentasi yang disepakati pada saat serah terima.']),
    h(2, 'Pasal 5 – Kewajiban Pihak Kedua'),
    ul(['Menyediakan data, materi, akses, dan masukan yang dibutuhkan tepat waktu.', 'Memberi persetujuan atau umpan balik atas hasil pekerjaan dalam waktu yang wajar.', 'Melakukan pembayaran sesuai Pasal 3.']),
    h(2, 'Pasal 6 – Revisi dan Perubahan'),
    p('Revisi kecil dalam ruang lingkup yang disepakati termasuk dalam nilai kontrak sebanyak [jumlah] kali putaran. Perubahan atau penambahan fitur di luar ruang lingkup diperlakukan sebagai pekerjaan tambahan.'),
    h(2, 'Pasal 7 – Serah Terima dan Garansi'),
    p('Penyerahan hasil pekerjaan dibuktikan dengan Berita Acara Serah Terima. Pihak Pertama memberi garansi perbaikan kesalahan (bug) selama [jumlah] hari sejak serah terima tanpa biaya tambahan. Garansi tidak mencakup perubahan fitur baru atau kerusakan akibat perubahan pihak lain.'),
    h(2, 'Pasal 8 – Hak Kekayaan Intelektual'),
    p('Hak atas kode sumber dan hasil pekerjaan khusus untuk proyek ini beralih kepada Pihak Kedua setelah seluruh pembayaran dilunasi. Pihak Pertama tetap berhak atas pustaka, perangkat, dan komponen umum yang dimilikinya sebelum atau di luar proyek ini. [Sesuaikan bila berbeda.]'),
    h(2, 'Pasal 9 – Kerahasiaan'),
    p('Kedua belah pihak menjaga kerahasiaan informasi yang diperoleh selama pelaksanaan perjanjian dan tidak mengungkapkannya kepada pihak ketiga tanpa persetujuan tertulis, kecuali diwajibkan oleh hukum.'),
    h(2, 'Pasal 10 – Pengakhiran Perjanjian'),
    p('Perjanjian dapat diakhiri atas kesepakatan bersama, atau oleh salah satu pihak bila pihak lain melanggar ketentuan secara material dan tidak memperbaikinya dalam [jumlah] hari setelah diberi peringatan tertulis. Pekerjaan yang telah dilaksanakan hingga saat pengakhiran tetap dibayar secara proporsional.'),
    h(2, 'Pasal 11 – Penyelesaian Perselisihan'),
    p('Perselisihan diselesaikan secara musyawarah untuk mufakat. Bila tidak tercapai, kedua pihak memilih penyelesaian melalui [pengadilan/lembaga yang disepakati] di [kota].'),
    h(2, 'Pasal 12 – Penutup'),
    p('Perjanjian ini dibuat dalam dua rangkap bermeterai cukup, masing-masing mempunyai kekuatan hukum yang sama, dan mulai berlaku sejak ditandatangani oleh kedua belah pihak.'),
  )
}

export function spesifikasiContent(d: ProjectDocData, no: string): DocNode {
  const period = [d.project.startDate ? dateId(d.project.startDate) : null, d.project.targetDate ? dateId(d.project.targetDate) : null].filter(Boolean).join(' – ') || '—'
  return doc(
    h(1, 'DOKUMEN SPESIFIKASI KEBUTUHAN'),
    p(`Nomor: ${no}`),
    p(DRAFT_NOTE),
    infoTable([
      ['Proyek', d.project.name],
      ['Klien', d.client?.name ?? '—'],
      ['Teknologi', d.project.stack || '[teknologi]'],
      ['Periode', period],
      ['Penanggung jawab', d.pic?.name ?? '—'],
      ['Tanggal dokumen', dateLongId(todayISO())],
      ['Versi', '1.0'],
    ]),
    h(2, '1. Latar Belakang dan Tujuan'),
    p(d.project.description?.trim() || '[Jelaskan latar belakang proyek dan masalah yang ingin diselesaikan.]'),
    p('Tujuan: [tuliskan tujuan yang ingin dicapai].'),
    h(2, '2. Ruang Lingkup'),
    p('Pekerjaan yang termasuk dalam proyek ini:'),
    d.milestones.length ? ul(d.milestones.map(m => m.name)) : p('[Uraikan ruang lingkup pekerjaan]'),
    p('Di luar ruang lingkup: [tuliskan hal yang tidak termasuk].'),
    h(2, '3. Pengguna dan Peran'),
    table(['Peran pengguna', 'Deskripsi', 'Hak akses utama'], [['[Mis. Admin]', '[Deskripsi]', '[Hak akses]'], ['[Mis. Operator]', '[Deskripsi]', '[Hak akses]']]),
    h(2, '4. Kebutuhan Fungsional'),
    table(['Kode', 'Modul / fitur', 'Deskripsi kebutuhan', 'Prioritas'], [['FR-01', '[Modul]', '[Apa yang harus bisa dilakukan sistem]', 'Tinggi'], ['FR-02', '[Modul]', '[Deskripsi]', 'Sedang'], ['FR-03', '[Modul]', '[Deskripsi]', 'Rendah']]),
    h(2, '5. Kebutuhan Non-Fungsional'),
    ul(['Kinerja: [mis. halaman utama termuat di bawah 3 detik].', 'Keamanan: [mis. login berbasis peran, data tersimpan terenkripsi].', 'Kompatibilitas: [mis. browser dan perangkat yang didukung].', 'Ketersediaan dan pencadangan: [mis. cadangan harian].']),
    h(2, '6. Jadwal Pengerjaan'),
    d.milestones.length
      ? table(['No', 'Tahapan', 'Target'], d.milestones.map((m, i) => [String(i + 1), m.name, m.targetDate ? dateId(m.targetDate) : '—']))
      : p('[Uraikan jadwal pengerjaan]'),
    h(2, '7. Tim Proyek'),
    d.members.length ? table(['Nama', 'Peran'], d.members.map(m => [m.name, m.role || '—'])) : p('[Daftar tim proyek]'),
    h(2, '8. Asumsi dan Batasan'),
    ul(['[Asumsi 1]', '[Batasan 1]']),
    h(2, '9. Kriteria Penerimaan'),
    ul(['Seluruh kebutuhan fungsional berprioritas tinggi berfungsi sesuai spesifikasi.', 'Tidak ada temuan UAT berkeparahan kritis atau tinggi yang belum diselesaikan.', 'Hasil pekerjaan diserahterimakan melalui Berita Acara Serah Terima.']),
  )
}

/** Buat dokumen otomatis dari data proyek; tersimpan sebagai Draf dan langsung bisa diedit. */
export async function generateProjectDoc(projectId: number, type: GeneratableDoc, userId: number) {
  const d = await loadProjectDocData(projectId)
  const business = await getSetting('business')
  const year = todayISO().slice(0, 4)
  const existing = await useDB().select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.projectId, projectId))
  const prefix = { BAST: 'BAST', 'Laporan UAT': 'UAT', Kontrak: 'KTR', Spesifikasi: 'SPK' }[type]
  const no = `${prefix}/${projectId}/${year}-${existing.length + 1}`
  const content = type === 'BAST' ? bastContent(d, business, no) : type === 'Laporan UAT' ? uatContent(d, no) : type === 'Kontrak' ? kontrakContent(d, business, no) : spesifikasiContent(d, no)
  const name = `${type} - ${d.project.name} (${dateId(todayISO())})`.slice(0, 200)
  const [row] = await useDB().insert(schema.documents).values({ projectId, name, type, status: 'draf', content: content as unknown as Record<string, unknown>, docNumber: no, createdBy: userId }).returning()
  return { row: row!, projectName: d.project.name }
}
