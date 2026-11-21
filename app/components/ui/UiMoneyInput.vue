<script setup lang="ts">
/** Input rupiah dengan titik ribuan; v-model berupa bilangan bulat. */
const props = withDefaults(defineProps<{ modelValue: number | null, label?: string, placeholder?: string, size?: 'md' | 'sm', disabled?: boolean, ariaLabel?: string, hint?: string, error?: string, allowNegative?: boolean }>(), { placeholder: '0', size: 'md' })
const emit = defineEmits<{ 'update:modelValue': [number] }>()
const id = useId()
const text = computed(() => (!props.modelValue ? '' : (props.modelValue < 0 ? '-' : '') + numberId(props.modelValue)))
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const neg = props.allowNegative && el.value.trim().startsWith('-')
  const digits = el.value.replace(/\D/g, '').slice(0, 15)
  const n = Number(digits || 0) * (neg ? -1 : 1)
  emit('update:modelValue', n)
  const formatted = digits ? (neg ? '-' : '') + numberId(Math.abs(n)) : (neg ? '-' : '')
  if (el.value !== formatted) {
    const fromEnd = el.value.length - (el.selectionStart ?? el.value.length)
    el.value = formatted
    const pos = Math.max(0, formatted.length - fromEnd)
    el.setSelectionRange(pos, pos)
  }
}
</script>

<template>
  <label class="field" :for="id">
    <span v-if="label">{{ label }}</span>
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium pointer-events-none">Rp</span>
      <input
        :id="id"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="!label ? ariaLabel : undefined"
        :aria-invalid="!!error || undefined"
        class="input pl-9 tabular-nums"
        :class="[size === 'sm' && 'input-sm', error && '!border-danger-600']"
        @input="onInput"
      >
    </div>
    <span v-if="hint" class="hint">{{ hint }}</span>
    <span v-if="error" class="error-text">{{ error }}</span>
  </label>
</template>
