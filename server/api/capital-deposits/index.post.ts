import { eq } from 'drizzle-orm'

/** Catat setoran modal → masuk kas OCN; investor otomatis berstatus Aktif. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'kelola')
  const body = await readBodyWith(event, z.object({
    investorId: zId,
    date: zDate,
    amount: zMoney.refine(v => v > 0, 'nominal harus lebih dari 0'),
    purpose: zOptText(500),
    proofUrl: zOptText(300),
  }))
  const db = useDB()
  const row = await db.transaction(async (tx) => {
    const [inv] = await tx.select({ id: schema.investors.id, name: schema.users.name, userId: schema.users.id }).from(schema.investors)
      .innerJoin(schema.users, eq(schema.users.id, schema.investors.userId)).where(eq(schema.investors.id, body.investorId))
    if (!inv) notFound('Investor')
    const [d] = await tx.insert(schema.capitalDeposits).values({ ...body, createdBy: me.id }).returning()
    await tx.update(schema.investors).set({ status: 'aktif' }).where(eq(schema.investors.id, inv.id))
    await addLedger(tx, { date: body.date, type: 'masuk', amount: body.amount, refType: 'capital_deposit', refId: d!.id, description: `Setoran modal ${inv.name}${body.purpose ? ` · ${body.purpose}` : ''}` }, me.id)
    await logAudit(tx, me.id, 'buat', 'capital_deposit', d!.id, null, d)
    return { ...d!, userId: inv.userId }
  })
  await notifyUsers([row.userId], { type: 'distribusi', title: `Setoran modal ${rupiah(body.amount)} tercatat`, body: `Tanggal ${dateId(body.date)}${body.purpose ? ` · ${body.purpose}` : ''}`, link: '/' }, me.id)
  return row
})
