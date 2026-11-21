import { eq } from 'drizzle-orm'

/** Undang pengguna baru (Admin; pengelola Investor & Modal boleh mengundang investor). Undangan berlaku 7 hari. */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const raw = (await readBody(event)) as { role?: string } | null
  if (me.role !== 'admin' && !(raw?.role === 'investor' && can(me, 'investor', 'kelola'))) {
    throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses untuk mengundang pengguna ini.' })
  }
  const body = await readBodyWith(event, z.object({
    name: z.string().trim().min(2, 'minimal 2 karakter').max(120),
    email: z.string().trim().toLowerCase().email('email tidak valid'),
    role: z.enum(['admin', 'investor', 'developer']),
    title: zOptText(80),
    plannedCapital: zMoney.optional(),
  }))
  const db = useDB()
  const [dupe] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, body.email))
  if (dupe) throw createError({ statusCode: 409, statusMessage: 'Email sudah terdaftar.' })
  const [user] = await db.insert(schema.users).values({
    name: body.name, email: body.email, role: body.role, title: body.title, status: 'diundang',
    avatarColor: avatarColor(body.email), createdBy: me.id,
  }).returning()
  if (body.role === 'investor') {
    await db.insert(schema.investors).values({ userId: user!.id, status: 'calon', notes: body.plannedCapital ? `Rencana modal ${rupiah(body.plannedCapital)}` : null, createdBy: me.id })
  }
  const inviteUrl = await sendInvite(user!, me)
  return { id: user!.id, inviteUrl: import.meta.dev ? inviteUrl : undefined }
})
