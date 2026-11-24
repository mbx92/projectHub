import { and, asc, eq, inArray, ne } from 'drizzle-orm'

/**
 * Dashboard Developer: bug yang ditugaskan, proyek yang diikuti beserta progress, dan hal yang perlu perhatian.
 * Tanpa data keuangan sama sekali. Proyek dibatasi cakupan akses; bug hanya yang ditugaskan kepada pengguna.
 */
export default defineEventHandler(async (event) => {
  const me = requireUser(event, 'developer')
  const db = useDB()
  const today = todayISO()
  const ids = await accessibleProjectIds(me)

  const projects = await db.select({
    id: schema.projects.id, name: schema.projects.name, stack: schema.projects.stack, status: schema.projects.status,
    progress: schema.projects.progress, targetDate: schema.projects.targetDate,
  }).from(schema.projects)
    .where(and(projectScope(ids, schema.projects.id), eq(schema.projects.archived, false), ne(schema.projects.status, 'selesai')))
    .orderBy(asc(schema.projects.targetDate))

  const projectIds = projects.map(p => p.id)
  const myBugs = can(me, 'bug', 'lihat')
    ? await db.select({
      id: schema.bugs.id, code: schema.bugs.code, title: schema.bugs.title, severity: schema.bugs.severity, status: schema.bugs.status,
      projectId: schema.bugs.projectId, projectName: schema.projects.name, targetDate: schema.bugs.targetDate,
      blocksTerm: schema.bugs.blocksTerm, createdAt: schema.bugs.createdAt, resolvedAt: schema.bugs.resolvedAt,
    }).from(schema.bugs)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.bugs.projectId))
      .where(and(eq(schema.bugs.assigneeId, me.id), eq(schema.projects.archived, false)))
    : []

  const open = myBugs.filter(b => b.status !== 'selesai')
  const overdue = (b: typeof open[number]) => !!b.targetDate && b.targetDate < today
  const attention = open
    .filter(b => b.severity === 'kritis' || overdue(b) || b.blocksTerm)
    .map(b => ({ ...b, overdue: overdue(b) }))

  const doneRecent = myBugs.filter(b => b.status === 'selesai' && b.resolvedAt && daysBetween(toISODate(new Date(b.resolvedAt)), today) <= 30)
  // Lama pengerjaan: dari bug dibuat sampai selesai, rata-rata dalam hari.
  const avgDoneDays = doneRecent.length
    ? Math.round(doneRecent.reduce((s, b) => s + Math.max(0, daysBetween(toISODate(new Date(b.createdAt)), toISODate(new Date(b.resolvedAt!)))), 0) / doneRecent.length)
    : null

  const milestones = projectIds.length
    ? await db.select({ projectId: schema.milestones.projectId, name: schema.milestones.name, targetDate: schema.milestones.targetDate })
      .from(schema.milestones)
      .where(and(inArray(schema.milestones.projectId, projectIds), ne(schema.milestones.status, 'selesai')))
      .orderBy(asc(schema.milestones.targetDate), asc(schema.milestones.sortOrder))
    : []

  return {
    kpis: {
      assigned: open.length,
      open: open.filter(b => b.status === 'open').length,
      inProgress: open.filter(b => b.status === 'dikerjakan').length,
      review: open.filter(b => b.status === 'review').length,
      critical: open.filter(b => b.severity === 'kritis').length,
      overdue: open.filter(overdue).length,
      blocking: open.filter(b => b.blocksTerm).length,
      doneLast30: doneRecent.length,
      avgDoneDays,
    },
    tasks: open
      .sort((a, b) => BUG_SEVERITY[a.severity].order - BUG_SEVERITY[b.severity].order || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))
      .map(b => ({ ...b, overdue: overdue(b) })),
    attention,
    projects: projects.map(p => ({
      ...p,
      openBugs: open.filter(b => b.projectId === p.id).length,
      nextMilestone: milestones.find(m => m.projectId === p.id) ?? null,
    })),
  }
})
