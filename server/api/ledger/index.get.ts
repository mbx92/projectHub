import { and, desc, gte, lte } from 'drizzle-orm'

/** Mutasi kas OCN (Admin & Investor — investor melihat kas operasional). */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'keuangan', 'lihat')
  const period = parsePeriod(getQuery(event))
  const db = useDB()
  const rows = await db.select().from(schema.cashLedger)
    .where(and(period.from ? gte(schema.cashLedger.date, period.from) : undefined, period.to ? lte(schema.cashLedger.date, period.to) : undefined))
    .orderBy(desc(schema.cashLedger.date), desc(schema.cashLedger.id))
  return { rows, balance: await cashBalance() }
})
