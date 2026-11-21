import { eq } from 'drizzle-orm'
import type { SchemeSnapshot } from '../database/schema'

/**
 * Hitung distribusi bagi hasil untuk satu proyek dari laba bersih yang belum dibagi:
 * laba bersih × persentase skema proyek; bagian modal dibagi lagi sesuai porsi modal investor aktif;
 * bagian pekerja dibagi ke anggota tim dengan cara bayar "bagi hasil" sesuai bobot.
 */
export async function computeDistribution(projectId: number, amountOverride?: number | null) {
  const db = useDB()
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) notFound('Proyek')
  const [scheme] = project.schemeId ? await db.select().from(schema.profitSchemes).where(eq(schema.profitSchemes.id, project.schemeId)) : []
  const pnl = await projectProfitAllTime(projectId)
  const available = pnl?.undistributed ?? 0
  const netProfit = amountOverride ?? available
  if (netProfit > available) throw createError({ statusCode: 422, statusMessage: `Laba yang belum dibagi hanya ${rupiah(available)}.` })

  const investors = project.capitalPct > 0 ? (await capitalPortions()).filter(p => p.status === 'aktif' && p.capital > 0) : []
  const members = (await projectMembersOf([projectId])).filter(m => m.payType === 'bagi_hasil' && m.shareWeight > 0)
  const workers = members.map(m => ({ userId: m.userId, name: m.name, weight: m.shareWeight }))
  const calc = calcDistribution({ netProfit, capitalPct: project.capitalPct, workerPct: project.workerPct, cashPct: project.cashPct, investors, workers })

  const snapshot: SchemeSnapshot = {
    schemeId: project.schemeId, schemeName: scheme?.name ?? 'Kustom',
    capitalPct: project.capitalPct, workerPct: project.workerPct, cashPct: project.cashPct,
    revenue: pnl?.revenue ?? 0, expenses: pnl?.expenses ?? 0,
    fixedFees: (await projectMembersOf([projectId])).filter(m => m.payType === 'tetap').reduce((a, m) => a + m.fixedFee, 0),
    netProfit,
    capitalShares: investors.map(i => ({ investorId: i.investorId, userId: i.userId, name: i.name, capital: i.capital, portion: i.portion })),
    workerShares: workers,
  }
  return { project, scheme: scheme ?? null, pnl, available, netProfit, snapshot, ...calc }
}
