/**
 * Perhitungan keuangan bersama untuk Dashboard, Pembayaran, dan Laporan — satu sumber angka,
 * sehingga untuk periode yang sama hasilnya selalu sama.
 *
 * Definisi:
 *  - Pendapatan (basis kas)  = jumlah pembayaran klien yang diterima pada periode.
 *  - Pengeluaran proyek      = pengeluaran non-aset pada periode (aset tidak mengurangi laba).
 *  - Laba bersih             = pendapatan − pengeluaran proyek.
 *  - Piutang                 = semua termin belum lunas (sisa invoice terkirim, atau nominal termin bila belum ditagih).
 */
import { sql, type SQL } from 'drizzle-orm'

export interface Period { from?: string | null, to?: string | null }

function between(col: string, p: Period): SQL {
  const parts: SQL[] = [sql`true`]
  if (p.from) parts.push(sql`${sql.raw(col)} >= ${p.from}`)
  if (p.to) parts.push(sql`${sql.raw(col)} <= ${p.to}`)
  return sql.join(parts, sql` and `)
}

function inProjects(col: string, ids: number[] | null): SQL {
  if (ids === null) return sql`true`
  if (!ids.length) return sql`false`
  return sql`${sql.raw(col)} in (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`
}

async function rows<T>(q: SQL): Promise<T[]> {
  const r = await useDB().execute(q)
  return r.rows as T[]
}

export interface ProjectPnL {
  projectId: number
  name: string
  clientName: string | null
  status: ProjectStatus
  contractValue: number
  revenue: number
  expenses: number
  assets: number
  profit: number
  margin: number
  distributed: number
  undistributed: number
  capitalPct: number
  workerPct: number
  cashPct: number
}

export async function projectPnL(period: Period, ids: number[] | null, includeArchived = true): Promise<ProjectPnL[]> {
  const list = await rows<any>(sql`
    select p.id, p.name, c.name as client_name, p.status, p.nilai_kontrak, p.persen_modal, p.persen_pekerja, p.persen_kas,
      coalesce((select sum(pay.nominal) from payments pay join invoices i on i.id = pay.invoice_id
                where i.project_id = p.id and ${between('pay.tanggal', period)}), 0) as revenue,
      coalesce((select sum(e.nominal) from expenses e where e.project_id = p.id and not e.adalah_aset and ${between('e.tanggal', period)}), 0) as expenses,
      coalesce((select sum(e.nominal) from expenses e where e.project_id = p.id and e.adalah_aset and ${between('e.tanggal', period)}), 0) as assets,
      coalesce((select sum(d.laba_bersih) from distributions d where d.project_id = p.id and ${between('d.tanggal', period)}), 0) as distributed
    from projects p left join clients c on c.id = p.client_id
    where ${inProjects('p.id', ids)} ${includeArchived ? sql`` : sql`and not p.diarsipkan`}
    order by p.name`)
  return list.map((r) => {
    const revenue = Number(r.revenue), expenses = Number(r.expenses), distributed = Number(r.distributed)
    const profit = revenue - expenses
    return {
      projectId: r.id, name: r.name, clientName: r.client_name, status: r.status,
      contractValue: Number(r.nilai_kontrak), revenue, expenses, assets: Number(r.assets), profit,
      margin: revenue > 0 ? Math.round(profit / revenue * 100) : 0,
      distributed, undistributed: Math.max(0, profit - distributed),
      capitalPct: Number(r.persen_modal), workerPct: Number(r.persen_pekerja), cashPct: Number(r.persen_kas),
    }
  })
}

/** Laba bersih sepanjang waktu satu proyek dan bagian yang belum dibagi. */
export async function projectProfitAllTime(projectId: number) {
  const [r] = await projectPnL({}, [projectId])
  return r ?? null
}

export async function expensesByCategory(period: Period, ids: number[] | null, includeUnassigned = true) {
  const scope = ids === null
    ? sql`true`
    : includeUnassigned ? sql`(${inProjects('e.project_id', ids)} or e.project_id is null)` : inProjects('e.project_id', ids)
  const list = await rows<any>(sql`
    select e.kategori as category, e.adalah_aset as is_asset, sum(e.nominal) as total, count(*) as n
    from expenses e where ${scope} and ${between('e.tanggal', period)}
    group by e.kategori, e.adalah_aset order by total desc`)
  return list.map(r => ({ category: r.category as string, isAsset: !!r.is_asset, total: Number(r.total), count: Number(r.n) }))
}

/** Arus kas bulanan: pemasukan = pembayaran klien, pengeluaran = semua pengeluaran (termasuk aset). */
export async function cashflowMonthly(period: Period, ids: number[] | null) {
  const inc = await rows<any>(sql`
    select to_char(pay.tanggal, 'YYYY-MM') as m, sum(pay.nominal) as v
    from payments pay join invoices i on i.id = pay.invoice_id
    where ${inProjects('i.project_id', ids)} and ${between('pay.tanggal', period)} group by 1`)
  const out = await rows<any>(sql`
    select to_char(e.tanggal, 'YYYY-MM') as m, sum(e.nominal) as v
    from expenses e where ${ids === null ? sql`true` : sql`(${inProjects('e.project_id', ids)} or e.project_id is null)`} and ${between('e.tanggal', period)} group by 1`)
  const map = new Map<string, { month: string, income: number, expense: number }>()
  for (const r of inc) map.set(r.m, { month: r.m, income: Number(r.v), expense: 0 })
  for (const r of out) {
    const cur = map.get(r.m) ?? { month: r.m, income: 0, expense: 0 }
    cur.expense = Number(r.v)
    map.set(r.m, cur)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export interface ReceivableRow {
  termId: number
  invoiceId: number | null
  number: string | null
  projectId: number
  projectName: string
  clientName: string | null
  termName: string | null
  issueDate: string | null
  dueDate: string
  total: number
  paid: number
  outstanding: number
  daysOverdue: number
  bucket: 'belum_jatuh_tempo' | '1_30' | '31_60' | '61_90' | '90_plus'
}

/**
 * Piutang = semua termin yang belum lunas di proyek yang tidak diarsipkan.
 *  - Termin dengan invoice Terkirim: sisa = total invoice − pembayaran, umur dihitung dari jatuh tempo invoice.
 *  - Termin yang belum ditagih / masih draf: sisa = nominal termin, dihitung "belum jatuh tempo".
 */
export async function receivables(ids: number[] | null, asOf = todayISO()): Promise<ReceivableRow[]> {
  const list = await rows<any>(sql`
    select t.id as term_id, t.name as term_name, t.nominal, t.jatuh_tempo as term_due, t.project_id,
      p.name as project_name, c.name as client_name,
      i.id as invoice_id, i.nomor, i.terbit, i.jatuh_tempo as inv_due, i.total, i.status as inv_status,
      coalesce((select sum(nominal) from payments where invoice_id = i.id), 0) as paid
    from terms t join projects p on p.id = t.project_id
    left join clients c on c.id = p.client_id
    left join lateral (
      select * from invoices where term_id = t.id and status <> 'batal' order by id desc limit 1
    ) i on true
    where t.status <> 'lunas' and not p.diarsipkan and ${inProjects('t.project_id', ids)}
    order by coalesce(i.jatuh_tempo, t.jatuh_tempo) nulls last`)
  return list.map((r): ReceivableRow => {
    const sent = r.inv_status === 'terkirim'
    const total = sent ? Number(r.total) : Number(r.nominal)
    const paid = sent ? Number(r.paid) : 0
    const due = (sent ? r.inv_due : r.term_due) as string | null
    const daysOverdue = sent && due ? Math.max(0, daysBetween(due, asOf)) : 0
    const bucket = daysOverdue === 0 ? 'belum_jatuh_tempo' : daysOverdue <= 30 ? '1_30' : daysOverdue <= 60 ? '31_60' : daysOverdue <= 90 ? '61_90' : '90_plus'
    return {
      termId: r.term_id, invoiceId: r.invoice_id ?? null, number: r.nomor ?? null, projectId: r.project_id, projectName: r.project_name,
      clientName: r.client_name, termName: r.term_name, issueDate: r.terbit ?? null, dueDate: due ?? '', total, paid,
      outstanding: total - paid, daysOverdue, bucket,
    }
  }).filter(r => r.outstanding > 0)
}

export const AGING_LABEL: Record<ReceivableRow['bucket'], string> = {
  belum_jatuh_tempo: 'Belum jatuh tempo', '1_30': '1–30 hari', '31_60': '31–60 hari', '61_90': '61–90 hari', '90_plus': '> 90 hari',
}

export async function capitalSummary(investorId?: number | null) {
  const [r] = await rows<any>(sql`
    select coalesce(sum(nominal), 0) as total, count(*) as n, min(tanggal) as first_date
    from capital_deposits ${investorId ? sql`where investor_id = ${investorId}` : sql``}`)
  return { total: Number(r?.total ?? 0), count: Number(r?.n ?? 0), firstDate: (r?.first_date as string | null) ?? null }
}

/** Porsi modal tiap investor aktif = setoran investor / total setoran investor aktif. */
export async function capitalPortions() {
  const list = await rows<any>(sql`
    select inv.id as investor_id, inv.user_id, u.name, inv.status, coalesce(sum(cd.nominal), 0) as capital
    from investors inv join users u on u.id = inv.user_id
    left join capital_deposits cd on cd.investor_id = inv.id
    group by inv.id, inv.user_id, u.name, inv.status order by capital desc`)
  const activeTotal = list.filter(r => r.status === 'aktif').reduce((a, r) => a + Number(r.capital), 0)
  return list.map(r => ({
    investorId: r.investor_id as number, userId: r.user_id as number, name: r.name as string, status: r.status as 'aktif' | 'calon',
    capital: Number(r.capital),
    portion: r.status === 'aktif' && activeTotal > 0 ? Math.round(Number(r.capital) / activeTotal * 10000) / 100 : 0,
  }))
}

export async function distributionTotals(userId?: number | null, period: Period = {}) {
  const [r] = await rows<any>(sql`
    select coalesce(sum(dl.nominal), 0) as total, count(distinct dl.distribution_id) as n
    from distribution_lines dl join distributions d on d.id = dl.distribution_id
    where dl.bagian = 'modal' ${userId ? sql`and dl.penerima = ${userId}` : sql``} and ${between('d.tanggal', period)}`)
  return { total: Number(r?.total ?? 0), count: Number(r?.n ?? 0) }
}

/** Ringkasan pembayaran per proyek (nilai kontrak, sudah dibayar, sisa) — dipakai daftar proyek & dashboard. */
export async function projectPaymentTotals(ids: number[] | null) {
  const list = await rows<any>(sql`
    select p.id,
      coalesce((select sum(pay.nominal) from payments pay join invoices i on i.id = pay.invoice_id where i.project_id = p.id), 0) as paid,
      coalesce((select count(*) from bugs b where b.project_id = p.id and b.status <> 'selesai'), 0) as open_bugs,
      coalesce((select count(*) from bugs b where b.project_id = p.id and b.status <> 'selesai' and b.keparahan = 'kritis'), 0) as critical_bugs
    from projects p where ${inProjects('p.id', ids)}`)
  return new Map(list.map(r => [r.id as number, { paid: Number(r.paid), openBugs: Number(r.open_bugs), criticalBugs: Number(r.critical_bugs) }]))
}

/** Periode dari query string: preset (6m, ytd, year:2026, month:2026-11, q:2026-4, all) atau from/to. */
export function parsePeriod(q: Record<string, any>): Period & { label: string } {
  const today = todayISO()
  const preset = String(q.period || '')
  if (q.from || q.to) return { from: q.from || null, to: q.to || null, label: `${dateId(q.from)} – ${dateId(q.to)}` }
  if (preset === 'all' || !preset) return { from: null, to: null, label: 'Semua waktu' }
  if (preset === '6m') {
    const [y, m] = today.split('-').map(Number)
    const d = new Date(Date.UTC(y!, m! - 6, 1))
    return { from: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`, to: today, label: '6 bulan terakhir' }
  }
  const year = preset.match(/^year:(\d{4})$/)
  if (year) return { from: `${year[1]}-01-01`, to: `${year[1]}-12-31`, label: `Tahun ${year[1]}` }
  const month = preset.match(/^month:(\d{4})-(\d{2})$/)
  if (month) {
    const last = new Date(Date.UTC(Number(month[1]), Number(month[2]), 0)).getUTCDate()
    return { from: `${month[1]}-${month[2]}-01`, to: `${month[1]}-${month[2]}-${last}`, label: monthLabel(`${month[1]}-${month[2]}`, true) }
  }
  const quarter = preset.match(/^q:(\d{4})-([1-4])$/)
  if (quarter) {
    const qn = Number(quarter[2])
    const sm = (qn - 1) * 3 + 1
    const last = new Date(Date.UTC(Number(quarter[1]), sm + 2, 0)).getUTCDate()
    return { from: `${quarter[1]}-${String(sm).padStart(2, '0')}-01`, to: `${quarter[1]}-${String(sm + 2).padStart(2, '0')}-${last}`, label: `Kuartal ${qn} ${quarter[1]}` }
  }
  return { from: null, to: null, label: 'Semua waktu' }
}
