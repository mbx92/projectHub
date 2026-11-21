/** Matriks hak akses per peran (khusus admin). */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return { matrix: await getAccessMatrix(), defaults: DEFAULT_ACCESS, admin: FULL_ACCESS }
})
