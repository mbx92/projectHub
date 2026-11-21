<script setup lang="ts">
/** Dialog konfirmasi global — dipanggil lewat useConfirm().confirm({...}). */
const { state, close } = useConfirm()
const typed = ref('')
const loading = ref(false)
const err = ref('')
const dialog = ref<HTMLElement | null>(null)
let lastFocus: HTMLElement | null = null

const V = {
  danger: { bg: '#FEE4E2', fg: '#B42318', btn: 'btn-danger', path: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3' },
  success: { bg: '#E6F4F1', fg: '#08544B', btn: 'btn-primary', path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6' },
  warning: { bg: '#FEF0C7', fg: '#B54708', btn: 'btn-primary', path: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' },
  info: { bg: '#E8F0FE', fg: '#175CD3', btn: 'btn-primary', path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01' },
}
const v = computed(() => V[state.value.variant ?? 'info'])
const blocked = computed(() => loading.value || (!!state.value.requireText && typed.value.trim() !== state.value.requireText.trim()))

watch(() => state.value.open, (o) => {
  if (o) {
    typed.value = ''
    err.value = ''
    loading.value = false
    lastFocus = document.activeElement as HTMLElement
    nextTick(() => (dialog.value?.querySelector<HTMLElement>('input') ?? dialog.value?.querySelector<HTMLElement>('[data-cancel]'))?.focus())
  } else {
    nextTick(() => lastFocus?.focus())
  }
})

async function confirm() {
  if (blocked.value) return
  if (state.value.action) {
    loading.value = true
    err.value = ''
    try {
      await state.value.action()
      close(true)
    } catch (e) {
      err.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  } else {
    close(true)
  }
}
function cancel() { if (!loading.value) close(false) }

function trap(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !dialog.value) return
  const els = [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), input')]
  if (!els.length) return
  const first = els[0]!, last = els[els.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @keydown.esc="cancel" @keydown="trap">
      <div class="absolute inset-0 bg-navy/50" aria-hidden="true" @click="cancel" />
      <div
        ref="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        class="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        <span class="w-11 h-11 rounded-full flex items-center justify-center" :style="{ background: v.bg, color: v.fg }">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="v.path" /></svg>
        </span>
        <div class="flex flex-col gap-1.5">
          <h2 id="confirm-title" class="m-0 text-lg font-bold">{{ state.title }}</h2>
          <p v-if="state.message" id="confirm-msg" class="m-0 text-sm text-muted leading-relaxed whitespace-pre-line">{{ state.message }}</p>
        </div>
        <label v-if="state.requireText" class="field">
          <span class="font-normal text-muted">Ketik <code class="font-semibold text-ink bg-soft-2 px-1.5 py-0.5 rounded">{{ state.requireText }}</code> untuk konfirmasi</span>
          <input v-model="typed" class="input" autocomplete="off" @keydown.enter="confirm">
        </label>
        <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{{ err }}</p>
        <div class="flex justify-end gap-2 flex-wrap">
          <button type="button" data-cancel class="btn-secondary" :disabled="loading" @click="cancel">{{ state.cancelText ?? 'Batal' }}</button>
          <button type="button" :class="v.btn" :disabled="blocked" :aria-busy="loading" @click="confirm">
            <svg v-if="loading" aria-hidden="true" class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
            {{ state.confirmText ?? 'Lanjutkan' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
