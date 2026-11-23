import { eq } from 'drizzle-orm'

/** Kirim invoice: status Terkirim; opsional email ke klien dengan PDF terlampir. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, z.object({ email: z.boolean().default(true), reminders: z.boolean().default(true) }))
  const db = useDB()
  const data = await loadInvoiceFor(me, id)
  if (data.invoice.status === 'lunas' || data.invoice.status === 'batal') throw createError({ statusCode: 422, statusMessage: 'Invoice ini sudah lunas atau dibatalkan.' })

  await db.transaction(async (tx) => {
    await tx.update(schema.invoices).set({ status: 'terkirim', sentAt: new Date(), templateRef: data.invoice.templateRef ?? await activeTemplate('invoice') }).where(eq(schema.invoices.id, id))
    if (data.invoice.termId) await tx.update(schema.terms).set({ status: 'terkirim' }).where(eq(schema.terms.id, data.invoice.termId))
    await logAudit(tx, me.id, 'kirim', 'invoice', id, { status: data.invoice.status }, { status: 'terkirim', projectId: data.project.id, name: data.invoice.number })
  })
  await setReminderFlag(id, body.reminders)

  let emailed = false
  if (body.email && !data.client?.email) {
    return { ok: true, emailed: false, warning: 'Invoice ditandai terkirim, tetapi email klien belum diisi sehingga email tidak dikirim.' }
  }
  if (body.email && data.client?.email) {
    const fresh = await loadInvoice(id)
    const pdf = await invoicePdf(fresh)
    const business = await getSetting('business')
    const r = await sendMail({
      to: data.client.email,
      subject: `Invoice ${data.invoice.number} — ${data.project.name}`,
      text: `Yth. ${data.client.contactName || data.client.name},\n\nTerlampir invoice ${data.invoice.number} sebesar ${rupiah(data.invoice.total)} untuk ${data.term?.name ?? 'proyek'} ${data.project.name}, jatuh tempo ${dateId(data.invoice.dueDate)}.\n\nTerima kasih,\n${business.name}`,
      html: mailLayout(`Invoice ${escapeHtml(data.invoice.number)}`, `Yth. ${escapeHtml(data.client.contactName || data.client.name)},<br><br>Terlampir invoice <b>${escapeHtml(data.invoice.number)}</b> sebesar <b>${rupiah(data.invoice.total)}</b> untuk ${escapeHtml(data.term?.name ?? 'proyek')} ${escapeHtml(data.project.name)}, jatuh tempo <b>${dateId(data.invoice.dueDate)}</b>.<br><br>Terima kasih,<br>${escapeHtml(business.name)}`),
      attachments: [{ filename: `${data.invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
    })
    emailed = r.sent
  }
  return { ok: true, emailed }
})
