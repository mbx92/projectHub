export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const body = await readBodyWith(event, schemeSchema)
  const db = useDB()
  const [row] = await db.insert(schema.profitSchemes).values({ ...body, shareLabels: body.shareLabels ?? null, createdBy: me.id }).returning()
  await logAudit(db, me.id, 'buat', 'profit_scheme', row!.id, null, row)
  return row
})
