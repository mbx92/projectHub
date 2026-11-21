import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  requireAccess(event, 'proyek', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, clientSchema)
  const [row] = await useDB().update(schema.clients).set(body).where(eq(schema.clients.id, id)).returning()
  if (!row) notFound('Klien')
  return row
})
