import { eq, sql } from 'drizzle-orm'

type Defaults = typeof DEFAULT_SETTINGS

export async function getSetting<K extends keyof Defaults>(key: K): Promise<Defaults[K]> {
  const [row] = await useDB().select().from(schema.settings).where(eq(schema.settings.key, key))
  return { ...DEFAULT_SETTINGS[key], ...((row?.value as object) || {}) } as Defaults[K]
}

export async function setSetting<K extends keyof Defaults>(key: K, value: Defaults[K], userId: number) {
  await useDB().insert(schema.settings).values({ key, value, createdBy: userId })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
}

/** Preferensi notifikasi per pengguna disimpan di settings dengan kunci notif:<userId>. */
export async function getNotifPrefs(userId: number): Promise<Record<NotifEvent, NotifPref>> {
  const [row] = await useDB().select().from(schema.settings).where(eq(schema.settings.key, `notif:${userId}`))
  return { ...DEFAULT_NOTIF_PREFS, ...((row?.value as object) || {}) }
}

export async function setNotifPrefs(userId: number, prefs: Record<string, NotifPref>) {
  await useDB().insert(schema.settings).values({ key: `notif:${userId}`, value: prefs, createdBy: userId })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: prefs, updatedAt: new Date() } })
}

/**
 * Nomor invoice berikutnya sesuai format di Pengaturan, mis. INV-[TAHUN]-[NOMOR 3 DIGIT] → INV-2026-017.
 * Nomor urut dihitung per tahun dari invoice yang sudah ada dengan awalan yang sama.
 */
export async function nextInvoiceNumber(db: DB | Tx, issueDate: string): Promise<string> {
  const fmt = (await getSetting('invoice')).numberFormat || 'INV-[TAHUN]-[NOMOR 3 DIGIT]'
  const year = issueDate.slice(0, 4)
  const month = issueDate.slice(5, 7)
  const tokenRe = /\[NOMOR(?: (\d) DIGIT)?\]/
  const m = fmt.match(tokenRe)
  const digits = m?.[1] ? Number(m[1]) : 3
  const filled = fmt.replace('[TAHUN]', year).replace('[BULAN]', month)
  const [prefix, suffix = ''] = filled.split(tokenRe).filter((_, i) => i !== 1) as [string, string?]
  const rows = await db.select({ number: schema.invoices.number }).from(schema.invoices)
    .where(sql`${schema.invoices.number} like ${prefix.replace(/[%_]/g, '\\$&') + '%'}`)
  let max = 0
  for (const r of rows) {
    const rest = r.number.slice(prefix.length, suffix ? r.number.length - suffix.length : undefined)
    const n = Number(rest)
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(digits, '0')}${suffix}`
}
