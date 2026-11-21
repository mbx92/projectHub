import { eq } from 'drizzle-orm'

/** Buat permintaan tanda tangan klien; opsional langsung dikirim lewat email. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const body = await readBodyWith(event, z.object({
    title: z.string().trim().min(3, 'judul minimal 3 karakter').max(200),
    body: z.string().trim().min(10, 'uraian minimal 10 karakter').max(8000),
    email: z.string().trim().toLowerCase().email('email tidak valid').max(190).nullish().transform(v => v || null),
    validDays: z.coerce.number().int().min(1).max(90).default(14),
  }))
  const db = useDB()
  const [project] = await db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId))
  if (!project) notFound('Proyek')
  const [row] = await db.insert(schema.signatureRequests).values({
    projectId, title: body.title, body: body.body, token: randomToken(24), sentTo: body.email,
    expiresAt: new Date(Date.now() + body.validDays * 86400_000), createdBy: me.id,
  }).returning()
  await logAudit(db, me.id, 'buat', 'signature_request', row!.id, null, { title: row!.title, projectId })
  let emailSent: boolean | null = null
  if (body.email) emailSent = (await sendSignatureMail(row!, project.name, body.email, me.name).catch(() => ({ sent: false }))).sent
  return { id: row!.id, link: signatureLink(row!.token), emailSent }
})
