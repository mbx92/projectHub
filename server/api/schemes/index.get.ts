import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  requireUser(event)
  return useDB().select().from(schema.profitSchemes).orderBy(asc(schema.profitSchemes.id))
})
