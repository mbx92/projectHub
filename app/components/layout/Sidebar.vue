<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { can, role } = useAuth()
const route = useRoute()

const ALL = [
  { label: 'Dashboard Developer', to: '/developer', show: () => role.value === 'developer', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { label: 'Tugas Saya', to: '/tugas', show: () => role.value === 'developer' && can('bug', 'lihat'), icon: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9' },
  { label: 'Dashboard Investor', to: '/', show: () => can('laporan', 'lihat'), icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { label: 'Proyek', to: '/projects', show: () => can('proyek', 'lihat'), icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { label: 'Pembayaran', to: '/payments', show: () => can('keuangan', 'lihat'), icon: 'M3 7h18v12H3zM3 7l2-3h12l2 3M16 13h2' },
  { label: 'Bug Tracker', to: '/bugs', show: () => can('bug', 'lihat'), icon: 'M8 9h8v6a4 4 0 0 1-8 0zM12 9V6M9 5l1.5 2M15 5l-1.5 2M4 12h4M16 12h4M5 18l3-2M19 18l-3-2' },
  { label: 'Investor & Modal', to: '/investors', show: () => can('investor', 'lihat'), icon: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8' },
  { label: 'Laporan', to: '/reports', show: () => can('laporan', 'lihat'), icon: 'M6 3h9l4 4v14H6zM9 13h6M9 17h6M9 9h3' },
  { label: 'Pengaturan', to: '/settings', show: () => can('pengaturan', 'kelola'), icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
]

const items = computed(() => ALL.filter(n => n.show()))
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`) || (to === '/payments' && route.path.startsWith('/invoices')))
watch(() => route.fullPath, () => emit('close'))
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-navy/50 lg:hidden" aria-hidden="true" @click="emit('close')" />
  <aside
    class="fixed lg:sticky top-0 left-0 z-50 h-screen w-[248px] shrink-0 bg-navy text-line px-4 py-6 flex flex-col gap-7 transition-transform lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
    aria-label="Navigasi"
  >
    <div class="flex items-center gap-2.5 px-2">
      <div class="w-9 h-9 rounded-[9px] bg-brand-600 text-white flex items-center justify-center font-bold text-xs tracking-[0.5px]">OCN</div>
      <div class="flex flex-col gap-0.5">
        <span class="text-white font-bold text-[15px]">OCN Project Hub</span>
        <span class="text-xs text-faint">OCN Development</span>
      </div>
      <button type="button" class="ml-auto lg:hidden text-line w-10 h-10 flex items-center justify-center rounded-lg hover:bg-navy-2" aria-label="Tutup menu" @click="emit('close')">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    <nav aria-label="Menu utama" class="flex flex-col gap-1">
      <NuxtLink
        v-for="n in items"
        :key="n.to"
        :to="n.to"
        :aria-current="isActive(n.to) ? 'page' : undefined"
        class="flex items-center gap-3 min-h-11 px-3 rounded-lg no-underline text-sm"
        :class="isActive(n.to) ? 'bg-navy-2 !text-white font-semibold' : '!text-line font-medium hover:bg-navy-2/60 hover:!text-white'"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="isActive(n.to) ? '#5FD3C1' : 'currentColor'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="n.icon" /></svg>
        {{ n.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>
