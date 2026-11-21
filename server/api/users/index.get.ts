import { asc, eq, sql } from 'drizzle-orm'

/** Admin: semua pengguna. Peran lain: daftar ringkas (id, nama) untuk pilihan penanggung jawab. */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const db = useDB()
  if (me.role !== 'admin') {
    return db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, avatarColor: schema.users.avatarColor })
      .from(schema.users).where(eq(schema.users.status, 'aktif')).orderBy(asc(schema.users.name))
  }
  return db.select({
    id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, status: schema.users.status,
    title: schema.users.title, phone: schema.users.phone, avatarColor: schema.users.avatarColor, lastLoginAt: schema.users.lastLoginAt,
    createdAt: schema.users.createdAt,
    projectCount: sql<number>`(select count(*)::int from project_members pm where pm.user_id = ${schema.users.id})`,
  }).from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.name))
})
