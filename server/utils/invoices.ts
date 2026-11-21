import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'

export const invoiceInputSchema = z.object({
  termId: zId,
  issueDate: zDate,
  dueDate: zDate,
  items: z.array(z.object({
    description: z.string().trim().min(1, 'deskripsi item wajib diisi').max(500),
    qty: z.coerce.number().positive('qty harus lebih dari 0').max(100000),
    price: zMoney,
  })).min(1, 'minimal satu item'),
  discount: zMoney.default(0),
  taxPercent: zPct.default(0),
  notes: zOptText(2000),
  bankAccountId: zId.nullish().transform(v => v ?? null),
  showQris: z.boolean().default(false),
})

export async function loadInvoice(id: number) {
  const db = useDB()
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id))
  if (!inv) notFound('Invoice')
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, inv.projectId))
  const [client] = project?.clientId ? await db.select().from(schema.clients).where(eq(schema.clients.id, project.clientId)) : []
  const [term] = inv.termId ? await db.select().from(schema.terms).where(eq(schema.terms.id, inv.termId)) : []
  const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id)).orderBy(asc(schema.invoiceItems.sortOrder))
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.invoiceId, id)).orderBy(asc(schema.payments.date))
  const [bank] = inv.bankAccountId ? await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, inv.bankAccountId)) : []
  const paid = payments.reduce((a, p) => a + p.amount, 0)
  return {
    invoice: inv, project: project!, client: client ?? null, term: term ?? null, items, payments, bank: bank ?? null,
    paid, outstanding: Math.max(0, inv.total - paid),
    displayStatus: inv.status === 'terkirim' && inv.dueDate < todayISO() ? 'terlambat' as const : inv.status,
  }
}

export type LoadedInvoice = Awaited<ReturnType<typeof loadInvoice>>

/** loadInvoice + pastikan pengguna boleh mengakses proyek invoice tersebut. */
export async function loadInvoiceFor(me: SessionUser, id: number) {
  const data = await loadInvoice(id)
  await assertProjectAccess(me, data.project.id)
  return data
}

/** Simpan item + hitung ulang total (subtotal − diskon + pajak, dibulatkan ke rupiah). */
export async function writeInvoiceItems(tx: Tx, invoiceId: number, items: z.infer<typeof invoiceInputSchema>['items'], userId: number) {
  await tx.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, invoiceId))
  await tx.insert(schema.invoiceItems).values(items.map((it, i) => ({ invoiceId, description: it.description, qty: it.qty, price: it.price, sortOrder: i, createdBy: userId })))
}

/** Tandai invoice & termin lunas bila total pembayaran ≥ total invoice; sebaliknya kembalikan ke Terkirim. */
export async function syncPaidStatus(tx: Tx, invoiceId: number) {
  const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId))
  if (!inv) return
  const pays = await tx.select({ amount: schema.payments.amount }).from(schema.payments).where(eq(schema.payments.invoiceId, invoiceId))
  const paid = pays.reduce((a, p) => a + p.amount, 0)
  const lunas = paid >= inv.total && inv.total > 0
  const status = lunas ? 'lunas' : (inv.status === 'lunas' ? 'terkirim' : inv.status)
  await tx.update(schema.invoices).set({ status, paidAt: lunas ? (inv.paidAt ?? new Date()) : null }).where(eq(schema.invoices.id, invoiceId))
  if (inv.termId) {
    const termStatus = lunas ? 'lunas' : status === 'draf' ? 'draf' : 'terkirim'
    await tx.update(schema.terms).set({ status: termStatus }).where(eq(schema.terms.id, inv.termId))
  }
  return { paid, lunas }
}
