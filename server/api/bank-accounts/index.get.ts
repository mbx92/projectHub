import { asc, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  if (!can(me, 'pengaturan', 'kelola') && !can(me, 'keuangan', 'lihat')) {
    throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses ke rekening.' })
  }
  return useDB().select().from(schema.bankAccounts).orderBy(desc(schema.bankAccounts.isDefault), asc(schema.bankAccounts.id))
})
