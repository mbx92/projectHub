import ExcelJS from 'exceljs'
import type { Content, TableCell } from 'pdfmake/interfaces'

/**
 * Ekspor laporan ke PDF / Excel. Angka identik dengan halaman Laporan untuk periode yang sama.
 *   ?type= keuangan | labarugi | neraca | aruskas | modal | bukukas | proyek | pengeluaran | piutang | investor | bug | lengkap
 *   &format= pdf | xlsx   &period= …
 */
type Col = { header: string, key: string, width: number, money?: boolean, right?: boolean }
type Section =
  | { kind: 'statement', st: Statement }
  | { kind: 'table', title: string, subtitle?: string, columns: Col[], rows: Record<string, unknown>[], footer?: Record<string, unknown> }

const TITLES: Record<string, string> = {
  keuangan: 'Laporan Keuangan', labarugi: 'Laporan Laba Rugi', neraca: 'Neraca', aruskas: 'Laporan Arus Kas', modal: 'Laporan Perubahan Ekuitas',
  bukukas: 'Buku Kas', proyek: 'Laba Rugi per Proyek', pengeluaran: 'Pengeluaran per Kategori', piutang: 'Rekap Piutang',
  investor: 'Laporan Investor', bug: 'Rekap Bug', lengkap: 'Laporan Lengkap',
}

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'laporan', 'lihat')
  const q = getQuery(event)
  const type = String(q.type || 'keuangan')
  if (!TITLES[type]) throw createError({ statusCode: 400, statusMessage: 'Jenis laporan tidak dikenal.' })
  const format = q.format === 'xlsx' ? 'xlsx' : 'pdf'
  const personal = !can(me, 'investor', 'lihat')
  if (type === 'bug' && !can(me, 'bug', 'lihat')) throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses ke rekap bug.' })
  if (type === 'bukukas' && !can(me, 'keuangan', 'lihat')) throw createError({ statusCode: 403, statusMessage: 'Buku kas butuh akses lihat Keuangan.' })

  const period = parsePeriod({ period: `year:${todayISO().slice(0, 4)}`, ...q })
  const business = await getSetting('business')
  const st = await buildStatements(me, period)
  const report = await buildReport(me, period)
  const title = TITLES[type]!
  const periodText = st.period.text

  // ── Bagian tabel ──
  const tProyek = (): Section => ({
    kind: 'table', title: 'Laba Rugi per Proyek', subtitle: `Basis kas · ${periodText}`,
    columns: [
      { header: 'Proyek', key: 'name', width: 34 }, { header: 'Pendapatan', key: 'revenue', width: 18, money: true },
      { header: 'Beban', key: 'expenses', width: 18, money: true }, { header: 'Laba Bersih', key: 'profit', width: 18, money: true },
      { header: 'Margin', key: 'margin', width: 9, right: true }, { header: 'Sudah Dibagi', key: 'distributed', width: 18, money: true },
    ],
    rows: report.pnl.map(p => ({ name: p.name, revenue: p.revenue, expenses: p.expenses, profit: p.profit, margin: `${p.margin}%`, distributed: p.distributed })),
    footer: { name: 'Total', revenue: report.kpis.revenue, expenses: report.kpis.expenses, profit: report.kpis.profit, margin: `${report.kpis.margin}%`, distributed: report.pnl.reduce((s, p) => s + p.distributed, 0) },
  })
  const tPengeluaran = (): Section => ({
    kind: 'table', title: 'Pengeluaran per Kategori', subtitle: periodText,
    columns: [{ header: 'Kategori', key: 'c', width: 32 }, { header: 'Jenis', key: 't', width: 12 }, { header: 'Transaksi', key: 'n', width: 11, right: true }, { header: 'Total', key: 'v', width: 18, money: true }],
    rows: report.categories.map(c => ({ c: c.category, t: c.isAsset ? 'Aset' : 'Beban', n: c.count, v: c.total })),
    footer: { c: 'Total', v: report.categories.reduce((s, c) => s + c.total, 0) },
  })
  const tPiutang = (): Section => ({
    kind: 'table', title: 'Rekap Piutang', subtitle: `Per ${dateLongId(todayISO())}`,
    columns: [
      { header: 'Proyek', key: 'p', width: 28 }, { header: 'Termin', key: 't', width: 18 }, { header: 'Invoice', key: 'i', width: 16 },
      { header: 'Jatuh Tempo', key: 'd', width: 14 }, { header: 'Umur', key: 'b', width: 16 }, { header: 'Sisa', key: 'v', width: 18, money: true },
    ],
    rows: report.receivables.map(r => ({ p: r.projectName, t: r.termName, i: r.number ?? 'belum ditagih', d: r.dueDate ? dateId(r.dueDate) : '—', b: AGING_LABEL[r.bucket], v: r.outstanding })),
    footer: { p: 'Total', v: report.kpis.receivables },
  })
  const tBug = (): Section => ({
    kind: 'table', title: 'Rekap Bug', subtitle: periodText,
    columns: [{ header: 'Proyek', key: 'p', width: 32 }, { header: 'Terbuka', key: 'o', width: 10, right: true }, { header: 'Kritis', key: 'c', width: 10, right: true }, { header: 'Selesai', key: 'd', width: 10, right: true }, { header: 'Rata-rata hari', key: 'a', width: 14, right: true }],
    rows: report.bugs.map(b => ({ p: b.name, o: b.open, c: b.critical, d: b.done, a: b.avgDays ?? '—' })),
  })
  const tBukuKas = async (): Promise<Section> => {
    const cb = await buildCashbook(period)
    return {
      kind: 'table', title: 'Buku Kas OCN', subtitle: `Periode ${periodText}`,
      columns: [
        { header: 'Tanggal', key: 'd', width: 13 }, { header: 'Keterangan', key: 'k', width: 44 }, { header: 'Jenis', key: 'j', width: 18 },
        { header: 'Debit (masuk)', key: 'db', width: 17, money: true }, { header: 'Kredit (keluar)', key: 'cr', width: 17, money: true }, { header: 'Saldo', key: 's', width: 17, money: true },
      ],
      rows: [
        { d: cb.from ? dateId(cb.from) : '', k: 'Saldo awal', j: '', db: null, cr: null, s: cb.opening },
        ...cb.lines.map(l => ({ d: dateId(l.date), k: l.description, j: CASHBOOK_LABEL[l.refType] ?? l.refType, db: l.debit || null, cr: l.credit || null, s: l.balance })),
      ],
      footer: { k: 'Total mutasi / saldo akhir', db: cb.totalDebit, cr: cb.totalCredit, s: cb.closing },
    }
  }
  const tDistribusi = async (): Promise<Section> => {
    const dists = await distributionsFor(me, period)
    return {
      kind: 'table', title: 'Distribusi Bagi Hasil', subtitle: periodText,
      columns: [
        { header: 'Tanggal', key: 'd', width: 13 }, { header: 'Proyek', key: 'p', width: 28 }, { header: 'Skema', key: 's', width: 20 },
        { header: 'Laba Bersih', key: 'l', width: 17, money: true }, { header: 'Modal', key: 'm', width: 16, money: true },
        { header: 'Pekerja', key: 'w', width: 16, money: true }, { header: personal ? 'Bagian Saya' : 'Kas', key: 'k', width: 16, money: true },
      ],
      rows: dists.map(d => ({ d: dateId(d.date), p: d.projectName, s: `${d.snapshot.schemeName} ${d.snapshot.capitalPct}/${d.snapshot.workerPct}/${d.snapshot.cashPct}`, l: d.netProfit, m: d.totals.modal, w: d.totals.pekerja, k: personal ? d.myShare : d.totals.kas })),
    }
  }
  const tModalInvestor = (): Section => ({
    kind: 'table', title: personal ? 'Modal & Bagi Hasil Anda' : 'Modal & Bagi Hasil Investor', subtitle: periodText,
    columns: [{ header: 'Keterangan', key: 'k', width: 40 }, { header: 'Jumlah', key: 'v', width: 20, money: true }],
    rows: [
      { k: 'Modal disetor', v: report.kpis.capital },
      { k: 'Bagi hasil bagian modal (periode)', v: report.kpis.payouts },
      { k: 'Saldo kas OCN saat ini', v: report.kpis.cash },
    ],
  })

  const S = (s: Statement): Section => ({ kind: 'statement', st: s })
  const statements = [S(st.labaRugi), S(st.neraca), S(st.arusKas), S(st.perubahanModal)]
  const sections: Section[] = {
    keuangan: () => statements,
    labarugi: () => [S(st.labaRugi)],
    neraca: () => [S(st.neraca)],
    aruskas: () => [S(st.arusKas)],
    modal: () => [S(st.perubahanModal)],
    bukukas: () => [],
    proyek: () => [tProyek()],
    pengeluaran: () => [tPengeluaran()],
    piutang: () => [tPiutang()],
    investor: () => [tModalInvestor(), S(st.labaRugi), S(st.arusKas), tProyek()],
    bug: () => [tBug()],
    lengkap: () => [...statements, tProyek(), tPengeluaran(), tPiutang(), ...(can(me, 'bug', 'lihat') ? [tBug()] : [])],
  }[type]!()
  if (type === 'bukukas') sections.push(await tBukuKas())
  if (type === 'investor') sections.push(await tDistribusi())
  if (type === 'lengkap' && can(me, 'keuangan', 'lihat')) sections.push(await tBukuKas())

  const fileBase = `${title} - ${period.label}`.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-')

  if (format === 'xlsx') {
    const buf = await toExcel(sections, business.name)
    setResponseHeaders(event, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fileBase}.xlsx"`, 'Cache-Control': 'no-store' })
    return buf
  }
  const pdf = await toPdf(sections, business, title, period.label)
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileBase}.pdf"`, 'Cache-Control': 'no-store' })
  return pdf
})

// ───────────────────────── Excel ─────────────────────────
const ACC_FMT = '"Rp" #,##0;("Rp" #,##0);"–"'

async function toExcel(sections: Section[], company: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = company
  const used = new Set<string>()
  const sheetName = (t: string) => {
    let name = t.replace(/[\\/?*[\]:]/g, '').slice(0, 28)
    let i = 2
    while (used.has(name)) name = `${t.slice(0, 25)} ${i++}`
    used.add(name)
    return name
  }
  for (const s of sections) {
    if (s.kind === 'statement') {
      const ws = wb.addWorksheet(sheetName(s.st.title), { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 58 }, { width: 22 }]
      const head = (text: string, size: number, bold = true) => {
        const r = ws.addRow([text])
        ws.mergeCells(r.number, 1, r.number, 2)
        r.getCell(1).font = { bold, size }
        r.getCell(1).alignment = { horizontal: 'center' }
      }
      head(company, 13)
      head(s.st.title, 12)
      head(s.st.subtitle, 10, false)
      ws.addRow([])
      for (const row of s.st.rows) {
        if (row.kind === 'spacer') { ws.addRow([]); continue }
        const r = ws.addRow([row.label, row.amount ?? null])
        const a = r.getCell(1), b = r.getCell(2)
        a.alignment = { indent: (row.indent ?? 0) * 2 }
        b.numFmt = ACC_FMT
        b.alignment = { horizontal: 'right' }
        if (row.kind === 'section' || row.kind === 'total' || row.kind === 'grand') a.font = { bold: true }
        if (row.kind === 'total' || row.kind === 'grand') b.font = { bold: true }
        if (row.kind === 'note') { a.font = { italic: true, color: { argb: 'FF475467' } }; b.font = { italic: true, color: { argb: 'FF475467' } } }
        if (row.kind === 'subtotal' || row.kind === 'total') b.border = { top: { style: 'thin' } }
        if (row.kind === 'grand') b.border = { top: { style: 'thin' }, bottom: { style: 'double' } }
      }
      if (s.st.check) {
        ws.addRow([])
        const r = ws.addRow([`${s.st.check.ok ? '✓' : '✗'} ${s.st.check.label}`])
        r.getCell(1).font = { italic: true, color: { argb: s.st.check.ok ? 'FF067647' : 'FFB42318' } }
      }
      for (const note of s.st.notes ?? []) {
        const r = ws.addRow([note])
        r.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF475467' } }
      }
    } else {
      const ws = wb.addWorksheet(sheetName(s.title))
      ws.columns = s.columns.map(c => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: ACC_FMT } : c.right ? { alignment: { horizontal: 'right' } } : {} }))
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }
      s.rows.forEach(r => ws.addRow(r))
      if (s.footer) {
        const r = ws.addRow(s.footer)
        r.font = { bold: true }
        r.eachCell(c => { c.border = { top: { style: 'thin' } } })
      }
      ws.views = [{ state: 'frozen', ySplit: 1 }]
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

// ───────────────────────── PDF ─────────────────────────
async function toPdf(sections: Section[], business: BusinessProfile, title: string, periodLabel: string) {
  const content: Content[] = []
  const many = sections.length > 1
  if (many) content.push(await letterhead(business, title.toUpperCase(), periodLabel))
  sections.forEach((s, idx) => {
    // Tiap laporan keuangan di halaman sendiri; tabel setelah laporan keuangan juga mulai di halaman baru.
    const breakBefore = idx > 0 && (s.kind === 'statement' || sections[idx - 1]?.kind === 'statement')
    if (s.kind === 'statement') content.push(...statementPdf(s.st, business.name, breakBefore))
    else content.push(...tablePdf(s, breakBefore))
  })
  content.push({ text: `Dibuat ${dateTimeId(new Date())} WITA dari OCN Project Hub.`, color: C.muted, fontSize: 8, margin: [0, 16, 0, 0] })
  return renderPdf({ content, footer: footer(`${business.name} · ${title} · ${periodLabel}`), info: { title: `${title} ${periodLabel}` } })
}

function statementPdf(st: Statement, company: string, pageBreak: boolean): Content[] {
  const body: TableCell[][] = st.rows.map((r) => {
    if (r.kind === 'spacer') return [{ text: ' ', fontSize: 5, border: [false, false, false, false] }, { text: '', border: [false, false, false, false] }]
    const bold = r.kind === 'section' || r.kind === 'total' || r.kind === 'grand'
    const topLine = r.kind === 'subtotal' || r.kind === 'total' || r.kind === 'grand'
    const color = r.kind === 'note' ? C.muted : C.ink
    return [
      { text: r.label, bold, color, italics: r.kind === 'note', margin: [(r.indent ?? 0) * 14, 1, 0, 1], border: [false, false, false, false] },
      {
        text: r.amount === undefined || r.amount === null ? '' : rupiahAcc(r.amount), alignment: 'right', bold: bold && r.kind !== 'section', color, italics: r.kind === 'note',
        border: [false, topLine, false, r.kind === 'grand'], borderColor: ['#101828', '#101828', '#101828', '#101828'],
        margin: [0, 1, 0, r.kind === 'grand' ? 2 : 1],
      },
    ]
  })
  const out: Content[] = [
    { stack: [
      { text: company, bold: true, fontSize: 12, alignment: 'center' },
      { text: st.title, bold: true, fontSize: 14, alignment: 'center', color: C.brand, margin: [0, 2, 0, 0] },
      { text: st.subtitle, alignment: 'center', color: C.muted, margin: [0, 2, 0, 14] },
    ], ...(pageBreak ? { pageBreak: 'before' as const } : {}) },
    { table: { widths: ['*', 140], body }, layout: { hLineWidth: (i: number, node: any) => (i === node.table.body.length ? 1.5 : 0.8), vLineWidth: () => 0, paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 0, paddingRight: () => 0 } },
  ]
  if (st.check) out.push({ text: `${st.check.ok ? '✓' : '✗'} ${st.check.label}`, color: st.check.ok ? '#067647' : C.danger, fontSize: 8.5, italics: true, margin: [0, 10, 0, 0] })
  for (const note of st.notes ?? []) out.push({ text: note, color: C.muted, fontSize: 8, italics: true, margin: [0, 3, 0, 0] })
  return out
}

function tablePdf(s: Extract<Section, { kind: 'table' }>, pageBreak: boolean): Content[] {
  const fmt = (c: Col, v: unknown): TableCell => ({ text: v === null || v === undefined ? '' : c.money ? rupiahAcc(Number(v)) : String(v), alignment: c.money || c.right ? 'right' : 'left' })
  const body: TableCell[][] = [
    s.columns.map(c => th(c.header, c.money || c.right ? 'right' : 'left')),
    ...s.rows.map(r => s.columns.map(c => fmt(c, r[c.key]))),
    ...(s.footer ? [s.columns.map(c => ({ ...(fmt(c, s.footer![c.key]) as object), bold: true }) as TableCell)] : []),
  ]
  if (!s.rows.length) body.push(s.columns.map((_, i) => (i === 0 ? { text: 'Tidak ada data', color: C.muted, italics: true } : { text: '' })))
  return [
    { stack: [{ text: s.title, bold: true, fontSize: 12 }, s.subtitle ? { text: s.subtitle, color: C.muted, fontSize: 8.5 } : { text: '' }], margin: [0, 14, 0, 6], ...(pageBreak ? { pageBreak: 'before' as const } : {}) },
    { table: { headerRows: 1, widths: s.columns.map((c, i) => (i === 0 || c.key === 'k' ? '*' : 'auto')), body }, layout: tableLayout(), fontSize: 8.5 },
  ]
}

async function distributionsFor(me: SessionUser, period: Period) {
  const { desc, eq, inArray } = await import('drizzle-orm')
  const ids = await accessibleProjectIds(me)
  const db = useDB()
  const dists = await db.select({ id: schema.distributions.id, projectName: schema.projects.name, date: schema.distributions.date, netProfit: schema.distributions.netProfit, snapshot: schema.distributions.schemeSnapshot })
    .from(schema.distributions).innerJoin(schema.projects, eq(schema.projects.id, schema.distributions.projectId))
    .where(projectScope(ids, schema.distributions.projectId)).orderBy(desc(schema.distributions.date))
  const lines = dists.length ? await db.select().from(schema.distributionLines).where(inArray(schema.distributionLines.distributionId, dists.map(d => d.id))) : []
  return dists
    .filter(d => (!period.from || d.date >= period.from) && (!period.to || d.date <= period.to))
    .map((d) => {
      const ls = lines.filter(l => l.distributionId === d.id)
      const totals = { modal: 0, pekerja: 0, kas: 0 }
      for (const l of ls) totals[l.part] += l.amount
      return { ...d, totals, myShare: ls.filter(l => l.recipientUserId === me.id).reduce((a, l) => a + l.amount, 0) }
    })
}
