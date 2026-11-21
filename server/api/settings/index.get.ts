export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const [business, invoice, notif] = await Promise.all([getSetting('business'), getSetting('invoice'), getNotifPrefs(me.id)])
  return {
    business: { ...business, logoUrl: signedFileUrl(business.logoKey, 'logo', 3600), signatureUrl: signedFileUrl(business.signatureKey, 'ttd', 3600) },
    invoice: can(me, 'keuangan', 'lihat') || can(me, 'pengaturan', 'kelola') ? { ...invoice, qrisUrl: signedFileUrl(invoice.qrisKey, 'qris', 3600) } : null,
    notif,
  }
})
