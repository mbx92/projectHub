/** Saldo awal kas OCN (dipakai saat impor data dari Excel). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const body = await readBodyWith(event, z.object({ date: zDate, amount: z.coerce.number().int(), description: zOptText(300) }))
  const db = useDB()
  await addLedger(db, {
    date: body.date, type: body.amount >= 0 ? 'masuk' : 'keluar', amount: Math.abs(body.amount), refType: 'saldo_awal', refId: null,
    description: body.description || 'Saldo awal kas OCN',
  }, me.id)
  await logAudit(db, me.id, 'buat', 'cash_ledger', null, null, body)
  return { ok: true }
})
