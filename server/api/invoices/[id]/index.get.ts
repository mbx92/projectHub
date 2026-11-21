export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const data = await loadInvoiceFor(me, idParam(event))
  const [business, settings] = await Promise.all([getSetting('business'), getSetting('invoice')])
  return {
    ...data,
    payments: data.payments.map(p => ({ ...p, proofUrl: signedFileUrl(p.proofUrl, 'bukti') })),
    // Untuk tampilan kertas invoice di halaman detail (sama dengan isi PDF).
    paper: {
      business: { name: business.name, address: business.address, email: business.email, whatsapp: business.whatsapp, npwp: business.npwp, logoUrl: signedFileUrl(business.logoKey, 'logo', 3600) },
      footer: settings.footer || null,
      qrisUrl: data.invoice.showQris ? signedFileUrl(settings.qrisKey, 'qris', 3600) : null,
    },
  }
})
