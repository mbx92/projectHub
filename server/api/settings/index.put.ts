export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const raw = (await readBody(event)) as Record<string, unknown> | null
  if ((raw?.business || raw?.invoice) && !can(me, 'pengaturan', 'kelola')) throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses kelola Pengaturan.' })
  const body = await readBodyWith(event, z.object({
    business: z.object({
      name: z.string().trim().min(2).max(160),
      legalForm: z.string().trim().max(60),
      npwp: z.string().trim().max(40),
      email: z.string().trim().max(190),
      whatsapp: z.string().trim().max(40),
      address: z.string().trim().max(500),
      timezone: z.string().trim().max(60),
      logoKey: z.string().nullable(),
      signatureKey: z.string().nullable().default(null),
      signerName: z.string().trim().max(120).default(''),
      signerTitle: z.string().trim().max(120).default(''),
    }).optional(),
    invoice: z.object({
      numberFormat: z.string().trim().min(3).max(60).refine(v => /\[NOMOR( \d DIGIT)?\]/.test(v), 'format harus memuat [NOMOR] atau [NOMOR 3 DIGIT]'),
      defaultDueDays: z.coerce.number().int().min(0).max(365),
      showTax: z.boolean(),
      defaultTaxPercent: zPct,
      footer: z.string().trim().max(500),
      qrisKey: z.string().nullable(),
      methods: z.object({ transfer: z.boolean(), qris: z.boolean(), tunai: z.boolean() }),
    }).optional(),
    notif: z.record(z.string(), z.object({ app: z.boolean(), email: z.boolean() })).optional(),
  }))
  if (body.business) await setSetting('business', body.business, me.id)
  if (body.invoice) await setSetting('invoice', body.invoice, me.id)
  if (body.notif) await setNotifPrefs(me.id, body.notif)
  return { ok: true }
})
