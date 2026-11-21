import { and, eq } from 'drizzle-orm'

/** Ubah peran, cara bayar, honor, atau bobot seorang anggota tim. Honor/cara bayar hanya untuk pengelola Keuangan. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const userId = idParam(event, 'userId')
  const body = await readBodyWith(event, z.object({
    roleInProject: zOptText(80),
    payType: z.enum(['bagi_hasil', 'tetap']).optional(),
    fixedFee: zMoney.optional(),
    shareWeight: z.coerce.number().int().min(0).max(100).optional(),
  }))
  const db = useDB()
  const where = and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId))
  const [old] = await db.select().from(schema.projectMembers).where(where)
  if (!old) notFound('Anggota tim')

  const money = can(me, 'keuangan', 'kelola')
  const payType = money ? (body.payType ?? old.payType) : old.payType
  const patch = {
    roleInProject: body.roleInProject,
    payType,
    fixedFee: money ? (payType === 'tetap' ? (body.fixedFee ?? old.fixedFee) : 0) : old.fixedFee,
    shareWeight: body.shareWeight ?? old.shareWeight,
  }
  await db.update(schema.projectMembers).set(patch).where(where)
  await logAudit(db, me.id, 'ubah', 'project_member', projectId, old, { ...old, ...patch })
  return { ok: true }
})
