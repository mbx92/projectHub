import { eq } from 'drizzle-orm'

/** Muat dokumen beserta nama proyek dan klien, dan pastikan pengguna boleh mengakses proyeknya. */
export async function loadDocFor(me: SessionUser, id: number) {
  const db = useDB()
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id))
  if (!doc) notFound('Dokumen')
  await assertProjectAccess(me, doc.projectId)
  const [project] = await db.select({ name: schema.projects.name, clientId: schema.projects.clientId }).from(schema.projects).where(eq(schema.projects.id, doc.projectId))
  const [client] = project?.clientId ? await db.select({ name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.id, project.clientId)) : []
  return { doc, projectName: project?.name ?? '', clientName: client?.name ?? null }
}
