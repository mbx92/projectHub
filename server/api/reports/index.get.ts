export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'laporan', 'lihat')
  return buildReport(me, parsePeriod({ period: `year:${todayISO().slice(0, 4)}`, ...getQuery(event) }))
})
