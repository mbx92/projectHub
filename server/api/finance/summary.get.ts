/** Ringkasan halaman Pembayaran: piutang + umur piutang, pemasukan/pengeluaran periode, saldo kas. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const period = parsePeriod(getQuery(event))
  const ids = await accessibleProjectIds(me)
  const [rec, pnl, cats, balance] = await Promise.all([
    receivables(ids),
    projectPnL(period, ids),
    expensesByCategory(period, ids),
    cashBalance(),
  ])
  const buckets = (Object.keys(AGING_LABEL) as (keyof typeof AGING_LABEL)[]).map(b => ({
    key: b, label: AGING_LABEL[b], amount: rec.filter(r => r.bucket === b).reduce((a, r) => a + r.outstanding, 0), count: rec.filter(r => r.bucket === b).length,
  }))
  const unassignedExpenses = cats.filter(c => !c.isAsset).reduce((a, c) => a + c.total, 0) - pnl.reduce((a, p) => a + p.expenses, 0)
  return {
    period,
    receivables: rec.reduce((a, r) => a + r.outstanding, 0),
    overdue: rec.filter(r => r.daysOverdue > 0).reduce((a, r) => a + r.outstanding, 0),
    overdueCount: rec.filter(r => r.daysOverdue > 0).length,
    aging: buckets,
    revenue: pnl.reduce((a, p) => a + p.revenue, 0),
    expenses: cats.reduce((a, c) => a + c.total, 0),
    projectExpenses: pnl.reduce((a, p) => a + p.expenses, 0),
    unassignedExpenses: Math.max(0, unassignedExpenses),
    assets: cats.filter(c => c.isAsset).reduce((a, c) => a + c.total, 0),
    balance,
  }
})
