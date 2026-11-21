/** Rate limit sederhana di memori (cukup untuk satu instance server). */
const buckets = new Map<string, { count: number, resetAt: number }>()

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  b.count++
  if (b.count > max) {
    const wait = Math.ceil((b.resetAt - now) / 60000)
    throw createError({ statusCode: 429, statusMessage: `Terlalu banyak percobaan. Coba lagi dalam ${wait} menit.` })
  }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}
