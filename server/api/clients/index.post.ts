export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const body = await readBodyWith(event, clientSchema)
  const [row] = await useDB().insert(schema.clients).values({ ...body, createdBy: me.id }).returning()
  return row
})
