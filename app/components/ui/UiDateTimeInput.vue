<script setup lang="ts">
/**
 * Input tanggal/jam berbahasa Indonesia. v-model:
 *  - mode="date"     → 'YYYY-MM-DD'
 *  - mode="datetime" → 'YYYY-MM-DDTHH:mm'
 *  - mode="time"     → 'HH:mm'
 * Minggu mulai Senin, jam ditampilkan dengan titik (14.30).
 */
const props = withDefaults(defineProps<{
  modelValue: string | null
  mode?: 'date' | 'datetime' | 'time'
  label?: string
  ariaLabel?: string
  placeholder?: string
  size?: 'md' | 'sm'
  min?: string | null
  disabled?: boolean
  clearable?: boolean
  error?: string
}>(), { mode: 'date', size: 'md', clearable: true })
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const pad = (n: number) => String(n).padStart(2, '0')
const id = useId()
const root = ref<HTMLElement | null>(null)
const btn = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const grid = ref<HTMLElement | null>(null)
const open = ref(false)

const hasDate = computed(() => props.mode !== 'time')
const hasTime = computed(() => props.mode !== 'date')

function parse(v: string | null) {
  if (!v) return { date: null as string | null, h: 9, m: 0 }
  if (props.mode === 'time') { const [h, m] = v.split(':').map(Number); return { date: null, h: h ?? 9, m: m ?? 0 } }
  const [d, t] = v.split('T')
  const [h, m] = (t || '09:00').split(':').map(Number)
  return { date: d!, h: h ?? 9, m: m ?? 0 }
}
const draft = ref(parse(props.modelValue))
const view = ref<[number, number]>([2026, 0])
const focusDate = ref<string>(todayISO())

const display = computed(() => {
  const v = parse(props.modelValue)
  if (!props.modelValue) return props.placeholder ?? (props.mode === 'time' ? 'Pilih jam' : props.mode === 'date' ? 'Pilih tanggal' : 'Pilih tanggal & jam')
  const time = `${pad(v.h)}.${pad(v.m)}`
  if (props.mode === 'time') return time
  return props.mode === 'date' ? dateId(v.date) : `${dateId(v.date)}, ${time}`
})

const { place } = useFloatingPanel({ anchor: btn, panel, root, open, maxHeight: 520, onOutside: () => { open.value = false } })

async function openPicker() {
  if (props.disabled) return
  draft.value = parse(props.modelValue)
  const base = draft.value.date ?? todayISO()
  const [y, m] = base.split('-').map(Number)
  view.value = [y!, m! - 1]
  focusDate.value = base
  open.value = true
  await nextTick()
  place()
  await nextTick() // tunggu panel terlihat sebelum memindahkan fokus
  grid.value?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
}
function close(returnFocus = false) {
  open.value = false
  if (returnFocus) nextTick(() => btn.value?.focus())
}

const days = computed(() => {
  const [vy, vm] = view.value
  const first = new Date(Date.UTC(vy, vm, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const out = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(vy, vm, 1 - offset + i))
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    out.push({
      key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === vm,
      sel: key === draft.value.date, today: key === todayISO(), off: !!props.min && key < props.min,
      aria: dateLongId(key),
    })
  }
  return out
})

function emitValue(d: { date: string | null, h: number, m: number }) {
  if (props.mode === 'time') emit('update:modelValue', `${pad(d.h)}:${pad(d.m)}`)
  else if (!d.date) emit('update:modelValue', null)
  else emit('update:modelValue', props.mode === 'date' ? d.date : `${d.date}T${pad(d.h)}:${pad(d.m)}`)
}
function pickDay(key: string, off: boolean) {
  if (off) return
  draft.value = { ...draft.value, date: key }
  focusDate.value = key
  if (props.mode === 'date') { emitValue(draft.value); close(true) }
}
function shiftMonth(n: number) {
  const d = new Date(Date.UTC(view.value[0], view.value[1] + n, 1))
  view.value = [d.getUTCFullYear(), d.getUTCMonth()]
}
function onGridKey(e: KeyboardEvent) {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  if (step[e.key] !== undefined) {
    e.preventDefault()
    focusDate.value = addDays(focusDate.value, step[e.key]!)
    const [y, m] = focusDate.value.split('-').map(Number)
    if (y !== view.value[0] || m! - 1 !== view.value[1]) view.value = [y!, m! - 1]
    nextTick(() => grid.value?.querySelector<HTMLElement>('[tabindex="0"]')?.focus())
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pickDay(focusDate.value, !!props.min && focusDate.value < props.min)
  }
}
function setNow() {
  const today = todayISO()
  const now = new Date()
  if (props.mode === 'date') { emit('update:modelValue', today); close(true); return }
  draft.value = { date: today, h: now.getHours(), m: Math.floor(now.getMinutes() / 5) * 5 }
  view.value = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
}
function apply() { emitValue(draft.value); close(true) }
function clear() { emit('update:modelValue', null); close(true) }
const hours = Array.from({ length: 24 }, (_, i) => i)
const mins = Array.from({ length: 12 }, (_, i) => i * 5)
</script>

<template>
  <div ref="root" class="relative flex flex-col gap-1.5">
    <span v-if="label" :id="`${id}-label`" class="text-sm font-semibold text-ink-2">{{ label }}</span>
    <button
      ref="btn"
      type="button"
      :aria-labelledby="label ? `${id}-label ${id}-value` : undefined"
      :aria-label="!label ? `${ariaLabel ?? 'Tanggal'}: ${display}` : undefined"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :disabled="disabled"
      class="flex items-center gap-2 w-full px-3 rounded-lg border bg-white text-left text-sm transition disabled:bg-soft-2"
      :class="[size === 'sm' ? 'min-h-9' : 'min-h-11', open ? 'border-brand-600 ring-4 ring-brand-50' : error ? 'border-danger-600' : 'border-line']"
      @click="open ? close() : openPicker()" @keydown.esc.stop="close(true)"
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="mode === 'time' ? 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' : 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4'" /></svg>
      <span :id="`${id}-value`" class="flex-1 truncate" :class="modelValue ? 'text-ink' : 'text-subtle'">{{ display }}</span>
    </button>
    <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      role="dialog"
      aria-modal="false"
      :aria-label="label || ariaLabel || 'Pilih tanggal'"
      class="fixed z-[110] overflow-auto bg-white border border-line-2 rounded-xl shadow-xl p-3 flex flex-col gap-3 w-max max-w-[calc(100vw-16px)]"
      style="visibility: hidden"
      @keydown.esc.stop="close(true)"
    >
      <div class="flex gap-3 flex-wrap">
        <div v-if="hasDate" class="w-[266px]">
          <div class="flex items-center justify-between mb-2">
            <button type="button" class="btn-icon !w-9 !h-9" aria-label="Bulan sebelumnya" @click="shiftMonth(-1)">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span class="text-sm font-bold" aria-live="polite">{{ MONTHS_LONG[view[1]] }} {{ view[0] }}</span>
            <button type="button" class="btn-icon !w-9 !h-9" aria-label="Bulan berikutnya" @click="shiftMonth(1)">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div class="grid grid-cols-7 text-center text-[11px] font-semibold text-muted mb-1" aria-hidden="true">
            <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
          </div>
          <div ref="grid" role="grid" class="grid grid-cols-7 gap-0.5" @keydown="onGridKey">
            <button
              v-for="d in days"
              :key="d.key"
              type="button"
              role="gridcell"
              :tabindex="d.key === focusDate ? 0 : -1"
              :aria-selected="d.sel"
              :aria-disabled="d.off || undefined"
              :aria-label="d.aria"
              :aria-current="d.today ? 'date' : undefined"
              class="relative h-9 rounded-md text-[13px] tabular-nums"
              :class="[
                d.sel ? 'bg-brand-600 text-white font-bold' : d.off ? 'text-[#C4C9D1] line-through cursor-not-allowed' : d.inMonth ? 'text-ink hover:bg-soft-2' : 'text-subtle hover:bg-soft-2',
              ]"
              @click="pickDay(d.key, d.off)"
            >
              {{ d.day }}
              <span v-if="d.today && !d.sel" aria-hidden="true" class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-600" />
            </button>
          </div>
        </div>
        <div v-if="hasTime" class="flex gap-2" :class="hasDate && 'border-l border-line-2 pl-3'">
          <div class="flex flex-col">
            <span class="text-[11px] font-semibold text-muted mb-1 text-center">Jam</span>
            <div role="listbox" aria-label="Jam" class="h-[262px] overflow-auto flex flex-col gap-0.5 pr-1">
              <button v-for="h in hours" :key="h" type="button" role="option" :aria-selected="draft.h === h" class="w-12 min-h-8 rounded-md text-[13px] tabular-nums" :class="draft.h === h ? 'bg-brand-600 text-white font-bold' : 'hover:bg-soft-2'" @click="draft = { ...draft, h }">{{ pad(h) }}</button>
            </div>
          </div>
          <div class="flex flex-col">
            <span class="text-[11px] font-semibold text-muted mb-1 text-center">Menit</span>
            <div role="listbox" aria-label="Menit" class="h-[262px] overflow-auto flex flex-col gap-0.5 pr-1">
              <button v-for="m in mins" :key="m" type="button" role="option" :aria-selected="draft.m === m" class="w-12 min-h-8 rounded-md text-[13px] tabular-nums" :class="draft.m === m ? 'bg-brand-600 text-white font-bold' : 'hover:bg-soft-2'" @click="draft = { ...draft, m }">{{ pad(m) }}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 border-t border-line-3 pt-2">
        <div class="flex gap-1">
          <button type="button" class="btn-ghost btn-sm" @click="setNow">{{ mode === 'date' ? 'Hari ini' : 'Sekarang' }}</button>
          <button v-if="clearable" type="button" class="btn-ghost btn-sm" @click="clear">Kosongkan</button>
        </div>
        <button v-if="hasTime" type="button" class="btn-primary btn-sm" @click="apply">Terapkan</button>
      </div>
    </div>
    </Teleport>
    <span v-if="error" class="error-text">{{ error }}</span>
  </div>
</template>
