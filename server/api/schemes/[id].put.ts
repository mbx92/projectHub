import { eq } from 'drizzle-orm'

/** Mengubah template tidak mengubah proyek yang sudah ada (persentase proyek disalin saat dibuat) maupun distribusi lama. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, schemeSchema)
  const db = useDB()
  const [before] = await db.select().from(schema.profitSchemes).where(eq(schema.profitSchemes.id, id))
  if (!before) notFound('Skema')
  const [row] = await db.update(schema.profitSchemes).set({ ...body, shareLabels: body.shareLabels ?? null }).where(eq(schema.profitSchemes.id, id)).returning()
  await logAudit(db, me.id, 'ubah', 'profit_scheme', id, before, row)
  return row
})
