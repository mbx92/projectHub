import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const { keepProof, ...body } = await readBodyWith(event, expenseSchema.extend({ keepProof: z.boolean().default(false) }))
  const db = useDB()
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.expenses).where(eq(schema.expenses.id, id))
    if (!before) notFound('Pengeluaran')
    await assertProjectOrGlobal(me, before.projectId)
    await assertProjectOrGlobal(me, body.projectId)
    if (keepProof) body.proofUrl = before.proofUrl
    const [after] = await tx.update(schema.expenses).set(body).where(eq(schema.expenses.id, id)).returning()
    await removeLedger(tx, 'expense', id)
    if (body.source === 'kas_ocn') {
      const [p] = body.projectId ? await tx.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, body.projectId)) : []
      await addLedger(tx, { date: body.date, type: 'keluar', amount: body.amount, refType: 'expense', refId: id, description: `${body.isAsset ? 'Aset: ' : ''}${body.description}${p ? ` · ${p.name}` : ''}`, projectId: body.projectId }, me.id)
    }
    await logAudit(tx, me.id, 'ubah', 'expense', id, before, { ...after, name: body.description })
  })
  return { ok: true }
})
