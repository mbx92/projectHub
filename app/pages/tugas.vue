<script setup lang="ts">
definePageMeta({ middleware: 'role', roles: ['developer'], access: ['bug', 'lihat'] })
useHead({ title: 'Tugas Saya — OCN Project Hub' })
const toast = useToast()
const { user, can } = useAuth()
const { data: all, refresh } = await useFetch('/api/bugs', { default: () => [] })

const tab = ref<'aktif' | 'selesai'>('aktif')
const status = ref<BugStatus | 'semua'>('semua')
const mine = computed(() => all.value.filter(b => b.assigneeId === user.value?.id))
const today = todayISO()
const rows = computed(() => mine.value
  .filter(b => tab.value === 'selesai' ? b.status === 'selesai' : b.status !== 'selesai')
  .filter(b => status.value === 'semua' || b.status === status.value)
  .sort((a, b) => BUG_SEVERITY[a.severity].order - BUG_SEVERITY[b.severity].order || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')))
const counts = computed(() => ({
  aktif: mine.value.filter(b => b.status !== 'selesai').length,
  selesai: mine.value.filter(b => b.status === 'selesai').length,
}))
const statusChips: { key: BugStatus | 'semua', label: string }[] = [
  { key: 'semua', label: 'Semua' }, { key: 'open', label: 'Open' }, { key: 'dikerjakan', label: 'Dikerjakan' }, { key: 'review', label: 'Review' },
]
/** Developer hanya sampai Review; Selesai ditandai pengelola bug. */
const nextStatus = (s: BugStatus): BugStatus | null => ({ open: 'dikerjakan', dikerjakan: 'review', review: null, selesai: null } as const)[s]
const busy = ref<number | null>(null)
async function advance(id: number, code: string, to: BugStatus) {
  busy.value = id
  try {
    await $fetch<unknown>(`/api/bugs/${id}`, { method: 'PATCH', body: { status: to } })
    toast.success(`${code} → ${BUG_STATUS[to].label}`)
    await refresh()
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UiPageHeader title="Tugas Saya" subtitle="Bug yang ditugaskan kepada Anda. Anda bisa memajukan status sampai Review.">
    <template #actions>
      <NuxtLink v-if="can('bug', 'ditugaskan')" to="/bugs?lapor=1" class="btn-secondary">+ Laporkan Bug</NuxtLink>
    </template>
  </UiPageHeader>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div role="group" aria-label="Kelompok tugas" class="pill-tabs">
      <button type="button" class="pill-tab" :aria-pressed="tab === 'aktif'" @click="tab = 'aktif'">Aktif · {{ counts.aktif }}</button>
      <button type="button" class="pill-tab" :aria-pressed="tab === 'selesai'" @click="tab = 'selesai'; status = 'semua'">Selesai · {{ counts.selesai }}</button>
    </div>
    <div v-if="tab === 'aktif'" role="group" aria-label="Filter status" class="pill-tabs">
      <button v-for="c in statusChips" :key="c.key" type="button" class="pill-tab" :aria-pressed="status === c.key" @click="status = c.key">{{ c.label }}</button>
    </div>
  </div>

  <section v-if="rows.length" class="card overflow-hidden">
    <ul class="m-0 p-0 list-none divide-y divide-line-3">
      <li v-for="b in rows" :key="b.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span class="text-xs font-mono text-muted w-16">{{ b.code }}</span>
        <div class="flex-1 min-w-56 flex flex-col">
          <NuxtLink :to="`/bugs/${b.id}`" class="text-sm font-semibold !text-ink hover:!text-brand-700 break-words">{{ b.title }}</NuxtLink>
          <span class="text-xs text-muted">
            {{ b.projectName }}<template v-if="b.module"> · {{ b.module }}</template>
            <template v-if="b.targetDate"> · <span :class="b.status !== 'selesai' && b.targetDate < today && 'text-danger-700 font-semibold'">target {{ dateId(b.targetDate) }}</span></template>
          </span>
        </div>
        <span v-if="b.blocksTerm && b.status !== 'selesai'" class="badge bg-warning-50 text-warning-700">menghambat termin</span>
        <UiBadge :tone="BUG_SEVERITY[b.severity]" />
        <UiBadge :tone="BUG_STATUS[b.status]" />
        <button
          v-if="nextStatus(b.status) && can('bug', 'ditugaskan')"
          type="button" class="btn-secondary btn-sm" :disabled="busy === b.id"
          @click="advance(b.id, b.code, nextStatus(b.status)!)"
        >{{ BUG_ADVANCE_LABEL[b.status] }}</button>
        <span v-else-if="b.status === 'review'" class="text-xs text-muted">Menunggu review</span>
      </li>
    </ul>
  </section>
  <UiEmpty v-else :title="tab === 'aktif' ? 'Tidak ada tugas aktif' : 'Belum ada bug selesai'" text="Bug yang ditugaskan kepada Anda akan muncul di sini." />
</template>
