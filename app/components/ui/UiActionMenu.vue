<script setup lang="ts">
/**
 * Tombol aksi "…" dengan dropdown. Menu di-teleport ke <body> (position: fixed) sehingga tidak
 * terpotong oleh tabel / kartu ber-overflow, dan otomatis membuka ke atas bila tidak muat di bawah.
 * Aksesibel: role="menu", panah atas/bawah, Home/End, Esc mengembalikan fokus ke tombol.
 */
export interface ActionItem {
  label: string
  /** Navigasi internal. */
  to?: string
  /** Tautan biasa (unduhan / tab baru). */
  href?: string
  external?: boolean
  danger?: boolean
  hidden?: boolean
  onClick?: () => void | Promise<void>
}

const props = withDefaults(defineProps<{ items: ActionItem[], label?: string, align?: 'end' | 'start' }>(), { label: 'Aksi', align: 'end' })

const id = useId()
const open = ref(false)
const placed = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const pos = reactive({ top: 0, left: 0 })
const visible = computed(() => props.items.filter(i => !i.hidden))

const menuItems = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

function place() {
  const t = trigger.value
  const m = menu.value
  if (!t || !m) return
  const r = t.getBoundingClientRect()
  const w = m.offsetWidth
  const h = m.offsetHeight
  let left = props.align === 'end' ? r.right - w : r.left
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
  let top = r.bottom + 4
  if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4
  pos.top = Math.max(8, top)
  pos.left = left
  placed.value = true
}

async function openMenu(focusFirst: boolean) {
  open.value = true
  placed.value = false
  await nextTick()
  place()
  await nextTick() // tunggu menu terlihat (visibility) sebelum memindahkan fokus
  if (focusFirst) menuItems()[0]?.focus()
  else menu.value?.focus()
}
function close(returnFocus = false) {
  if (!open.value) return
  open.value = false
  if (returnFocus) nextTick(() => trigger.value?.focus())
}
function toggle() { open.value ? close() : openMenu(false) }

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(true) }
}
function onMenuKey(e: KeyboardEvent) {
  const els = menuItems()
  const i = els.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
  else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus() }
  else if (e.key === 'End') { e.preventDefault(); els.at(-1)?.focus() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
  else if (e.key === 'Tab') close()
}
async function run(item: ActionItem) {
  close(true)
  await item.onClick?.()
}

function onOutside(e: Event) {
  const t = e.target as Node
  if (menu.value?.contains(t) || trigger.value?.contains(t)) return
  close()
}
function onScroll(e: Event) {
  if (menu.value?.contains(e.target as Node)) return
  close()
}
watch(open, (o) => {
  const fn = o ? 'addEventListener' : 'removeEventListener'
  document[fn]('pointerdown', onOutside, true)
  window[fn]('scroll', onScroll, true)
  window[fn]('resize', onScroll as EventListener)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll as EventListener)
})

const itemClass = (it: ActionItem) => [
  'flex items-center w-full min-h-11 px-3 rounded-md text-sm font-medium text-left no-underline bg-transparent border-0 outline-none cursor-pointer',
  it.danger ? '!text-danger-700 hover:bg-danger-50 focus-visible:bg-danger-50' : '!text-ink hover:bg-soft-2 focus-visible:bg-soft-2',
]
</script>

<template>
  <span v-if="visible.length" class="inline-flex">
    <button
      ref="trigger"
      type="button"
      class="inline-flex items-center justify-center w-11 h-11 -my-2 rounded-lg text-muted hover:text-ink hover:bg-soft-2 transition-colors"
      :class="open && 'bg-soft-2 text-ink'"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? `${id}-menu` : undefined"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="`${id}-menu`"
        ref="menu"
        role="menu"
        tabindex="-1"
        :aria-label="label"
        class="fixed z-[60] min-w-52 max-w-[calc(100vw-16px)] bg-white border border-line-2 rounded-xl shadow-xl p-1 outline-none"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px`, visibility: placed ? 'visible' : 'hidden' }"
        @keydown="onMenuKey"
      >
        <template v-for="(it, i) in visible" :key="i">
          <NuxtLink v-if="it.to" :to="it.to" role="menuitem" tabindex="-1" :class="itemClass(it)" @click="close()">{{ it.label }}</NuxtLink>
          <a v-else-if="it.href" :href="it.href" :target="it.external ? '_blank' : undefined" :rel="it.external ? 'noopener' : undefined" role="menuitem" tabindex="-1" :class="itemClass(it)" @click="close()">{{ it.label }}</a>
          <button v-else type="button" role="menuitem" tabindex="-1" :class="itemClass(it)" @click="run(it)">{{ it.label }}</button>
        </template>
      </div>
    </Teleport>
  </span>
</template>
