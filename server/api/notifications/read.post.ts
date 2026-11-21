import { and, eq, inArray } from 'drizzle-orm'

/** Tandai notifikasi dibaca: { ids: [..] } atau { all: true }. */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const body = await readBodyWith(event, z.object({ ids: z.array(zId).optional(), all: z.boolean().optional() }))
  const where = body.all
    ? eq(schema.notifications.userId, me.id)
    : and(eq(schema.notifications.userId, me.id), inArray(schema.notifications.id, body.ids?.length ? body.ids : [0]))
  await useDB().update(schema.notifications).set({ read: true }).where(where)
  return { ok: true }
})
