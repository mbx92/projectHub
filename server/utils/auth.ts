import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'ocn_session'
const REMEMBER_DAYS = 30
const SHORT_HOURS = 12

export interface SessionUser {
  id: number
  name: string
  email: string
  role: Role
  title: string | null
  avatarColor: string | null
  investorId: number | null
  /** Hak akses efektif dari matriks peran (Admin = penuh). */
  access: RoleAccess
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export function validatePasswordStrength(pw: string) {
  if (!pw || pw.length < 8) throw createError({ statusCode: 422, statusMessage: 'Kata sandi minimal 8 karakter.' })
}

export async function createSession(event: H3Event, userId: number, remember: boolean) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DAYS * 86400_000 : SHORT_HOURS * 3600_000))
  await useDB().insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: getHeader(event, 'user-agent')?.slice(0, 300) ?? null,
    ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
  })
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    ...(remember ? { maxAge: REMEMBER_DAYS * 86400 } : {}),
  })
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) await useDB().delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)))
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function loadSessionUser(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null
  const db = useDB()
  const [row] = await db
    .select({
      id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role,
      title: schema.users.title, avatarColor: schema.users.avatarColor, status: schema.users.status,
      investorId: schema.investors.id,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.investors, eq(schema.investors.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
  if (!row || row.status !== 'aktif') return null
  const { status: _s, ...user } = row
  return { ...user, access: accessFor(user.role, await getAccessMatrix()) }
}

/** Wajib login; opsional batasi peran. Pemeriksaan dilakukan di server untuk setiap endpoint. */
export function requireUser(event: H3Event, ...roles: Role[]): SessionUser {
  const user = event.context.user as SessionUser | null | undefined
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Silakan masuk terlebih dahulu.' })
  if (roles.length && !roles.includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses ke data ini.' })
  return user
}

/** Khusus admin (dipakai untuk pengguna & matriks hak akses). */
export const requireAdmin = (event: H3Event) => requireUser(event, 'admin')

/** Wajib punya hak akses minimal `level` pada `module` sesuai matriks hak akses. */
export function requireAccess<M extends AccessModule>(event: H3Event, module: M, level: AccessLevel<M>): SessionUser {
  const user = requireUser(event)
  if (!hasAccess(user.access, module, level)) {
    throw createError({ statusCode: 403, statusMessage: `Anda tidak punya akses ${accessLabel(module, level).toLowerCase()} untuk ${ACCESS_MODULES[module].label}.` })
  }
  return user
}

export const can = <M extends AccessModule>(user: SessionUser, module: M, level: AccessLevel<M>) => hasAccess(user.access, module, level)

/** Buat token undangan / reset (sekali pakai). Mengembalikan token mentah untuk dikirim lewat email. */
export async function issueUserToken(userId: number, type: 'undangan' | 'reset', createdBy?: number) {
  const token = randomToken()
  const ttl = type === 'undangan' ? 7 * 86400_000 : 2 * 3600_000
  await useDB().insert(schema.userTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl), createdBy: createdBy ?? null })
  return token
}

export async function findValidToken(token: string, type: 'undangan' | 'reset') {
  const [row] = await useDB().select().from(schema.userTokens)
    .where(and(eq(schema.userTokens.tokenHash, sha256(token)), eq(schema.userTokens.type, type), gt(schema.userTokens.expiresAt, new Date())))
  if (!row || row.usedAt) return null
  return row
}
