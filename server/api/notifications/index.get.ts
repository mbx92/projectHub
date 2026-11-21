import { and, desc, eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const db = useDB()
  const items = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, me.id))
    .orderBy(desc(schema.notifications.createdAt)).limit(30)
  const [row] = await db.select({ n: count() }).from(schema.notifications)
    .where(and(eq(schema.notifications.userId, me.id), eq(schema.notifications.read, false)))
  return { items, unread: row?.n ?? 0 }
})
