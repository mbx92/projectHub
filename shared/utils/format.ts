/** Format lokal Indonesia: Rp 15.000.000, 30 Nov 2026, 14.30, zona WITA. */
export const APP_TZ = 'Asia/Makassar'

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const thousands = (n: number) => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export function rupiah(n: number | null | undefined): string {
  const v = Number(n || 0)
  return (v < 0 ? '−Rp ' : 'Rp ') + thousands(v)
}

/** Rupiah ringkas: Rp 100,5 jt / Rp 1,2 M */
export function rupiahShort(n: number | null | undefined): string {
  const v = Number(n || 0)
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  const dec = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',')
  if (abs >= 1e9) return `${sign}Rp ${dec(abs / 1e9)} M`
  if (abs >= 1e6) return `${sign}Rp ${dec(abs / 1e6)} jt`
  if (abs >= 1e3) return `${sign}Rp ${dec(abs / 1e3)} rb`
  return rupiah(v)
}

export function numberId(n: number | null | undefined): string {
  return thousands(Number(n || 0))
}

export function percent(n: number | null | undefined): string {
  const v = Math.round(Number(n || 0) * 100) / 100
  return `${v.toString().replace('.', ',')}%`
}

/** Komponen tanggal di zona waktu aplikasi. */
function zoned(d: Date, tz = APP_TZ) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Tanggal hari ini (YYYY-MM-DD) di zona WITA. */
export function todayISO(tz = APP_TZ): string {
  const z = zoned(new Date(), tz)
  return `${z.y}-${pad(z.m)}-${pad(z.d)}`
}

export function toISODate(d: Date, tz = APP_TZ): string {
  const z = zoned(d, tz)
  return `${z.y}-${pad(z.m)}-${pad(z.d)}`
}

function parseDateLike(v: string | Date): { y: number, m: number, d: number, h?: number, min?: number } | null {
  if (v instanceof Date) return zoned(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return { y: y!, m: m!, d: d! }
  }
  const dt = new Date(v)
  return Number.isNaN(dt.getTime()) ? null : zoned(dt)
}

/** 30 Nov 2026 */
export function dateId(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const p = parseDateLike(v)
  return p ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}` : '—'
}

/** 30 November 2026 */
export function dateLongId(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const p = parseDateLike(v)
  return p ? `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}` : '—'
}

/** 30 Nov 2026, 14.30 */
export function dateTimeId(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const p = parseDateLike(v)
  if (!p) return '—'
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}, ${pad(p.h ?? 0)}.${pad(p.min ?? 0)}`
}

/** Selisih hari (b − a) antara dua tanggal ISO. */
export function daysBetween(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  }
  return Math.round((utc(b) - utc(a)) / 86400000)
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** "9 hari lagi", "hari ini", "terlambat 3 hari" */
export function relativeDue(due: string | null | undefined, today = todayISO()): string {
  if (!due) return '—'
  const n = daysBetween(today, due)
  if (n === 0) return 'hari ini'
  if (n === 1) return 'besok'
  if (n > 0) return `${n} hari lagi`
  return `terlambat ${-n} hari`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.replace(/[[\]]/g, '').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

const AVATAR_COLORS = ['#0B6E63', '#1849A9', '#B54708', '#7A5AF8', '#C11574', '#067647', '#175CD3', '#93370D']
export function avatarColor(seed: string | number | null | undefined, preset?: string | null): string {
  if (preset) return preset
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string, long = false): string {
  const [y, m] = key.split('-').map(Number)
  return `${(long ? MONTHS_LONG : MONTHS_SHORT)[m! - 1]} ${y}`
}
