export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'ditugaskan')
  const bug = await loadBugForUser(me, idParam(event))
  const body = await readBodyWith(event, z.object({ key: z.string().regex(/^bug\/[\w.-]+$/, 'file tidak valid'), name: z.string().max(255), mime: z.string().nullish(), size: z.number().int().nullish() }))
  const db = useDB()
  const [row] = await db.insert(schema.attachments).values({ entityType: 'bug', entityId: bug.id, fileKey: body.key, fileName: body.name, mime: body.mime ?? null, size: body.size ?? null, createdBy: me.id }).returning()
  await bugActivity(db, bug.id, me.id, `menambahkan lampiran ${body.name}`)
  return { ...row, url: signedFileUrl(row!.fileKey, row!.fileName) }
})
