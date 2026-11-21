<script setup lang="ts">
/** Kanvas tanda tangan (jari/mouse/stylus). v-model berupa PNG data URL, atau null bila kosong. */
const props = defineProps<{ modelValue: string | null, label?: string, error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const wrap = ref<HTMLElement | null>(null)
let drawing = false
let last: { x: number, y: number } | null = null
const HEIGHT = 180

function ctx() { return canvas.value!.getContext('2d')! }

function setup() {
  const c = canvas.value
  if (!c || !wrap.value) return
  const dpr = window.devicePixelRatio || 1
  const w = wrap.value.clientWidth
  c.width = Math.round(w * dpr)
  c.height = Math.round(HEIGHT * dpr)
  c.style.width = `${w}px`
  c.style.height = `${HEIGHT}px`
  const g = ctx()
  g.scale(dpr, dpr)
  g.lineWidth = 2.4
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = '#101828'
}
onMounted(setup)

function pos(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function down(e: PointerEvent) {
  e.preventDefault()
  canvas.value!.setPointerCapture(e.pointerId)
  drawing = true
  last = pos(e)
  // titik tunggal tetap terlihat
  ctx().beginPath(); ctx().moveTo(last.x, last.y); ctx().lineTo(last.x + 0.01, last.y + 0.01); ctx().stroke()
}
function move(e: PointerEvent) {
  if (!drawing || !last) return
  e.preventDefault()
  const p = pos(e)
  const g = ctx()
  g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke()
  last = p
}
function up() {
  if (!drawing) return
  drawing = false
  last = null
  emit('update:modelValue', canvas.value!.toDataURL('image/png'))
}
function clear() {
  const c = canvas.value!
  ctx().clearRect(0, 0, c.width, c.height)
  emit('update:modelValue', null)
}
defineExpose({ clear })
</script>

<template>
  <div class="field">
    <div class="flex items-center justify-between gap-2">
      <span v-if="label">{{ label }}</span>
      <button v-if="modelValue" type="button" class="text-xs font-semibold text-brand-700 min-h-8" @click="clear">Hapus &amp; ulangi</button>
    </div>
    <div ref="wrap" class="relative rounded-lg border bg-white overflow-hidden" :class="error ? 'border-danger-700' : 'border-line-2'">
      <canvas
        ref="canvas" class="block touch-none cursor-crosshair" role="img" aria-label="Area tanda tangan: gambar tanda tangan dengan jari atau mouse"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @pointerleave="up"
      />
      <span v-if="!modelValue" class="absolute inset-0 flex items-center justify-center text-sm text-faint pointer-events-none">Tanda tangan di sini</span>
      <span class="absolute left-4 right-4 bottom-8 border-b border-dashed border-line-2 pointer-events-none" aria-hidden="true" />
    </div>
    <span v-if="error" class="text-xs text-danger-700">{{ error }}</span>
  </div>
</template>
