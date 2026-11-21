/**
 * Cakupan proyek per pengguna, diperiksa di server. Level akses per modul ada di matriks
 * hak akses (shared/utils/access.ts, diatur di Pengaturan); di sini hanya proyek mana yang terlihat:
 *  - semua: semua proyek
 *  - ditugaskan: proyek tempat ia anggota tim (project_members) atau PJ
 *  - didanai: proyek yang didanai modal (persen_modal > 0) dan tidak diarsipkan
 */
import { and, eq, gt, or, inArray, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

/**
 * null = semua proyek; selain itu daftar id proyek yang boleh diakses,
 * sesuai cakupan proyek di matriks hak akses (semua / ditugaskan / didanai).
 */
export async function accessibleProjectIds(user: SessionUser): Promise<number[] | null> {
  if (user.role === 'admin') return null
  if (!hasAccess(user.access, 'proyek', 'lihat')) return []
  const db = useDB()
  if (user.access.scope === 'semua') return null
  if (user.access.scope === 'ditugaskan') {
    const rows = await db.select({ id: schema.projects.id }).from(schema.projects)
      .where(or(
        eq(schema.projects.picId, user.id),
        inArray(schema.projects.id, db.select({ id: schema.projectMembers.projectId }).from(schema.projectMembers).where(eq(schema.projectMembers.userId, user.id))),
      ))
    return rows.map(r => r.id)
  }
  const rows = await db.select({ id: schema.projects.id }).from(schema.projects)
    .where(and(gt(schema.projects.capitalPct, 0), eq(schema.projects.archived, false)))
  return rows.map(r => r.id)
}

export async function canAccessProject(user: SessionUser, projectId: number) {
  const ids = await accessibleProjectIds(user)
  return ids === null || ids.includes(projectId)
}

export async function assertProjectAccess(user: SessionUser, projectId: number) {
  if (!(await canAccessProject(user, projectId))) {
    throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses ke proyek ini.' })
  }
}

/** Untuk data yang bisa tanpa proyek (mis. pengeluaran operasional): tanpa proyek hanya bila cakupannya semua proyek. */
export async function assertProjectOrGlobal(user: SessionUser, projectId: number | null | undefined) {
  if (projectId) return assertProjectAccess(user, projectId)
  if ((await accessibleProjectIds(user)) !== null) {
    throw createError({ statusCode: 403, statusMessage: 'Data tanpa proyek hanya untuk pengguna dengan cakupan semua proyek.' })
  }
}

/** Kondisi SQL untuk membatasi kolom project_id ke proyek yang boleh diakses. */
export function projectScope(ids: number[] | null, column: any) {
  if (ids === null) return undefined
  if (!ids.length) return sql`false`
  return inArray(column, ids)
}

export function idParam(event: H3Event, name = 'id'): number {
  const v = Number(getRouterParam(event, name))
  if (!Number.isInteger(v) || v <= 0) throw createError({ statusCode: 400, statusMessage: 'ID tidak valid.' })
  return v
}

export function notFound(what = 'Data'): never {
  throw createError({ statusCode: 404, statusMessage: `${what} tidak ditemukan.` })
}
