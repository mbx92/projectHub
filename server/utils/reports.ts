/** Data laporan & dashboard — semua angka diambil dari util finance yang sama. */
import { sql } from 'drizzle-orm'

export async function buildDashboard(me: SessionUser, period: Period & { label: string }) {
  const ids = await accessibleProjectIds(me)
  // Tanpa akses lihat semua Investor & Modal: angka modal & bagi hasil hanya milik sendiri.
  const isInvestor = !can(me, 'investor', 'lihat')
  const [capitalAll, capitalMine, cash, payouts, flows, cats, pnl, totals] = await Promise.all([
    capitalSummary(null),
    isInvestor ? capitalSummary(me.investorId ?? -1) : capitalSummary(null),
    cashBalance(),
    distributionTotals(isInvestor ? me.id : null, period),
    cashflowMonthly(period, ids),
    expensesByCategory({}, ids),
    projectPnL({}, ids, false),
    projectPaymentTotals(ids),
  ])
  // Proyek yang didanai modal investor (persen modal > 0). Untuk investor, `ids` sudah terbatas ke proyek ini.
  const funded = pnl.filter(p => p.capitalPct > 0)
  const active = funded.filter(p => p.status === 'berjalan' || p.status === 'persiapan')
  const progress = await useDB().execute(sql`select id, progress from projects`)
  const progMap = new Map((progress.rows as any[]).map(r => [r.id as number, Number(r.progress)]))

  // Penggunaan modal: pengeluaran per kategori (aset ditampilkan terpisah) + kas yang belum terpakai.
  const expenseCats = cats.filter(c => !c.isAsset)
  const assetTotal = cats.filter(c => c.isAsset).reduce((a, c) => a + c.total, 0)
  const top = expenseCats.slice(0, 3)
  const rest = expenseCats.slice(3).reduce((a, c) => a + c.total, 0)
  const usage = [
    ...top.map(c => ({ label: c.category, amount: c.total })),
    ...(rest ? [{ label: 'Lainnya', amount: rest }] : []),
    ...(assetTotal ? [{ label: 'Aset perangkat', amount: assetTotal }] : []),
    { label: 'Belum terpakai (kas)', amount: Math.max(0, cash), unused: true },
  ]

  const dists = await useDB().execute(sql`
    select d.id, d.tanggal, d.laba_bersih, p.name as project_name,
      coalesce(sum(dl.nominal) filter (where dl.bagian = 'modal' ${isInvestor ? sql`and dl.penerima = ${me.id}` : sql``}), 0) as share
    from distributions d join projects p on p.id = d.project_id
    left join distribution_lines dl on dl.distribution_id = d.id
    where ${ids === null ? sql`true` : ids.length ? sql`d.project_id in (${sql.join(ids.map(i => sql`${i}`), sql`, `)})` : sql`false`}
    group by d.id, p.name order by d.tanggal desc, d.id desc limit 6`)

  const next = active.filter(p => p.undistributed > 0).sort((a, b) => b.undistributed - a.undistributed)[0]
    ?? active.sort((a, b) => (b.contractValue - b.revenue) - (a.contractValue - a.revenue))[0]

  const schemeRef = funded.find(p => p.capitalPct > 0) ?? null
  return {
    period,
    kpis: {
      capital: capitalMine.total,
      capitalCount: capitalMine.count,
      capitalSince: capitalMine.firstDate,
      totalCapital: capitalAll.total,
      activeContract: active.reduce((a, p) => a + p.contractValue, 0),
      activeCount: active.filter(p => p.status === 'berjalan').length,
      cash,
      cashPctOfCapital: capitalAll.total > 0 ? Math.round(Math.max(0, cash) / capitalAll.total * 100) : 0,
      payouts: payouts.total,
      payoutCount: payouts.count,
      payoutPctOfCapital: capitalMine.total > 0 ? Math.round(payouts.total / capitalMine.total * 100) : 0,
    },
    cashflow: flows,
    usage,
    projects: funded.map(p => ({
      id: p.projectId, name: p.name, client: p.clientName, status: p.status, progress: progMap.get(p.projectId) ?? 0,
      contractValue: p.contractValue, paid: totals.get(p.projectId)?.paid ?? 0, openBugs: totals.get(p.projectId)?.openBugs ?? 0,
    })),
    scheme: schemeRef ? { capitalPct: schemeRef.capitalPct, workerPct: schemeRef.workerPct, cashPct: schemeRef.cashPct } : null,
    distributions: (dists.rows as any[]).map((r): { id: number, date: string, project: string, netProfit: number, share: number } => ({ id: r.id, date: r.tanggal, project: r.project_name, netProfit: Number(r.laba_bersih), share: Number(r.share) })),
    next: next ? { project: next.name, undistributed: next.undistributed, remaining: next.contractValue - next.revenue } : null,
  }
}

export async function buildReport(me: SessionUser, period: Period & { label: string }) {
  const ids = await accessibleProjectIds(me)
  const [pnl, cats, rec, flows, capital, payouts] = await Promise.all([
    projectPnL(period, ids),
    expensesByCategory(period, ids),
    receivables(ids),
    cashflowMonthly(period, ids),
    capitalSummary(!can(me, 'investor', 'lihat') ? (me.investorId ?? -1) : null),
    distributionTotals(!can(me, 'investor', 'lihat') ? me.id : null, period),
  ])
  const rows = pnl.filter(p => p.revenue || p.expenses || p.status !== 'selesai')
  const revenue = rows.reduce((a, p) => a + p.revenue, 0)
  const expenses = rows.reduce((a, p) => a + p.expenses, 0)
  const unassigned = cats.filter(c => !c.isAsset).reduce((a, c) => a + c.total, 0) - expenses
  let bugs: { projectId: number, name: string, open: number, critical: number, done: number, avgDays: number | null, overdue: number }[] = []
  if (can(me, 'bug', 'lihat')) {
    const r = await useDB().execute(sql`
      select p.id, p.name,
        count(*) filter (where b.status <> 'selesai') as open,
        count(*) filter (where b.status <> 'selesai' and b.keparahan = 'kritis') as critical,
        count(*) filter (where b.status = 'selesai' ${period.from ? sql`and b.resolved_at >= ${period.from}::date` : sql``} ${period.to ? sql`and b.resolved_at < (${period.to}::date + 1)` : sql``}) as done,
        avg(extract(epoch from (b.resolved_at - b.created_at)) / 86400) filter (where b.status = 'selesai') as avg_days,
        count(*) filter (where b.status <> 'selesai' and b.keparahan = 'kritis' and b.created_at < now() - interval '7 days') as overdue
      from projects p join bugs b on b.project_id = p.id
      where not p.diarsipkan and ${ids === null ? sql`true` : ids.length ? sql`p.id in (${sql.join(ids.map(i => sql`${i}`), sql`, `)})` : sql`false`}
      group by p.id, p.name order by open desc`)
    bugs = (r.rows as any[]).map(x => ({ projectId: x.id, name: x.name, open: Number(x.open), critical: Number(x.critical), done: Number(x.done), avgDays: x.avg_days == null ? null : Math.round(Number(x.avg_days) * 10) / 10, overdue: Number(x.overdue) }))
  }
  return {
    period,
    kpis: {
      revenue, expenses, profit: revenue - expenses, margin: revenue > 0 ? Math.round((revenue - expenses) / revenue * 100) : 0,
      receivables: rec.reduce((a, r) => a + r.outstanding, 0),
      assets: cats.filter(c => c.isAsset).reduce((a, c) => a + c.total, 0),
      unassignedExpenses: Math.max(0, unassigned),
      cash: await cashBalance(),
      capital: capital.total,
      payouts: payouts.total,
    },
    pnl: rows,
    categories: cats,
    receivables: rec,
    aging: (Object.keys(AGING_LABEL) as (keyof typeof AGING_LABEL)[]).map(b => ({ key: b, label: AGING_LABEL[b], amount: rec.filter(r => r.bucket === b).reduce((a, r) => a + r.outstanding, 0) })),
    cashflow: flows,
    bugs,
  }
}
