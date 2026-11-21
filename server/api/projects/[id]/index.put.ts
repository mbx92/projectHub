import { asc, eq } from 'drizzle-orm'

/**
 * Ubah proyek. Tanpa akses kelola Keuangan, data keuangan (nilai kontrak, anggaran, termin, skema,
 * honor tetap) tidak bisa diubah: nilainya diambil dari data tersimpan.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const input = await readBodyWith(event, projectInputSchema)

  if (!can(me, 'keuangan', 'kelola')) {
    const db = useDB()
    const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId))
    if (!p) notFound('Proyek')
    const terms = await db.select().from(schema.terms).where(eq(schema.terms.projectId, projectId)).orderBy(asc(schema.terms.sortOrder))
    const oldMembers = await db.select().from(schema.projectMembers).where(eq(schema.projectMembers.projectId, projectId))
    Object.assign(input, {
      contractValue: p.contractValue, budget: p.budget, schemeId: p.schemeId,
      capitalPct: p.capitalPct, workerPct: p.workerPct, cashPct: p.cashPct,
      terms: terms.map(t => ({ id: t.id, name: t.name, percent: Number(t.percent), conditions: t.conditions, dueDate: t.dueDate })),
    })
    input.members = input.members.map((m) => {
      const old = oldMembers.find(o => o.userId === m.userId)
      return { ...m, payType: old?.payType ?? 'bagi_hasil', fixedFee: old?.fixedFee ?? 0, shareWeight: old?.shareWeight ?? 1 }
    })
  }

  const [before] = await useDB().select({ status: schema.projects.status }).from(schema.projects).where(eq(schema.projects.id, projectId))
  const { id, newMemberIds } = await saveProject(me, input, projectId)
  await notifyUsers(newMemberIds, { type: 'bug_ditugaskan', title: `Anda ditambahkan ke proyek ${input.name}`, body: 'Anda sekarang bisa melihat proyek dan bug yang ditugaskan.', link: `/projects/${id}`, email: false }, me.id)
  if (before && input.status !== before.status) {
    const newcomers = new Set(newMemberIds)
    const team = (await projectTeamIds(id)).filter(u => !newcomers.has(u))
    await notifyUsers(team, { type: 'status_proyek', title: `Status ${input.name} berubah`, body: `${PROJECT_STATUS[before.status].label} → ${PROJECT_STATUS[input.status].label}`, link: `/projects/${id}`, email: false }, me.id)
  }
  return { id }
})
