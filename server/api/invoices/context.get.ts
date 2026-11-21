import { and, asc, eq, ne, sql } from 'drizzle-orm'

/** Data awal form Buat Invoice: proyek & termin yang bisa ditagih, rekening, pengaturan, nomor berikutnya. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const db = useDB()
  const ids = await accessibleProjectIds(me)
  const projects = await db.select({ id: schema.projects.id, name: schema.projects.name, contractValue: schema.projects.contractValue, clientId: schema.projects.clientId })
    .from(schema.projects).where(and(eq(schema.projects.archived, false), projectScope(ids, schema.projects.id))).orderBy(asc(schema.projects.name))
  const clients = await db.select().from(schema.clients)
  const terms = await db.select().from(schema.terms).where(and(ne(schema.terms.status, 'lunas'), projectScope(ids, schema.terms.projectId))).orderBy(asc(schema.terms.projectId), asc(schema.terms.sortOrder))
  // termin yang sudah punya invoice aktif (bukan draf) tidak bisa ditagih ulang
  const active = await db.select({
    termId: schema.invoices.termId, id: schema.invoices.id, status: schema.invoices.status, number: schema.invoices.number, total: schema.invoices.total,
    paid: sql<number>`coalesce((select sum(nominal) from payments where invoice_id = ${schema.invoices.id}), 0)::bigint`,
  }).from(schema.invoices).where(and(ne(schema.invoices.status, 'batal')))
  const banks = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.active, true))
  const settings = await getSetting('invoice')
  const business = await getSetting('business')
  const today = todayISO()
  return {
    today,
    nextNumber: await nextInvoiceNumber(db, today),
    projects: projects.map(p => ({ ...p, client: clients.find(c => c.id === p.clientId) ?? null })),
    terms: terms.map((t) => {
      const inv = active.filter(a => a.termId === t.id).sort((a, b) => b.id - a.id)[0]
      return {
        ...t, invoiceId: inv?.id ?? null, invoiceStatus: inv?.status ?? null, invoiceNumber: inv?.number ?? null, billable: !inv,
        outstanding: inv ? Number(inv.total) - Number(inv.paid) : t.amount,
      }
    }),
    banks,
    settings: { ...settings, qrisUrl: signedFileUrl(settings.qrisKey, 'qris', 3600) },
    business: { name: business.name, address: business.address, email: business.email, whatsapp: business.whatsapp, logoUrl: signedFileUrl(business.logoKey, 'logo', 3600) },
  }
})
