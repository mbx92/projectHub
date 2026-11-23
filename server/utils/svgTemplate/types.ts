/** Mengukur lebar teks (pt) untuk keluarga font & ukuran tertentu. */
export type Measure = (text: string, family: string, size: number) => number

export interface FillInput {
  values: Record<string, string>
  /** Satu entri per baris berulang; kunci `item.*`. */
  items?: Record<string, string>[]
  /** Kunci `logo` | `ttd` | `qris` → data URL gambar, atau null bila tidak ada. */
  images?: Record<string, string | null>
  measure: Measure
}

export type TemplateErrorCode = 'invalid_svg' | 'too_large' | 'bad_size' | 'missing_placeholder' | 'no_capacity' | 'content_box_mismatch'

export class TemplateError extends Error {
  constructor(public code: TemplateErrorCode, message: string) {
    super(message)
    this.name = 'TemplateError'
  }
}
