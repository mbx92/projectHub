/** Kembali ke layout bawaan (hapus template aktif dan draf). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  await resetKind(kindParam(event), me.id)
  return { ok: true }
})
