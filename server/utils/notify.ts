import { eq, inArray } from 'drizzle-orm'

interface NotifyInput {
  type: NotifEvent
  title: string
  body?: string
  link?: string
  /** Kirim juga email bila preferensi pengguna mengizinkan. */
  email?: boolean
}

/** Notifikasi di aplikasi + email, sesuai preferensi tiap pengguna. */
export async function notifyUsers(userIds: (number | null | undefined)[], input: NotifyInput, actorId?: number) {
  const ids = [...new Set(userIds.filter((x): x is number => !!x && x !== actorId))]
  if (!ids.length) return
  const db = useDB()
  const users = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, status: schema.users.status })
    .from(schema.users).where(inArray(schema.users.id, ids))
  const appUrl = useRuntimeConfig().appUrl
  for (const u of users) {
    if (u.status !== 'aktif') continue
    const prefs = (await getNotifPrefs(u.id))[input.type] ?? { app: true, email: false }
    if (prefs.app) {
      await db.insert(schema.notifications).values({ userId: u.id, type: input.type, title: input.title, body: input.body ?? null, link: input.link ?? null, createdBy: actorId ?? null })
    }
    if (prefs.email && input.email !== false) {
      const url = input.link ? appUrl + input.link : undefined
      sendMail({
        to: u.email,
        subject: input.title,
        text: `${input.title}\n\n${input.body ?? ''}${url ? `\n\n${url}` : ''}`,
        html: mailLayout(escapeHtml(input.title), escapeHtml(input.body ?? ''), url ? { label: 'Buka di OCN Project Hub', url } : undefined),
      }).catch(err => console.error('[notify] gagal kirim email', err))
    }
  }
}

/** Anggota tim + penanggung jawab sebuah proyek (untuk notifikasi proyek). */
export async function projectTeamIds(projectId: number): Promise<number[]> {
  const db = useDB()
  const [p] = await db.select({ picId: schema.projects.picId }).from(schema.projects).where(eq(schema.projects.id, projectId))
  const members = await db.select({ id: schema.projectMembers.userId }).from(schema.projectMembers).where(eq(schema.projectMembers.projectId, projectId))
  return [...members.map(m => m.id), p?.picId ?? null].filter((x): x is number => !!x)
}

export async function adminIds(): Promise<number[]> {
  const rows = await useDB().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'admin'))
  return rows.map(r => r.id)
}
