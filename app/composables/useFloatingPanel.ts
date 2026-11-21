import type { Ref } from 'vue'

interface Options {
  /** Elemen acuan posisi (biasanya tombol pemicu). */
  anchor: Ref<HTMLElement | null | undefined>
  /** Panel melayang (di-teleport ke body, position: fixed). */
  panel: Ref<HTMLElement | null | undefined>
  open: Ref<boolean>
  /** Elemen pembungkus untuk deteksi klik di luar (default: anchor). */
  root?: Ref<HTMLElement | null | undefined>
  /** Samakan lebar panel dengan pemicu. */
  matchWidth?: boolean
  minWidth?: number
  /** Tinggi maksimum panel (px) bila ruang layar cukup. */
  maxHeight?: number
  align?: 'start' | 'end'
  onOutside: () => void
}

/**
 * Posisi panel dropdown/kalender di luar kontainer ber-overflow (mis. dialog):
 * tinggi menyesuaikan sisa ruang layar, membuka ke atas bila di bawah tidak muat,
 * dan mengikuti pemicu saat halaman/dialog di-scroll sehingga tidak ada scroll ganda.
 */
export function useFloatingPanel(o: Options) {
  function place() {
    const a = o.anchor.value
    const p = o.panel.value
    if (!a || !p) return
    const r = a.getBoundingClientRect()
    const margin = 8
    const gap = 4
    p.style.maxHeight = 'none'
    p.style.width = o.matchWidth ? `${Math.max(r.width, o.minWidth ?? 0)}px` : ''
    const natural = p.offsetHeight
    const width = p.offsetWidth
    const below = window.innerHeight - r.bottom - gap - margin
    const above = r.top - gap - margin
    const down = natural <= below || below >= above
    const avail = Math.max(140, down ? below : above)
    const height = Math.min(natural, avail, o.maxHeight ?? 480)
    p.style.maxHeight = `${Math.round(Math.min(avail, o.maxHeight ?? 480))}px`
    const top = down ? r.bottom + gap : r.top - gap - height
    let left = o.align === 'end' ? r.right - width : r.left
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    p.style.top = `${Math.round(Math.max(margin, top))}px`
    p.style.left = `${Math.round(left)}px`
    p.style.visibility = 'visible'
  }

  const outside = (e: Event) => {
    const t = e.target as Node
    const root = (o.root ?? o.anchor).value
    if (root?.contains(t) || o.panel.value?.contains(t)) return
    o.onOutside()
  }
  const reflow = (e: Event) => {
    if (o.panel.value?.contains(e.target as Node)) return
    place()
  }

  watch(o.open, (isOpen) => {
    const fn = isOpen ? 'addEventListener' : 'removeEventListener'
    document[fn]('pointerdown', outside, true)
    window[fn]('scroll', reflow, true)
    window[fn]('resize', reflow as EventListener)
    if (isOpen) nextTick(place)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('scroll', reflow, true)
    window.removeEventListener('resize', reflow as EventListener)
  })

  return { place }
}
