/** Skema validasi yang dipakai lebih dari satu route. */
export const clientSchema = z.object({
  name: z.string().trim().min(2, 'nama klien wajib diisi').max(160),
  contactName: zOptText(120),
  whatsapp: zOptText(40),
  email: z.string().trim().toLowerCase().email('email tidak valid').nullish().or(z.literal('')).transform(v => v || null),
  address: zOptText(500),
})

export const schemeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: zOptText(300),
  capitalPct: zPct,
  workerPct: zPct,
  cashPct: zPct,
  shareLabels: z.object({ modal: z.string().max(60), pekerja: z.string().max(60), kas: z.string().max(60) }).nullish(),
}).refine(s => Math.abs(s.capitalPct + s.workerPct + s.cashPct - 100) < 0.01, { message: 'Total persentase skema harus 100%.' })

export const expenseSchema = z.object({
  projectId: zId.nullish().transform(v => v ?? null),
  date: zDate,
  description: z.string().trim().min(2, 'keterangan wajib diisi').max(500),
  category: z.string().trim().min(1).max(60),
  amount: zMoney.refine(v => v > 0, 'nominal harus lebih dari 0'),
  source: z.string().trim().max(60).default('kas_ocn'),
  isAsset: z.boolean().default(false),
  proofUrl: zOptText(300),
})
