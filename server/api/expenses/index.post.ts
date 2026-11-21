import { eq } from 'drizzle-orm'

/** Catat pengeluaran (keluar dari kas OCN). Aset dicatat terpisah dan tidak mengurangi laba proyek. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const body = await readBodyWith(event, expenseSchema)
  await assertProjectOrGlobal(me, body.projectId)
  const db = useDB()
  const row = await db.transaction(async (tx) => {
    const [e] = await tx.insert(schema.expenses).values({ ...body, createdBy: me.id }).returning()
    const [p] = body.projectId ? await tx.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, body.projectId)) : []
    if (body.source === 'kas_ocn') {
      await addLedger(tx, { date: body.date, type: 'keluar', amount: body.amount, refType: 'expense', refId: e!.id, description: `${body.isAsset ? 'Aset: ' : ''}${body.description}${p ? ` · ${p.name}` : ''}`, projectId: body.projectId }, me.id)
    }
    await logAudit(tx, me.id, 'buat', 'expense', e!.id, null, { ...e, name: body.description })
    return e
  })
  return row
})
