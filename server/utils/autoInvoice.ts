/** Invoice otomatis (Terkirim) untuk termin yang dibayar tanpa invoice terlebih dahulu. */
export async function createAutoInvoice(tx: Tx, term: typeof schema.terms.$inferSelect, date: string, userId: number) {
  const settings = await getSetting('invoice')
  const [bank] = await tx.select().from(schema.bankAccounts)
  const number = await nextInvoiceNumber(tx, date)
  const [inv] = await tx.insert(schema.invoices).values({
    number, termId: term.id, projectId: term.projectId, issueDate: date, dueDate: term.dueDate && term.dueDate >= date ? term.dueDate : date,
    subtotal: term.amount, discount: 0, taxPercent: 0, taxAmount: 0, total: term.amount,
    notes: settings.footer || null, bankAccountId: bank?.id ?? null, status: 'terkirim', sentAt: new Date(), templateRef: await activeTemplate('invoice'), createdBy: userId,
  }).returning()
  await tx.insert(schema.invoiceItems).values({ invoiceId: inv!.id, description: `${term.name} (${percent(Number(term.percent))} nilai kontrak)`, qty: 1, price: term.amount, createdBy: userId })
  await logAudit(tx, userId, 'buat', 'invoice', inv!.id, null, { ...inv, projectId: term.projectId, name: number, otomatis: true })
  return inv!
}
