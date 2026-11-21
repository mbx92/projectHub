<script setup lang="ts">
const emit = defineEmits<{ menu: [] }>()
const { user, isAdmin, can, roleLabel, logout } = useAuth()
const router = useRouter()

// ── Pencarian global (Ctrl K) ──
const searchInput = ref<HTMLInputElement | null>(null)
const searchBox = ref<HTMLElement | null>(null)
const q = ref('')
const searchOpen = ref(false)
const active = ref(0)
type Hit = { label: string, sub: string, to: string, kind: string }
const results = ref<Hit[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(timer)
  if (v.trim().length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    const r = await $fetch<any>('/api/search', { query: { q: v } }).catch(() => null)
    if (!r) return
    results.value = [
      ...r.projects.map((p: any) => ({ kind: 'Proyek', label: p.name, sub: p.client ?? '', to: `/projects/${p.id}` })),
      ...r.invoices.map((i: any) => ({ kind: 'Invoice', label: i.number, sub: `${i.project} · ${rupiah(i.total)}`, to: `/invoices/${i.id}` })),
      ...r.bugs.map((b: any) => ({ kind: 'Bug', label: `${b.code} ${b.title}`, sub: b.project, to: `/bugs/${b.id}` })),
    ]
    active.value = 0
    searchOpen.value = true
  }, 200)
})
function go(h: Hit) { searchOpen.value = false; q.value = ''; router.push(h.to) }
function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(results.value.length - 1, active.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(0, active.value - 1) }
  else if (e.key === 'Enter' && results.value[active.value]) { e.preventDefault(); go(results.value[active.value]!) }
  else if (e.key === 'Escape') { searchOpen.value = false; searchInput.value?.blur() }
}
useClickOutside(searchBox, () => { searchOpen.value = false })
function onGlobalKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.value?.focus() }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

// ── + Buat ──
const createBox = ref<HTMLElement | null>(null)
const createOpen = ref(false)
useClickOutside(createBox, () => { createOpen.value = false })
const createItems = computed(() => [
  { label: 'Proyek baru', to: '/projects/new', show: can('proyek', 'kelola') && can('keuangan', 'kelola') },
  { label: 'Invoice', to: '/invoices/new', show: can('keuangan', 'kelola') },
  { label: 'Catat pembayaran masuk', to: '/payments?catat=bayar', show: can('keuangan', 'kelola') },
  { label: 'Catat pengeluaran', to: '/payments?catat=pengeluaran', show: can('keuangan', 'kelola') },
  { label: 'Laporkan bug', to: '/bugs?lapor=1', show: can('bug', 'ditugaskan') },
  { label: 'Setoran modal', to: '/investors?catat=modal', show: can('investor', 'kelola') },
  { label: 'Undang pengguna', to: '/settings?bagian=users&undang=1', show: isAdmin.value },
].filter(c => c.show))

// ── Notifikasi ──
const notifBox = ref<HTMLElement | null>(null)
const notifOpen = ref(false)
useClickOutside(notifBox, () => { notifOpen.value = false })
const { data: notif, refresh: refreshNotif } = await useFetch('/api/notifications', { default: () => ({ items: [], unread: 0 }) })
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => { poll = setInterval(() => refreshNotif(), 60_000) })
onBeforeUnmount(() => clearInterval(poll))
async function openNotif(n: { id: number, link: string | null, read: boolean }) {
  if (!n.read) await $fetch('/api/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {})
  notifOpen.value = false
  await refreshNotif()
  if (n.link) router.push(n.link)
}
async function readAll() {
  await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } })
  await refreshNotif()
}

// ── Akun ──
const accBox = ref<HTMLElement | null>(null)
const accOpen = ref(false)
useClickOutside(accBox, () => { accOpen.value = false })
</script>

<template>
  <div class="sticky top-0 z-30 flex items-center justify-between gap-3 min-h-[68px] px-4 sm:px-8 py-2.5 bg-white border-b border-line-2">
    <button type="button" class="btn-icon lg:hidden shrink-0" aria-label="Buka menu" @click="emit('menu')">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>

    <div ref="searchBox" class="relative flex-1 max-w-[440px] min-w-0">
      <label class="flex items-center gap-2 min-h-11 px-3 border border-line rounded-lg bg-soft focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-50">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <span class="sr-only">Cari di OCN Project Hub</span>
        <input
          ref="searchInput"
          v-model="q"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="global-search-list"
          :aria-expanded="searchOpen && results.length > 0"
          placeholder="Cari proyek, invoice, atau bug…"
          class="border-0 outline-none bg-transparent text-sm w-full text-ink min-w-0"
          @focus="searchOpen = results.length > 0"
          @keydown="onSearchKey"
        >
        <kbd class="hidden sm:inline text-[11px] text-muted border border-line rounded px-1.5 py-px bg-white whitespace-nowrap">Ctrl K</kbd>
      </label>
      <ul v-if="searchOpen && q.trim().length >= 2" id="global-search-list" role="listbox" class="absolute left-0 right-0 top-full mt-1 bg-white border border-line-2 rounded-lg shadow-lg p-1 m-0 list-none max-h-96 overflow-auto z-50">
        <li
          v-for="(r, i) in results"
          :key="r.to"
          role="option"
          :aria-selected="i === active"
          class="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer min-h-11"
          :class="i === active && 'bg-soft-2'"
          @mouseenter="active = i"
          @mousedown.prevent="go(r)"
        >
          <span class="text-[11px] font-semibold text-muted w-14 shrink-0">{{ r.kind }}</span>
          <span class="flex flex-col min-w-0"><span class="text-sm font-semibold truncate">{{ r.label }}</span><span class="text-xs text-muted truncate">{{ r.sub }}</span></span>
        </li>
        <li v-if="!results.length" class="px-3 py-3 text-sm text-muted">Tidak ada hasil untuk “{{ q.trim() }}”</li>
      </ul>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <div v-if="createItems.length" ref="createBox" class="relative">
        <button type="button" class="btn-dark !px-3.5" aria-haspopup="menu" :aria-expanded="createOpen" @click="createOpen = !createOpen">+ <span class="hidden sm:inline">Buat</span></button>
        <div v-if="createOpen" role="menu" class="fixed left-3 right-3 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-60 bg-white border border-line-2 rounded-lg shadow-lg p-1 z-50" @keydown.esc="createOpen = false">
          <NuxtLink v-for="c in createItems" :key="c.to" :to="c.to" role="menuitem" class="flex items-center min-h-11 px-3 rounded-md text-sm !text-ink no-underline hover:bg-soft-2" @click="createOpen = false">{{ c.label }}</NuxtLink>
        </div>
      </div>

      <div ref="notifBox" class="relative">
        <button type="button" class="btn-icon relative" :aria-label="`Notifikasi, ${notif.unread} baru`" aria-haspopup="dialog" :aria-expanded="notifOpen" @click="notifOpen = !notifOpen">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#344054" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></svg>
          <span v-if="notif.unread" aria-hidden="true" class="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center">{{ notif.unread > 9 ? '9+' : notif.unread }}</span>
        </button>
        <div v-if="notifOpen" role="dialog" aria-label="Notifikasi" class="fixed left-3 right-3 top-[72px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-[360px] bg-white border border-line-2 rounded-xl shadow-xl z-50" @keydown.esc="notifOpen = false">
          <div class="flex items-center justify-between px-4 py-3 border-b border-line-3">
            <span class="text-sm font-bold">Notifikasi</span>
            <button v-if="notif.unread" type="button" class="text-xs font-semibold text-brand-700" @click="readAll">Tandai semua dibaca</button>
          </div>
          <ul class="max-h-[min(24rem,calc(100vh-170px))] overflow-auto m-0 p-1 list-none">
            <li v-for="n in notif.items" :key="n.id">
              <button type="button" class="w-full text-left flex gap-3 px-3 py-2.5 rounded-lg hover:bg-soft-2" @click="openNotif(n)">
                <span class="mt-1.5 w-2 h-2 rounded-full shrink-0" :class="n.read ? 'bg-transparent' : 'bg-brand-600'" aria-hidden="true" />
                <span class="flex flex-col gap-0.5 min-w-0">
                  <span class="text-sm" :class="!n.read && 'font-semibold'">{{ n.title }}</span>
                  <span v-if="n.body" class="text-xs text-muted line-clamp-2">{{ n.body }}</span>
                  <span class="text-[11px] text-faint">{{ dateTimeId(n.createdAt) }}</span>
                </span>
              </button>
            </li>
            <li v-if="!notif.items.length" class="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi</li>
          </ul>
        </div>
      </div>

      <span aria-hidden="true" class="hidden sm:block w-px h-7 bg-line-2 mx-1" />

      <div ref="accBox" class="relative">
        <button type="button" class="flex items-center gap-2.5 min-h-11 pl-1 pr-2 rounded-lg hover:bg-soft" :aria-label="`Menu akun ${user?.name}`" aria-haspopup="menu" :aria-expanded="accOpen" @click="accOpen = !accOpen">
          <UiAvatar :name="user?.name" :color="user?.avatarColor" :size="36" />
          <span class="hidden md:flex flex-col items-start gap-px">
            <span class="text-sm font-semibold text-ink">{{ user?.name }}</span>
            <span class="text-xs text-muted">{{ roleLabel }}</span>
          </span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div v-if="accOpen" role="menu" class="absolute right-0 top-full mt-1 w-56 bg-white border border-line-2 rounded-lg shadow-lg p-1 z-50" @keydown.esc="accOpen = false">
          <div class="px-3 py-2 border-b border-line-3 mb-1">
            <p class="m-0 text-sm font-semibold truncate">{{ user?.name }}</p>
            <p class="m-0 text-xs text-muted truncate">{{ user?.email }}</p>
          </div>
          <NuxtLink to="/account" role="menuitem" class="flex items-center min-h-11 px-3 rounded-md text-sm !text-ink no-underline hover:bg-soft-2" @click="accOpen = false">Akun & notifikasi</NuxtLink>
          <button type="button" role="menuitem" class="w-full text-left flex items-center min-h-11 px-3 rounded-md text-sm text-danger-700 hover:bg-danger-50" @click="logout">Keluar</button>
        </div>
      </div>
    </div>
  </div>
</template>
