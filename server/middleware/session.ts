/** Memuat pengguna dari cookie sesi ke event.context.user. Penegakan akses dilakukan di tiap route (requireUser). */
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  event.context.user = await loadSessionUser(event)
})
