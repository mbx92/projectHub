export type FontKey = 'PJS-400' | 'PJS-600' | 'PJS-700' | 'PJS-800'

const WEIGHTS = [400, 600, 700, 800] as const

/** Keluarga font terdaftar untuk bobot tertentu. Bobot dibulatkan ke terdekat (seri → yang lebih ringan). */
export function fontKey(family: string, weight: number): FontKey {
  if (!/plus\s*jakarta\s*sans/i.test(family)) return 'PJS-400'
  let best = 400
  for (const w of WEIGHTS) if (Math.abs(w - weight) < Math.abs(best - weight)) best = w
  return `PJS-${best}` as FontKey
}

export function parseStyle(style: string | undefined): Map<string, string> {
  const m = new Map<string, string>()
  for (const part of (style ?? '').split(';')) {
    const i = part.indexOf(':')
    if (i > 0) m.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  return m
}

export const styleToString = (m: Map<string, string>) => [...m].map(([k, v]) => `${k}: ${v}`).join('; ') + ';'
