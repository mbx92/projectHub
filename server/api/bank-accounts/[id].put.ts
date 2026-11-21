import { eq, ne } from 'drizzle-orm'
import { bankSchema } from './index.post'

export default defineEventHandler(async (event) => {
  requireAccess(event, 'pengaturan', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, bankSchema)
  const db = useDB()
  const [row] = await db.update(schema.bankAccounts).set(body).where(eq(schema.bankAccounts.id, id)).returning()
  if (!row) notFound('Rekening')
  if (body.isDefault) await db.update(schema.bankAccounts).set({ isDefault: false }).where(ne(schema.bankAccounts.id, id))
  return row
})
