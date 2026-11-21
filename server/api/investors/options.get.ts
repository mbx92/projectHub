/** Daftar ringkas investor untuk memilih investor pendana di form proyek (pengelola proyek). */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'proyek', 'kelola')
  const portions = await capitalPortions()
  return portions.map(p => ({ investorId: p.investorId, name: p.name, status: p.status, capital: p.capital }))
})
