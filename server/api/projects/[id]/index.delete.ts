import { and, eq, inArray } from 'drizzle-orm'

/** Hapus permanen — wajib mengetik nama proyek. Mutasi kas terkait ikut dihapus dan saldo dihitung ulang. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const { confirmName } = await readBodyWith(event, z.object({ confirmName: z.string() }))
  const db = useDB()
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
  if (!p) notFound('Proyek')
  if (confirmName.trim() !== p.name.trim()) throw createError({ statusCode: 422, statusMessage: 'Nama proyek yang diketik tidak sama.' })

  await db.transaction(async (tx) => {
    const invs = await tx.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.projectId, id))
    const pays = invs.length ? await tx.select({ id: schema.payments.id }).from(schema.payments).where(inArray(schema.payments.invoiceId, invs.map(i => i.id))) : []
    const exps = await tx.select({ id: schema.expenses.id }).from(schema.expenses).where(eq(schema.expenses.projectId, id))
    const dists = await tx.select({ id: schema.distributions.id }).from(schema.distributions).where(eq(schema.distributions.projectId, id))
    const bugIds = (await tx.select({ id: schema.bugs.id }).from(schema.bugs).where(eq(schema.bugs.projectId, id))).map(b => b.id)
    for (const [refType, list] of [['payment', pays], ['expense', exps], ['distribution', dists]] as const) {
      for (const r of list) await removeLedger(tx, refType, r.id)
    }
    await tx.delete(schema.expenses).where(eq(schema.expenses.projectId, id))
    if (bugIds.length) await tx.delete(schema.attachments).where(and(eq(schema.attachments.entityType, 'bug'), inArray(schema.attachments.entityId, bugIds)))
    await tx.delete(schema.projects).where(eq(schema.projects.id, id)) // cascade: terms, invoices, payments, members, milestones, bugs, documents, distributions
    await logAudit(tx, me.id, 'hapus', 'project', id, p, null)
  })
  return { ok: true }
})
