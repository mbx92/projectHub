/**
 * Simpan distribusi bagi hasil. Angka laba, skema, dan rincian pembagian saat itu disimpan
 * (snapshot) sehingga tidak berubah bila skema diubah kemudian.
 * Bagian modal & pekerja keluar dari kas OCN; bagian kas tetap di kas.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'kelola')
  const body = await readBodyWith(event, z.object({ projectId: zId, date: zDate, amount: zMoney.nullish(), notes: zOptText(1000) }))
  const r = await computeDistribution(body.projectId, body.amount ?? null)
  if (r.netProfit <= 0) throw createError({ statusCode: 422, statusMessage: 'Tidak ada laba bersih yang bisa dibagi untuk proyek ini.' })
  const payout = r.lines.filter(l => l.part !== 'kas').reduce((a, l) => a + l.amount, 0)
  const balance = await cashBalance()
  if (payout > balance) throw createError({ statusCode: 422, statusMessage: `Saldo kas OCN (${rupiah(balance)}) tidak cukup untuk distribusi ini (${rupiah(payout)}).` })

  const db = useDB()
  const dist = await db.transaction(async (tx) => {
    const [d] = await tx.insert(schema.distributions).values({ projectId: body.projectId, date: body.date, netProfit: r.netProfit, schemeSnapshot: r.snapshot, notes: body.notes, createdBy: me.id }).returning()
    await tx.insert(schema.distributionLines).values(r.lines.map(l => ({ distributionId: d!.id, recipientUserId: l.recipientUserId, part: l.part, amount: l.amount, basisPct: l.basisPct, createdBy: me.id })))
    if (payout > 0) {
      await addLedger(tx, { date: body.date, type: 'keluar', amount: payout, refType: 'distribution', refId: d!.id, description: `Distribusi bagi hasil ${r.project.name}`, projectId: body.projectId }, me.id)
    }
    await logAudit(tx, me.id, 'buat', 'distribution', d!.id, null, { ...d, lines: r.lines })
    return d!
  })

  for (const l of r.lines) {
    if (!l.recipientUserId) continue
    await notifyUsers([l.recipientUserId], {
      type: 'distribusi',
      title: `Bagi hasil ${r.project.name}: ${rupiah(l.amount)}`,
      body: `Bagian ${SHARE_PART_LABEL[l.part]} dari laba bersih ${rupiah(r.netProfit)} · ${dateId(body.date)}`,
      link: '/',
    }, me.id)
  }
  return { id: dist.id }
})
