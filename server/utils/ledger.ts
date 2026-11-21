/** Mutasi kas OCN. Saldo berjalan dihitung ulang setelah setiap perubahan (urut tanggal, lalu id). */
import { and, eq, sql } from 'drizzle-orm'

interface LedgerEntry {
  date: string
  type: 'masuk' | 'keluar'
  amount: number
  refType: 'payment' | 'expense' | 'capital_deposit' | 'distribution' | 'saldo_awal'
  refId: number | null
  description: string
  projectId?: number | null
}

export async function addLedger(db: DB | Tx, entry: LedgerEntry, userId: number) {
  await db.insert(schema.cashLedger).values({ ...entry, projectId: entry.projectId ?? null, createdBy: userId })
  await recomputeBalances(db)
}

export async function removeLedger(db: DB | Tx, refType: string, refId: number) {
  await db.delete(schema.cashLedger).where(and(eq(schema.cashLedger.refType, refType), eq(schema.cashLedger.refId, refId)))
  await recomputeBalances(db)
}

export async function updateLedger(db: DB | Tx, refType: string, refId: number, patch: Partial<Pick<LedgerEntry, 'date' | 'amount' | 'description' | 'projectId'>>) {
  await db.update(schema.cashLedger).set(patch).where(and(eq(schema.cashLedger.refType, refType), eq(schema.cashLedger.refId, refId)))
  await recomputeBalances(db)
}

export async function recomputeBalances(db: DB | Tx) {
  await db.execute(sql`
    update cash_ledger c set saldo = s.running
    from (
      select id, sum(case when jenis = 'masuk' then nominal else -nominal end) over (order by tanggal, id) as running
      from cash_ledger
    ) s
    where c.id = s.id and c.saldo is distinct from s.running`)
}

export async function cashBalance(db: DB | Tx = useDB()): Promise<number> {
  const [row] = await db.select({ v: sql<number>`coalesce(sum(case when ${schema.cashLedger.type} = 'masuk' then ${schema.cashLedger.amount} else -${schema.cashLedger.amount} end), 0)::bigint` }).from(schema.cashLedger)
  return Number(row?.v ?? 0)
}
