import { eq } from 'drizzle-orm'

/** Matriks hak akses disimpan di tabel settings (kunci "access"), di-cache di memori. */
let cache: { value: AccessMatrix, at: number } | null = null
const TTL = 30_000

export async function getAccessMatrix(): Promise<AccessMatrix> {
  if (cache && Date.now() - cache.at < TTL) return cache.value
  const [row] = await useDB().select().from(schema.settings).where(eq(schema.settings.key, 'access'))
  const stored = (row?.value ?? {}) as Partial<AccessMatrix>
  const value: AccessMatrix = {
    investor: { ...DEFAULT_ACCESS.investor, ...(stored.investor ?? {}) },
    developer: { ...DEFAULT_ACCESS.developer, ...(stored.developer ?? {}) },
  }
  cache = { value, at: Date.now() }
  return value
}

export async function saveAccessMatrix(value: AccessMatrix, userId: number) {
  await useDB().insert(schema.settings).values({ key: 'access', value, createdBy: userId })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
  cache = { value, at: Date.now() }
}
