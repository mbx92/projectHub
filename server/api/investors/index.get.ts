import { desc, eq, inArray, sql } from 'drizzle-orm'

/** Halaman Investor & Modal (Admin). */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'investor', 'lihat')
  const db = useDB()
  const portions = await capitalPortions()
  const users = portions.length
    ? await db.select({ id: schema.users.id, email: schema.users.email, status: schema.users.status, avatarColor: schema.users.avatarColor, title: schema.users.title })
        .from(schema.users).where(inArray(schema.users.id, portions.map(p => p.userId)))
    : []
  const invRows = await db.select().from(schema.investors)
  const payouts = await db.execute(sql`
    select dl.penerima as user_id, sum(dl.nominal) as total, count(distinct dl.distribution_id) as n
    from distribution_lines dl where dl.bagian = 'modal' group by dl.penerima`)
  const payoutMap = new Map((payouts.rows as any[]).map(r => [r.user_id as number, { total: Number(r.total), count: Number(r.n) }]))

  const deposits = await db.select({
    id: schema.capitalDeposits.id, investorId: schema.capitalDeposits.investorId, name: schema.users.name, date: schema.capitalDeposits.date,
    amount: schema.capitalDeposits.amount, purpose: schema.capitalDeposits.purpose, proofUrl: schema.capitalDeposits.proofUrl,
  }).from(schema.capitalDeposits)
    .innerJoin(schema.investors, eq(schema.investors.id, schema.capitalDeposits.investorId))
    .innerJoin(schema.users, eq(schema.users.id, schema.investors.userId))
    .orderBy(desc(schema.capitalDeposits.date), desc(schema.capitalDeposits.id))

  const total = portions.reduce((a, p) => a + p.capital, 0)
  return {
    investors: portions.map((p) => {
      const u = users.find(x => x.id === p.userId)
      const inv = invRows.find(x => x.id === p.investorId)
      return { ...p, email: u?.email, userStatus: u?.status, avatarColor: u?.avatarColor, notes: inv?.notes ?? null, payout: payoutMap.get(p.userId)?.total ?? 0, payoutCount: payoutMap.get(p.userId)?.count ?? 0 }
    }),
    deposits: deposits.map(d => ({ ...d, proofUrl: signedFileUrl(d.proofUrl, 'bukti') })),
    summary: {
      totalCapital: total,
      activeInvestors: portions.filter(p => p.status === 'aktif').length,
      prospects: portions.filter(p => p.status === 'calon').length,
      totalPayout: [...payoutMap.values()].reduce((a, v) => a + v.total, 0),
      cash: await cashBalance(),
    },
  }
})
