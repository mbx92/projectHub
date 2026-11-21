import { eq } from 'drizzle-orm'

/** Tambah dokumen proyek (file sudah diunggah lewat /api/files, folder "dokumen"). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'kelola')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const body = await readBodyWith(event, z.object({
    name: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(60),
    status: z.string().trim().max(40).default('draf'),
    fileKey: z.string().regex(/^dokumen\/[\w.-]+$/, 'file tidak valid'),
  }))
  const [row] = await useDB().insert(schema.documents).values({ projectId: id, name: body.name, type: body.type, status: body.status, fileUrl: body.fileKey, createdBy: me.id }).returning()
  const [project] = await useDB().select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, id))
  await notifyUsers(await projectTeamIds(id), { type: 'dokumen_baru', title: `Dokumen baru di ${project?.name}`, body: `${body.name} (${body.type})`, link: `/projects/${id}`, email: false }, me.id)
  return row
})
