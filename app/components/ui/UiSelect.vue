<script setup lang="ts" generic="T extends string | number | null">
export interface SelectOption<V> { value: V, label: string, desc?: string, dot?: string, disabled?: boolean }

const props = withDefaults(defineProps<{
  modelValue: T
  options: SelectOption<T>[]
  label?: string
  ariaLabel?: string
  placeholder?: string
  size?: 'md' | 'sm'
  disabled?: boolean
  error?: string
}>(), { size: 'md', placeholder: 'Pilih…' })
const emit = defineEmits<{ 'update:modelValue': [T], 'change': [T] }>()

const id = useId()
const open = ref(false)
const active = ref(-1)
const root = ref<HTMLElement | null>(null)
const btn = ref<HTMLButtonElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const current = computed(() => props.options.find(o => o.value === props.modelValue))

const { place } = useFloatingPanel({ anchor: btn, panel: listEl, root, open, matchWidth: true, minWidth: 160, maxHeight: 460, onOutside: () => { open.value = false } })

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    active.value = Math.max(0, props.options.findIndex(o => o.value === props.modelValue))
    await nextTick()
    place()
    scrollActive()
  }
}
function pick(o: SelectOption<T>) {
  if (o.disabled) return
  emit('update:modelValue', o.value)
  emit('change', o.value)
  open.value = false
}
function move(d: number) {
  if (!props.options.length) return
  let i = active.value
  for (let n = 0; n < props.options.length; n++) {
    i = (i + d + props.options.length) % props.options.length
    if (!props.options[i]!.disabled) break
  }
  active.value = i
  nextTick(scrollActive)
}
function scrollActive() {
  listEl.value?.querySelector<HTMLElement>(`[data-i="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) toggle()
    else move(e.key === 'ArrowDown' ? 1 : -1)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (open.value && active.value >= 0) pick(props.options[active.value]!)
    else toggle()
  } else if (e.key === 'Escape') {
    if (open.value) { e.stopPropagation(); open.value = false }
  } else if (e.key === 'Tab') {
    open.value = false
  }
}
</script>

<template>
  <div ref="root" class="relative flex flex-col gap-1.5">
    <span v-if="label" :id="`${id}-label`" class="text-sm font-semibold text-ink-2">{{ label }}</span>
    <button
      ref="btn"
      type="button"
      role="combobox"
      :aria-labelledby="label ? `${id}-label` : undefined"
      :aria-label="!label ? ariaLabel : undefined"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="open && active >= 0 ? `${id}-opt-${active}` : undefined"
      :disabled="disabled"
      class="flex items-center gap-2 w-full px-3 rounded-lg border bg-white text-left text-sm transition disabled:bg-soft-2 disabled:text-muted"
      :class="[size === 'sm' ? 'min-h-9' : 'min-h-11', open ? 'border-brand-600 ring-4 ring-brand-50' : error ? 'border-danger-600' : 'border-line']"
      @click="toggle"
      @keydown="onKey"
    >
      <span v-if="current?.dot" class="w-2 h-2 rounded-full shrink-0" :style="{ background: current.dot }" />
      <span class="flex-1 truncate" :class="current ? 'text-ink' : 'text-subtle'">{{ current?.label ?? placeholder }}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 transition-transform" :class="open && 'rotate-180'"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        :id="`${id}-list`"
        ref="listEl"
        role="listbox"
        :aria-labelledby="label ? `${id}-label` : undefined"
        :aria-label="!label ? ariaLabel : undefined"
        class="fixed z-[110] overflow-auto bg-white border border-line-2 rounded-lg shadow-xl p-1 m-0 list-none"
        style="visibility: hidden"
      >
        <li
          v-for="(o, i) in options"
          :id="`${id}-opt-${i}`"
          :key="String(o.value)"
          :data-i="i"
          role="option"
          :aria-selected="o.value === modelValue"
          :aria-disabled="o.disabled || undefined"
          class="flex items-start gap-2 px-3 py-2.5 pointer-fine:py-1.5 rounded-md text-sm min-h-11 pointer-fine:min-h-9"
          :class="[o.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer', o.value === modelValue ? 'bg-brand-50 font-semibold' : '', i === active && o.value !== modelValue ? 'bg-soft-2' : '']"
          @mousedown.prevent
          @mouseenter="active = i"
          @click="pick(o)"
        >
          <span v-if="o.dot" class="w-2 h-2 mt-1.5 rounded-full shrink-0" :style="{ background: o.dot }" />
          <span class="flex flex-col gap-0.5 flex-1">
            <span>{{ o.label }}</span>
            <span v-if="o.desc" class="text-xs font-normal text-muted">{{ o.desc }}</span>
          </span>
          <svg v-if="o.value === modelValue" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B6E63" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5"><path d="M5 12l5 5L20 7" /></svg>
        </li>
        <li v-if="!options.length" class="px-3 py-2.5 text-sm text-muted">Tidak ada pilihan</li>
      </ul>
    </Teleport>
    <span v-if="error" class="error-text">{{ error }}</span>
  </div>
</template>
