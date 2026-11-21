import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  requireAccess(event, 'proyek', 'kelola')
  return useDB().select().from(schema.clients).orderBy(asc(schema.clients.name))
})
