import { eq, sql } from 'drizzle-orm'

export async function nextBugCode(tx: DB | Tx): Promise<string> {
  const r = await tx.execute(sql`select coalesce(max((regexp_replace(kode, '[^0-9]', '', 'g'))::int), 0) as n from bugs`)
  const n = Number((r.rows[0] as any)?.n ?? 0) + 1
  return `BUG-${String(n).padStart(3, '0')}`
}

export async function loadBugForUser(me: SessionUser, id: number) {
  const [bug] = await useDB().select().from(schema.bugs).where(eq(schema.bugs.id, id))
  if (!bug) notFound('Bug')
  if (!can(me, 'bug', 'lihat')) throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses ke bug.' })
  await assertProjectAccess(me, bug.projectId)
  return bug
}

export async function bugActivity(tx: DB | Tx, bugId: number, userId: number, text: string) {
  await tx.insert(schema.bugComments).values({ bugId, userId, body: text, kind: 'activity', createdBy: userId })
}

export const STATUS_TEXT: Record<BugStatus, string> = { open: 'Open', dikerjakan: 'Dikerjakan', review: 'Review', selesai: 'Selesai' }
