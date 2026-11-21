<script setup lang="ts">
/** Saklar on/off yang aksesibel (role="switch"), target sentuh 44px. */
const props = defineProps<{ modelValue: boolean, label: string, desc?: string, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const id = useId()
function toggle() {
  if (!props.disabled) emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 min-h-11" :class="disabled && 'opacity-50'">
    <span :id="`${id}-l`" class="flex flex-col gap-0.5 min-w-0">
      <span class="text-sm font-medium text-ink">{{ label }}</span>
      <span v-if="desc" class="text-xs text-muted">{{ desc }}</span>
    </span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-labelledby="`${id}-l`"
      :disabled="disabled"
      class="relative shrink-0 w-11 h-6 rounded-full transition-colors outline-offset-2 before:absolute before:-inset-2.5 before:content-['']"
      :class="modelValue ? 'bg-brand-600' : 'bg-line'"
      @click="toggle"
    >
      <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform" :class="modelValue && 'translate-x-5'" />
    </button>
  </div>
</template>
