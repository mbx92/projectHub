export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
  title: string | null
  avatarColor: string | null
  investorId: number | null
  /** Hak akses efektif dari matriks peran (diatur di Pengaturan › Pengguna & Hak Akses). */
  access: RoleAccess
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const loaded = useState<boolean>('auth-loaded', () => false)

  async function fetchMe() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const res = await $fetch<{ user: AuthUser | null }>('/api/auth/me', { headers }).catch(() => ({ user: null }))
    user.value = res.user
    loaded.value = true
    return res.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    user.value = null
    await navigateTo('/login')
  }

  /** UI saja — server tetap memeriksa hak akses di setiap endpoint. */
  function can<M extends AccessModule>(module: M, level: AccessLevel<M>): boolean {
    return hasAccess(user.value?.access, module, level)
  }

  const role = computed(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const homePath = computed(() => (user.value ? homePathFor(user.value.role, user.value.access) : '/login'))
  const roleLabel = computed(() => (user.value ? `${ROLE_LABEL[user.value.role]}${user.value.title ? ` · ${user.value.title}` : ''}` : ''))

  return { user, loaded, fetchMe, logout, role, isAdmin, can, homePath, roleLabel }
}
