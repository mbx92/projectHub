import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'ditugaskan')
  const body = await readBodyWith(event, z.object({
    projectId: zId,
    title: z.string().trim().min(3, 'judul minimal 3 karakter').max(200),
    description: zOptText(5000),
    steps: zOptText(5000),
    expected: zOptText(2000),
    actual: zOptText(2000),
    module: zOptText(80),
    severity: z.enum(['kritis', 'tinggi', 'sedang', 'rendah']),
    assigneeId: zId.nullish().transform(v => v ?? null),
    reporter: zOptText(120),
    targetDate: zDate.nullish().transform(v => v ?? null),
    blocksTerm: z.boolean().default(false),
    attachments: z.array(z.object({ key: z.string().regex(/^bug\/[\w.-]+$/), name: z.string().max(255), mime: z.string().nullish(), size: z.number().int().nullish() })).default([]),
  }))
  await assertProjectAccess(me, body.projectId)
  // Hanya admin yang menugaskan developer.
  const assigneeId = can(me, 'bug', 'kelola') ? body.assigneeId : null
  const db = useDB()
  const [project] = await db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, body.projectId))
  const bug = await db.transaction(async (tx) => {
    const code = await nextBugCode(tx)
    const { attachments, ...fields } = body
    const [b] = await tx.insert(schema.bugs).values({
      ...fields, assigneeId, code, reporter: body.reporter || me.name, reporterUserId: me.id, status: 'open', createdBy: me.id,
    }).returning()
    if (attachments.length) {
      await tx.insert(schema.attachments).values(attachments.map(a => ({ entityType: 'bug', entityId: b!.id, fileKey: a.key, fileName: a.name, mime: a.mime ?? null, size: a.size ?? null, createdBy: me.id })))
    }
    await bugActivity(tx, b!.id, me.id, 'melaporkan bug')
    return b!
  })
  if (bug.severity === 'kritis') {
    await notifyUsers(await adminIds(), { type: 'bug_kritis', title: `Bug kritis ${bug.code}: ${bug.title}`, body: `Proyek ${project?.name}${bug.blocksTerm ? ' · menghambat termin' : ''}`, link: `/bugs/${bug.id}` }, me.id)
  }
  else {
    await notifyUsers(await adminIds(), { type: 'bug_baru', title: `Bug baru ${bug.code}: ${bug.title}`, body: `Proyek ${project?.name} · keparahan ${BUG_SEVERITY[bug.severity].label}`, link: `/bugs/${bug.id}` }, me.id)
  }
  if (assigneeId) {
    await notifyUsers([assigneeId], { type: 'bug_ditugaskan', title: `${bug.code} ditugaskan ke Anda`, body: `${bug.title} · ${project?.name}`, link: `/bugs/${bug.id}` }, me.id)
  }
  return { id: bug.id, code: bug.code }
})
