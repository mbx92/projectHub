import { sql } from 'drizzle-orm'

/** Health check untuk Docker/Coolify: 200 bila server hidup dan database terjangkau. */
export default defineEventHandler(async () => {
  await useDB().execute(sql`select 1`).catch(() => {
    throw createError({ statusCode: 503, statusMessage: 'Database tidak terjangkau.' })
  })
  return { ok: true }
})
