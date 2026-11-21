/**
 * Dokumen proyek yang dibuat otomatis dari data sistem (BAST, Laporan UAT).
 * Isinya berupa dokumen JSON editor (TipTap/ProseMirror) yang bisa diedit di aplikasi;
 * kop dan footer dipasang saat tampil/ekspor, bukan bagian dari isi.
 */
import { eq, asc } from 'drizzle-orm'

export const GENERATABLE_DOCS = ['BAST', 'Laporan UAT'] as const
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
  return { project, client: client ?? null, pic: pic ?? null, milestones, bugs }
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
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content })

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

/** Buat dokumen otomatis dari data proyek; tersimpan sebagai Draf dan langsung bisa diedit. */
export async function generateProjectDoc(projectId: number, type: GeneratableDoc, userId: number) {
  const d = await loadProjectDocData(projectId)
  const business = await getSetting('business')
  const year = todayISO().slice(0, 4)
  const existing = await useDB().select({ id: schema.documents.id }).from(schema.documents).where(eq(schema.documents.projectId, projectId))
  const no = `${type === 'BAST' ? 'BAST' : 'UAT'}/${projectId}/${year}-${existing.length + 1}`
  const content = type === 'BAST' ? bastContent(d, business, no) : uatContent(d, no)
  const name = `${type} - ${d.project.name} (${dateId(todayISO())})`.slice(0, 200)
  const [row] = await useDB().insert(schema.documents).values({ projectId, name, type, status: 'draf', content: content as unknown as Record<string, unknown>, docNumber: no, createdBy: userId }).returning()
  return { row: row!, projectName: d.project.name }
}
