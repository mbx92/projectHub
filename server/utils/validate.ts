import { z } from 'zod'
import type { H3Event } from 'h3'

export { z }

/** Baca & validasi body JSON; pesan galat dalam Bahasa Indonesia. */
export async function readBodyWith<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const body = await readBody(event)
  const r = schema.safeParse(body)
  if (!r.success) {
    const issue = r.error.issues[0]
    const path = issue?.path.join('.')
    throw createError({ statusCode: 422, statusMessage: `Data tidak valid${path ? ` (${path})` : ''}: ${issue?.message ?? ''}`, data: r.error.issues })
  }
  return r.data
}

export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format tanggal YYYY-MM-DD')
export const zMoney = z.coerce.number().int('harus bilangan bulat rupiah').min(0, 'tidak boleh negatif').max(1e14)
export const zPct = z.coerce.number().min(0).max(100)
export const zId = z.coerce.number().int().positive()
export const zText = (max = 2000) => z.string().trim().max(max)
export const zOptText = (max = 2000) => z.string().trim().max(max).nullish().transform(v => v || null)
