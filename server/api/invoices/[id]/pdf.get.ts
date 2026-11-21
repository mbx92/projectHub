export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const data = await loadInvoiceFor(me, idParam(event))
  const pdf = await invoicePdf(data)
  const dl = getQuery(event).download === '1'
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${data.invoice.number}.pdf"`,
    'Cache-Control': 'no-store',
  })
  return pdf
})
