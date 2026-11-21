import { eq } from 'drizzle-orm'

/** Rekening yang sudah dipakai invoice hanya dinonaktifkan, tidak dihapus. */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'pengaturan', 'kelola')
  const id = idParam(event)
  const db = useDB()
  const used = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.bankAccountId, id)).limit(1)
  if (used.length) await db.update(schema.bankAccounts).set({ active: false, isDefault: false }).where(eq(schema.bankAccounts.id, id))
  else await db.delete(schema.bankAccounts).where(eq(schema.bankAccounts.id, id))
  return { ok: true, deactivated: !!used.length }
})
