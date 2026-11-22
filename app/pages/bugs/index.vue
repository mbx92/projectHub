<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['bug', 'lihat'] })
useHead({ title: 'Bug Tracker — OCN Project Hub' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { user, can } = useAuth()
const isAdmin = computed(() => can('bug', 'kelola'))
const { data: projects } = await useFetch('/api/projects', { default: () => ({ projects: [] as any[], summary: null, dues: [] }) })
const projectList = computed(() => (projects.value?.projects ?? []).map(p => ({ id: p.id as number, name: p.name as string })))
const projectId = ref<number | null>(Number(route.query.project) || null)
watch(projectId, v => router.replace({ query: { ...route.query, project: v ?? undefined } }))
const { data: bugs, refresh } = await useFetch('/api/bugs', { query: { projectId }, watch: [projectId], default: () => [] })

const sev = ref<BugSeverity | 'semua'>('semua')
const mine = ref(false)
const filtered = computed(() => bugs.value
  .filter(b => sev.value === 'semua' || b.severity === sev.value)
  .filter(b => !mine.value || b.assigneeId === user.value?.id)
  .sort((a, b) => BUG_SEVERITY[a.severity].order - BUG_SEVERITY[b.severity].order || +new Date(b.createdAt) - +new Date(a.createdAt)))
const COLS: { key: BugStatus, name: string, dot: string }[] = [
  { key: 'open', name: 'Open', dot: '#B42318' },
  { key: 'dikerjakan', name: 'Dikerjakan', dot: '#175CD3' },
  { key: 'review', name: 'Review', dot: '#B54708' },
  { key: 'selesai', name: 'Selesai', dot: '#067647' },
]
const columns = computed(() => COLS.map(c => ({ ...c, items: filtered.value.filter(b => b.status === c.key) })))
const stats = computed(() => [
  { label: 'Terbuka', value: bugs.value.filter(b => b.status !== 'selesai').length },
  { label: 'Kritis terbuka', value: bugs.value.filter(b => b.status !== 'selesai' && b.severity === 'kritis').length, color: '#B42318' },
  { label: 'Menghambat termin', value: bugs.value.filter(b => b.status !== 'selesai' && b.blocksTerm).length, color: '#B54708' },
  { label: 'Selesai 30 hari', value: bugs.value.filter(b => b.status === 'selesai' && b.resolvedAt && daysBetween(toISODate(new Date(b.resolvedAt)), todayISO()) <= 30).length, color: '#067647' },
])
const chips = computed(() => [
  { key: 'semua' as const, label: 'Semua', count: bugs.value.length },
  ...(Object.keys(BUG_SEVERITY) as BugSeverity[]).map(k => ({ key: k, label: BUG_SEVERITY[k].label, count: bugs.value.filter(b => b.severity === k).length })),
])

const dragging = ref<number | null>(null)
const overCol = ref<BugStatus | null>(null)
async function move(bugId: number, status: BugStatus) {
  const b = bugs.value.find(x => x.id === bugId)
  if (!b || b.status === status) return
  const prev = b.status
  b.status = status
  try {
    await $fetch<unknown>(`/api/bugs/${bugId}`, { method: 'PATCH', body: { status } })
    toast.success(`${b.code} → ${BUG_STATUS[status].label}`)
  } catch (e) {
    b.status = prev
    toast.error(errorMessage(e))
  }
}
function onDragStart(e: DragEvent, id: number) {
  // Firefox menolak drag tanpa data; efek 'move' membuat kursor drop valid di semua browser.
  e.dataTransfer?.setData('text/plain', String(id))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  // Tunda perubahan state agar re-render tidak membatalkan drag yang baru mulai.
  setTimeout(() => { dragging.value = id })
}
function onDragOver(e: DragEvent, status: BugStatus) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overCol.value = status
}
function onDrop(e: DragEvent, status: BugStatus) {
  const id = dragging.value ?? Number(e.dataTransfer?.getData('text/plain'))
  if (id) move(id, status)
  dragging.value = null
  overCol.value = null
}
const nextStatus = (s: BugStatus): BugStatus | null => ({ open: 'dikerjakan', dikerjakan: 'review', review: 'selesai', selesai: null } as const)[s]
const showBug = ref(route.query.lapor === '1')
</script>

<template>
  <UiPageHeader title="Bug Tracker" subtitle="Laporan bug per proyek: Open → Dikerjakan → Review → Selesai.">
    <template #actions>
      <div class="w-64"><UiSearchSelect v-model="projectId" :options="[{ value: null, label: 'Semua proyek' }, ...projectList.map(p => ({ value: p.id as number | null, label: p.name }))]" aria-label="Proyek" search-placeholder="Cari proyek…" placeholder="Semua proyek" /></div>
      <NuxtLink v-if="projectId" :to="`/projects/${projectId}?tab=bug`" class="btn-secondary">Buka detail proyek</NuxtLink>
      <button type="button" class="btn-primary" v-if="can('bug', 'ditugaskan')" :disabled="!projectList.length" @click="showBug = true">+ Laporkan Bug</button>
    </template>
  </UiPageHeader>

  <section aria-label="Statistik bug" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
    <UiKpi v-for="s in stats" :key="s.label" :label="s.label" :value="s.value" :color="s.value ? s.color : undefined" />
  </section>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div role="group" aria-label="Filter tingkat keparahan" class="pill-tabs">
      <button v-for="c in chips" :key="c.key" type="button" class="pill-tab" :aria-pressed="sev === c.key" @click="sev = c.key">{{ c.label }} · {{ c.count }}</button>
    </div>
    <div class="flex items-center gap-4">
      <label class="flex items-center gap-2 text-sm cursor-pointer min-h-11"><input v-model="mine" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Ditugaskan ke saya</label>
      <span class="text-xs text-muted">Diurutkan: keparahan, lalu terbaru</span>
    </div>
  </div>

  <div class="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start">
    <section
      v-for="col in columns"
      :key="col.key"
      :aria-label="col.name"
      class="min-w-0 rounded-xl bg-soft-2 p-3 flex flex-col gap-3 min-h-40 transition"
      :class="overCol === col.key && 'ring-2 ring-brand-600 bg-brand-soft'"
      @dragover.prevent="onDragOver($event, col.key)"
      @dragleave="(e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) overCol = null }"
      @drop.prevent="onDrop($event, col.key)"
    >
      <h2 class="m-0 flex items-center justify-between text-sm font-bold px-1">
        <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" :style="{ background: col.dot }" />{{ col.name }}</span>
        <span class="text-xs font-semibold text-muted bg-white rounded-full px-2 py-0.5">{{ col.items.length }}</span>
      </h2>
      <article
        v-for="b in col.items"
        :key="b.id"
        draggable="true"
        class="min-w-0 overflow-hidden bg-white rounded-lg border border-line-2 p-3 flex flex-col gap-2 shadow-xs cursor-grab active:cursor-grabbing"
        :class="dragging === b.id && 'opacity-50'"
        @dragstart="onDragStart($event, b.id)"
        @dragend="dragging = null; overCol = null"
      >
        <div class="flex items-center justify-between gap-2 min-w-0">
          <span class="text-xs font-mono text-muted shrink-0">{{ b.code }}</span>
          <UiBadge :tone="BUG_SEVERITY[b.severity]" />
        </div>
        <span v-if="!projectId" class="block truncate text-xs font-medium text-info-700" :title="b.projectName">{{ b.projectName }}</span>
        <NuxtLink :to="`/bugs/${b.id}`" class="text-sm font-semibold !text-ink hover:!text-brand-700 leading-snug break-words">{{ b.title }}</NuxtLink>
        <div v-if="b.module || (b.blocksTerm && b.status !== 'selesai')" class="flex flex-wrap gap-1.5 min-w-0">
          <span v-if="b.module" class="badge bg-soft-2 text-ink-2 !py-0.5 max-w-full" :title="b.module"><span class="truncate">{{ b.module }}</span></span>
          <span v-if="b.blocksTerm && b.status !== 'selesai'" class="badge bg-warning-50 text-warning-700 !py-0.5">menghambat termin</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-muted">{{ dateId(b.createdAt) }}<template v-if="b.targetDate"> · target {{ dateId(b.targetDate) }}</template></span>
          <UiAvatar v-if="b.assigneeName" :name="b.assigneeName" :color="b.assigneeColor" :size="24" />
        </div>
        <div class="flex items-center justify-between gap-2 border-t border-line-3 pt-2">
          <span class="text-[11px] text-muted truncate">Dilaporkan oleh {{ b.reporter ?? '—' }}</span>
          <button
            v-if="nextStatus(b.status) && (isAdmin || (can('bug', 'ditugaskan') && b.assigneeId === user?.id && nextStatus(b.status) !== 'selesai'))"
            type="button"
            class="text-xs font-semibold text-brand-700 whitespace-nowrap min-h-8"
            @click="move(b.id, nextStatus(b.status)!)"
          >→ {{ BUG_STATUS[nextStatus(b.status)!].label }}</button>
        </div>
      </article>
      <div v-if="!col.items.length" class="text-xs text-muted text-center py-6">Tidak ada bug di filter ini</div>
    </section>
  </div>

  <BugModal :open="showBug" :project-id="projectId" :projects="projectList" @close="showBug = false" @saved="() => refresh()" />
</template>
