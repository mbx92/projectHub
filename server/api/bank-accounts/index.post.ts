import { ne } from 'drizzle-orm'

export const bankSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountNumber: z.string().trim().min(3).max(60),
  accountName: z.string().trim().min(2).max(120),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const body = await readBodyWith(event, bankSchema)
  const db = useDB()
  const existing = await db.select({ id: schema.bankAccounts.id }).from(schema.bankAccounts).limit(1)
  const isDefault = body.isDefault || !existing.length
  const [row] = await db.insert(schema.bankAccounts).values({ ...body, isDefault, createdBy: me.id }).returning()
  if (isDefault) await db.update(schema.bankAccounts).set({ isDefault: false }).where(ne(schema.bankAccounts.id, row!.id))
  return row
})
