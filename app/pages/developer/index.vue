<script setup lang="ts">
definePageMeta({ middleware: 'role', roles: ['developer'] })
useHead({ title: 'Dashboard Developer — OCN Project Hub' })
const { user, can } = useAuth()
const toast = useToast()
const { data, pending, refresh } = await useFetch('/api/developer/dashboard')
const k = computed(() => data.value?.kpis)
const firstName = computed(() => user.value?.name.split(' ')[0] ?? '')
const stats = computed(() => !k.value ? [] : [
  { label: 'Tugas aktif', value: k.value.assigned, sub: `${k.value.open} open · ${k.value.inProgress} dikerjakan · ${k.value.review} review`, color: undefined as string | undefined },
  { label: 'Lewat target', value: k.value.overdue, sub: 'Perlu segera ditangani', color: k.value.overdue ? '#B42318' : undefined },
  { label: 'Menghambat termin', value: k.value.blocking, sub: 'Prioritaskan lebih dulu', color: k.value.blocking ? '#B54708' : undefined },
  { label: 'Selesai 30 hari', value: k.value.doneLast30, sub: k.value.avgDoneDays === null ? 'Belum ada yang selesai' : `Rata-rata ${k.value.avgDoneDays} hari`, color: k.value.doneLast30 ? '#067647' : undefined },
])
const topTasks = computed(() => (data.value?.tasks ?? []).slice(0, 6))

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
  <UiPageHeader :title="`Halo, ${firstName}`" subtitle="Ringkasan tugas bug dan proyek yang Anda kerjakan.">
    <template #actions>
      <NuxtLink v-if="can('bug', 'lihat')" to="/tugas" class="btn-primary">Buka Tugas Saya</NuxtLink>
    </template>
  </UiPageHeader>

  <section v-if="k" aria-label="Ringkasan" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]" :aria-busy="pending">
    <UiKpi v-for="s in stats" :key="s.label" :label="s.label" :value="s.value" :sub="s.sub" :color="s.color" />
  </section>

  <section v-if="data?.attention.length" aria-label="Perlu perhatian" class="card-pad flex flex-col gap-3 border-l-4 !border-l-danger-700">
    <h2 class="section-title">Perlu perhatian</h2>
    <ul class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
      <li v-for="b in data.attention" :key="b.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <span class="text-xs font-mono text-muted">{{ b.code }}</span>
        <NuxtLink :to="`/bugs/${b.id}`" class="text-sm font-semibold !text-ink hover:!text-brand-700 flex-1 min-w-48">{{ b.title }}</NuxtLink>
        <UiBadge :tone="BUG_SEVERITY[b.severity]" />
        <UiBadge :tone="BUG_STATUS[b.status]" />
        <span v-if="b.overdue" class="badge bg-danger-50 text-danger-700">lewat target {{ dateId(b.targetDate) }}</span>
        <span v-if="b.blocksTerm" class="badge bg-warning-50 text-warning-700">menghambat termin</span>
        <span class="text-xs text-info-700">{{ b.projectName }}</span>
        <button
          v-if="nextStatus(b.status) && can('bug', 'ditugaskan')"
          type="button" class="btn-secondary btn-sm" :disabled="busy === b.id"
          @click="advance(b.id, b.code, nextStatus(b.status)!)"
        >{{ BUG_ADVANCE_LABEL[b.status] }}</button>
        <span v-else-if="b.status === 'review'" class="text-xs text-muted">Menunggu review</span>
      </li>
    </ul>
  </section>

  <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
    <section class="card-pad flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="section-title">Tugas berikutnya</h2>
        <NuxtLink v-if="can('bug', 'lihat')" to="/tugas" class="text-sm font-semibold">Lihat semua</NuxtLink>
      </div>
      <ul v-if="topTasks.length" class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
        <li v-for="b in topTasks" :key="b.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <span class="text-xs font-mono text-muted">{{ b.code }}</span>
          <div class="flex-1 min-w-48 flex flex-col">
            <NuxtLink :to="`/bugs/${b.id}`" class="text-sm font-semibold !text-ink hover:!text-brand-700">{{ b.title }}</NuxtLink>
            <span class="text-xs text-muted">{{ b.projectName }}<template v-if="b.targetDate"> · target {{ dateId(b.targetDate) }}</template></span>
          </div>
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
      <UiEmpty v-else title="Tidak ada tugas aktif" text="Bug yang ditugaskan kepada Anda akan muncul di sini." />
    </section>

    <section class="card-pad flex flex-col gap-4">
      <h2 class="section-title">Proyek saya</h2>
      <ul v-if="data?.projects.length" class="m-0 p-0 list-none flex flex-col gap-4">
        <li v-for="p in data.projects" :key="p.id" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <NuxtLink :to="`/projects/${p.id}`" class="text-sm font-semibold !text-ink hover:!text-brand-700 truncate">{{ p.name }}</NuxtLink>
            <UiBadge :tone="PROJECT_STATUS[p.status]" />
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2 rounded-full bg-soft-2 overflow-hidden" role="progressbar" :aria-valuenow="p.progress" aria-valuemin="0" aria-valuemax="100" :aria-label="`Progress ${p.name}`">
              <div class="h-full bg-brand-600" :style="{ width: `${p.progress}%` }" />
            </div>
            <span class="text-xs font-semibold w-9 text-right">{{ p.progress }}%</span>
          </div>
          <span class="text-xs text-muted">
            <template v-if="p.nextMilestone">Berikutnya: {{ p.nextMilestone.name }}<template v-if="p.nextMilestone.targetDate"> ({{ dateId(p.nextMilestone.targetDate) }})</template> · </template>
            {{ p.openBugs }} bug Anda di proyek ini
          </span>
        </li>
      </ul>
      <UiEmpty v-else title="Belum ada proyek" text="Anda belum ditugaskan ke proyek mana pun." />
    </section>
  </div>
</template>
