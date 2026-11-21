/** Laporan keuangan (Laba Rugi, Neraca, Arus Kas, Perubahan Ekuitas) + Buku Kas bila punya akses lihat Keuangan. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'laporan', 'lihat')
  const period = parsePeriod({ period: `year:${todayISO().slice(0, 4)}`, ...getQuery(event) })
  const statements = await buildStatements(me, period)
  const cashbook = can(me, 'keuangan', 'lihat') ? await buildCashbook(period) : null
  return { ...statements, cashbook }
})
