import { and, eq, ne } from 'drizzle-orm'

/**
 * Catat pembayaran masuk. Bisa untuk invoice (invoiceId) atau langsung termin (termId);
 * bila termin belum punya invoice, invoice dibuat otomatis berstatus Terkirim.
 * Pembayaran masuk ke mutasi kas OCN. Total pembayaran ≥ total invoice → invoice & termin Lunas.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const body = await readBodyWith(event, z.object({
    invoiceId: zId.optional(),
    termId: zId.optional(),
    amount: zMoney.refine(v => v > 0, 'nominal harus lebih dari 0'),
    date: zDate,
    method: z.string().trim().min(1).max(60),
    proofUrl: zOptText(300),
    notes: zOptText(500),
    sendReceipt: z.boolean().default(false),
  }).refine(b => b.invoiceId || b.termId, { message: 'Pilih invoice atau termin.' }))
  const db = useDB()

  const result = await db.transaction(async (tx) => {
    let invoiceId = body.invoiceId
    if (!invoiceId && body.termId) {
      const [term] = await tx.select().from(schema.terms).where(eq(schema.terms.id, body.termId)).for('update')
      if (!term) notFound('Termin')
    await assertProjectAccess(me, term.projectId)
      if (term.status === 'lunas') throw createError({ statusCode: 422, statusMessage: 'Termin sudah lunas dan tidak bisa ditagih ulang.' })
      const [existing] = await tx.select().from(schema.invoices).where(and(eq(schema.invoices.termId, term.id), ne(schema.invoices.status, 'batal')))
      if (existing) invoiceId = existing.id
      else {
        const inv = await createAutoInvoice(tx, term, body.date, me.id)
        invoiceId = inv.id
      }
    }
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId!)).for('update')
    if (!inv) notFound('Invoice')
    await assertProjectAccess(me, inv.projectId)
    if (inv.status === 'lunas') throw createError({ statusCode: 422, statusMessage: 'Invoice sudah lunas dan tidak bisa ditagih ulang.' })
    if (inv.status === 'batal') throw createError({ statusCode: 422, statusMessage: 'Invoice sudah dibatalkan.' })
    if (inv.status === 'draf') {
      await tx.update(schema.invoices).set({ status: 'terkirim', sentAt: new Date(), templateRef: inv.templateRef ?? await activeTemplate('invoice') }).where(eq(schema.invoices.id, inv.id))
    }
    const paidBefore = (await tx.select({ a: schema.payments.amount }).from(schema.payments).where(eq(schema.payments.invoiceId, inv.id))).reduce((a, p) => a + p.a, 0)
    if (paidBefore + body.amount > inv.total) {
      throw createError({ statusCode: 422, statusMessage: `Nominal melebihi sisa tagihan (${rupiah(inv.total - paidBefore)}).` })
    }
    const [pay] = await tx.insert(schema.payments).values({
      invoiceId: inv.id, amount: body.amount, date: body.date, method: body.method, proofUrl: body.proofUrl, notes: body.notes, templateRef: await activeTemplate('kuitansi'), createdBy: me.id,
    }).returning()
    const [project] = await tx.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, inv.projectId))
    await addLedger(tx, { date: body.date, type: 'masuk', amount: body.amount, refType: 'payment', refId: pay!.id, description: `Pembayaran ${inv.number} · ${project?.name ?? ''}`, projectId: inv.projectId }, me.id)
    const sync = await syncPaidStatus(tx, inv.id)
    await logAudit(tx, me.id, 'buat', 'payment', pay!.id, null, { ...pay, projectId: inv.projectId, name: `${inv.number} ${rupiah(body.amount)}` })
    return { paymentId: pay!.id, invoiceId: inv.id, lunas: !!sync?.lunas, projectId: inv.projectId, projectName: project?.name ?? '', number: inv.number }
  })

  // Notifikasi: admin lain + investor bila proyek didanai.
  const admins = await adminIds()
  await notifyUsers(admins, {
    type: 'pembayaran_diterima',
    title: `Pembayaran ${rupiah(body.amount)} diterima`,
    body: `${result.number} · ${result.projectName}${result.lunas ? ' · termin lunas' : ''}`,
    link: `/projects/${result.projectId}?tab=pembayaran`,
  }, me.id)

  let receiptSent = false
  if (body.sendReceipt) {
    const data = await loadInvoice(result.invoiceId)
    if (data.client?.email) {
      const pdf = await receiptPdf(data, result.paymentId)
      const business = await getSetting('business')
      const r = await sendMail({
        to: data.client.email,
        subject: `Kuitansi pembayaran ${data.invoice.number}`,
        text: `Yth. ${data.client.contactName || data.client.name},\n\nTerima kasih, pembayaran ${rupiah(body.amount)} untuk ${data.invoice.number} (${data.project.name}) telah kami terima pada ${dateId(body.date)}. Kuitansi terlampir.\n\n${business.name}`,
        attachments: [{ filename: `Kuitansi-${data.invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
      })
      receiptSent = r.sent
    }
  }
  return { ...result, receiptSent }
})
