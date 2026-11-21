/** Dashboard Investor (Investor: data sendiri; Admin: gabungan). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'laporan', 'lihat')
  return buildDashboard(me, parsePeriod({ period: '6m', ...getQuery(event) }))
})
