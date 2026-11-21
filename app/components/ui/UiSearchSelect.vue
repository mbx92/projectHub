<script setup lang="ts" generic="T extends string | number | null">
export interface SearchOption<V> { value: V, label: string, desc?: string, group?: string, disabled?: boolean }

const props = withDefaults(defineProps<{
  modelValue: T
  options: SearchOption<T>[]
  label?: string
  ariaLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  footer?: string
  disabled?: boolean
  error?: string
  clearable?: boolean
}>(), { placeholder: 'Pilih…', searchPlaceholder: 'Cari…' })
const emit = defineEmits<{ 'update:modelValue': [T], 'change': [T], 'footer': [query: string] }>()

const id = useId()
const open = ref(false)
const query = ref('')
const active = ref(0)
const root = ref<HTMLElement | null>(null)
const btn = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const current = computed(() => props.options.find(o => o.value === props.modelValue))

const { place } = useFloatingPanel({ anchor: btn, panel, root, open, matchWidth: true, minWidth: 256, maxHeight: 420, onOutside: () => { open.value = false } })

const q = computed(() => query.value.trim().toLowerCase())
const hits = computed(() => props.options.filter(o => !q.value || `${o.label} ${o.desc ?? ''}`.toLowerCase().includes(q.value)))
const rows = computed(() => {
  const out: ({ kind: 'group', label: string } | { kind: 'opt', o: SearchOption<T>, i: number })[] = []
  let last: string | undefined
  hits.value.forEach((o, i) => {
    if (o.group && o.group !== last) { out.push({ kind: 'group', label: o.group }); last = o.group }
    out.push({ kind: 'opt', o, i })
  })
  return out
})

function parts(text: string) {
  if (!q.value) return [{ t: text, m: false }]
  const out: { t: string, m: boolean }[] = []
  const lower = text.toLowerCase()
  let from = 0
  let at = lower.indexOf(q.value)
  while (at !== -1) {
    if (at > from) out.push({ t: text.slice(from, at), m: false })
    out.push({ t: text.slice(at, at + q.value.length), m: true })
    from = at + q.value.length
    at = lower.indexOf(q.value, from)
  }
  if (from < text.length) out.push({ t: text.slice(from), m: false })
  return out
}

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  query.value = ''
  if (open.value) {
    active.value = Math.max(0, hits.value.findIndex(o => o.value === props.modelValue))
    await nextTick()
    place()
    await nextTick() // tunggu panel terlihat sebelum memindahkan fokus
    input.value?.focus()
    scrollActive()
  }
}
function close(returnFocus = false) {
  open.value = false
  if (returnFocus) nextTick(() => btn.value?.focus())
}
function pick(o: SearchOption<T>) {
  if (o.disabled) return
  emit('update:modelValue', o.value)
  emit('change', o.value)
  close(true)
}
function scrollActive() {
  listEl.value?.querySelector<HTMLElement>(`[data-i="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
}
function onKey(e: KeyboardEvent) {
  const n = hits.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!n) return
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    nextTick(scrollActive)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const o = hits.value[active.value]
    if (o) pick(o)
  } else if (e.key === 'Escape') {
    e.stopPropagation()
    close(true)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    close(true)
  }
}
watch(query, () => { active.value = 0; nextTick(place) })
</script>

<template>
  <div ref="root" class="relative flex flex-col gap-1.5">
    <span v-if="label" :id="`${id}-label`" class="text-sm font-semibold text-ink-2">{{ label }}</span>
    <button
      ref="btn"
      type="button"
      :aria-labelledby="label ? `${id}-label` : undefined"
      :aria-label="!label ? ariaLabel : undefined"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :disabled="disabled"
      class="flex items-center gap-2 w-full min-h-11 px-3 rounded-lg border bg-white text-left text-sm transition disabled:bg-soft-2"
      :class="open ? 'border-brand-600 ring-4 ring-brand-50' : error ? 'border-danger-600' : 'border-line'"
      @click="toggle"
      @keydown.down.prevent="toggle"
    >
      <span class="flex-1 truncate" :class="current ? 'text-ink' : 'text-subtle'">{{ current?.label ?? placeholder }}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
    </button>
    <Teleport to="body">
      <div v-if="open" ref="panel" class="fixed z-[110] flex flex-col bg-white border border-line-2 rounded-lg shadow-xl overflow-hidden" style="visibility: hidden">
        <div class="p-2 border-b border-line-3 shrink-0">
          <input
            ref="input"
            v-model="query"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="true"
            :aria-controls="`${id}-list`"
            :aria-activedescendant="hits[active] ? `${id}-opt-${active}` : undefined"
            :aria-label="searchPlaceholder"
            :placeholder="searchPlaceholder"
            class="input input-sm"
            @keydown="onKey"
          >
        </div>
        <ul :id="`${id}-list`" ref="listEl" role="listbox" class="flex-1 min-h-0 overflow-auto p-1 m-0 list-none">
          <template v-for="r in rows" :key="r.kind === 'group' ? `g-${r.label}` : `o-${String(r.o.value)}`">
            <li v-if="r.kind === 'group'" role="presentation" class="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-faint">{{ r.label }}</li>
            <li
              v-else
              :id="`${id}-opt-${r.i}`"
              :data-i="r.i"
              role="option"
              :aria-selected="r.o.value === modelValue"
              :aria-disabled="r.o.disabled || undefined"
              class="flex flex-col gap-0.5 px-3 py-2 pointer-fine:py-1.5 rounded-md text-sm min-h-11 pointer-fine:min-h-9 justify-center"
              :class="[r.o.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer', r.o.value === modelValue ? 'bg-brand-50 font-semibold' : r.i === active ? 'bg-soft-2' : '']"
              @mousedown.prevent
              @mouseenter="active = r.i"
              @click="pick(r.o)"
            >
              <span><template v-for="(p, k) in parts(r.o.label)" :key="k"><mark v-if="p.m" class="bg-warning-50 text-ink rounded-sm">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span>
              <span v-if="r.o.desc" class="text-xs font-normal text-muted">{{ r.o.desc }}</span>
            </li>
          </template>
          <li v-if="!hits.length" class="px-3 py-3 text-sm text-muted">Tidak ada hasil<template v-if="query"> untuk “{{ query.trim() }}”</template></li>
        </ul>
        <div v-if="clearable && modelValue !== null" class="border-t border-line-3 p-1 shrink-0">
          <button type="button" class="btn-ghost btn-sm w-full justify-start" @click="emit('update:modelValue', null as T); emit('change', null as T); close(true)">Kosongkan pilihan</button>
        </div>
        <div v-if="footer" class="border-t border-line-3 p-1 shrink-0">
          <button type="button" class="btn-ghost btn-sm w-full justify-start text-brand-700" @click="emit('footer', query.trim()); close(true)">{{ footer }}</button>
        </div>
      </div>
    </Teleport>
    <span v-if="error" class="error-text">{{ error }}</span>
  </div>
</template>
