/** Aktifkan draf template (ditolak bila validasi masih punya error). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const ref = await activateDraft(kindParam(event), me.id)
  return { active: ref }
})
