import type { Ref } from 'vue'

/** Panggil handler saat klik/tap di luar elemen (dipakai dropdown & kalender). */
export function useClickOutside(target: Ref<HTMLElement | null | undefined>, handler: (e: Event) => void) {
  const listener = (e: Event) => {
    const el = target.value
    if (!el || el.contains(e.target as Node)) return
    handler(e)
  }
  onMounted(() => document.addEventListener('pointerdown', listener, true))
  onBeforeUnmount(() => document.removeEventListener('pointerdown', listener, true))
}
