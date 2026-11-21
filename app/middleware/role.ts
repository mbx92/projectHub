/**
 * Batasi halaman sesuai matriks hak akses:
 *   definePageMeta({ middleware: 'role', access: ['keuangan', 'lihat'] })   → minimal level pada modul
 *   definePageMeta({ middleware: 'role', roles: ['admin'] })                → khusus peran tertentu
 * Ini hanya kenyamanan UI — server tetap memeriksa hak akses di setiap endpoint.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { user, can, homePath } = useAuth()
  if (!user.value) return
  const roles = to.meta.roles as Role[] | undefined
  const access = to.meta.access as [AccessModule, string] | [AccessModule, string][] | undefined
  const rules = !access ? [] : Array.isArray(access[0]) ? access as [AccessModule, string][] : [access as [AccessModule, string]]
  const allowed = (!roles || roles.includes(user.value.role))
    && rules.every(([m, l]) => can(m, l as never))
  if (!allowed && to.path !== homePath.value) return navigateTo(homePath.value)
})

declare module '#app' {
  interface PageMeta {
    roles?: Role[]
    access?: [AccessModule, string] | [AccessModule, string][]
  }
}
