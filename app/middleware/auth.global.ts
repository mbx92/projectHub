/** Wajib login untuk semua halaman kecuali halaman publik; arahkan sesuai hak akses. */
const PUBLIC = ['/login', '/forgot-password', '/reset-password', '/invite']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, fetchMe, homePath, can } = useAuth()
  if (!loaded.value) await fetchMe()
  const isPublic = PUBLIC.includes(to.path) || to.path.startsWith('/tanda-tangan/')
  if (!user.value && !isPublic) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : undefined })
  }
  if (user.value && to.path === '/login') return navigateTo(homePath.value)
  // Tanpa akses Dashboard & Laporan, beranda dialihkan ke halaman awal sesuai hak akses.
  if (user.value && to.path === '/' && !can('laporan', 'lihat') && homePath.value !== '/') return navigateTo(homePath.value)
})
