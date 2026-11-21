export default defineEventHandler(async (event) => {
  requireAccess(event, 'investor', 'kelola')
  const q = getQuery(event)
  const projectId = Number(q.projectId)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'Pilih proyek.' })
  const amount = q.amount ? Number(q.amount) : null
  const r = await computeDistribution(projectId, amount)
  return { project: { id: r.project.id, name: r.project.name, status: r.project.status }, scheme: r.scheme, pnl: r.pnl, available: r.available, netProfit: r.netProfit, lines: r.lines, parts: r.parts, snapshot: r.snapshot, cash: await cashBalance() }
})
