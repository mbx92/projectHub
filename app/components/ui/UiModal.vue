<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean, title: string, description?: string, width?: string }>(), { width: '560px' })
const emit = defineEmits<{ close: [] }>()
const id = useId()
const panel = ref<HTMLElement | null>(null)
let lastFocus: HTMLElement | null = null

watch(() => props.open, (o) => {
  if (o) {
    lastFocus = document.activeElement as HTMLElement
    nextTick(() => panel.value?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, button[role=combobox], select')?.focus())
  } else nextTick(() => lastFocus?.focus())
})

function trap(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panel.value) return
  const els = [...panel.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]')]
  if (!els.length) return
  const first = els[0]!, last = els[els.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 overflow-y-auto" @keydown.esc="emit('close')" @keydown="trap">
      <div class="fixed inset-0 bg-navy/50" aria-hidden="true" @click="emit('close')" />
      <div ref="panel" role="dialog" aria-modal="true" :aria-labelledby="`${id}-t`" class="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-32px)]" :style="{ maxWidth: width }">
        <div class="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div class="flex flex-col gap-1">
            <h2 :id="`${id}-t`" class="m-0 text-lg font-bold">{{ title }}</h2>
            <p v-if="description" class="m-0 text-sm text-muted">{{ description }}</p>
          </div>
          <button type="button" class="btn-ghost !min-h-10 !w-10 !p-0" aria-label="Tutup" @click="emit('close')">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div class="px-6 pb-4 overflow-y-auto flex flex-col gap-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="px-6 py-4 border-t border-line-3 flex flex-wrap justify-end gap-2">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
