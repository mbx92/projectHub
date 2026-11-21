<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const { homePath } = useAuth()
const title = computed(() => props.error.statusCode === 404 ? 'Halaman tidak ditemukan' : props.error.statusCode === 403 ? 'Tidak punya akses' : 'Terjadi kesalahan')
</script>

<template>
  <div class="min-h-screen bg-canvas flex items-center justify-center p-6">
    <div class="card-pad max-w-md w-full flex flex-col gap-4 text-center items-center">
      <img src="/logo-mark.svg" alt="" class="w-11 h-11 rounded-[10px]">
      <h1 class="m-0 text-xl font-bold">{{ title }}</h1>
      <p class="m-0 text-sm text-muted">{{ error.statusMessage || error.message }}</p>
      <button type="button" class="btn-primary" @click="clearError({ redirect: homePath })">Kembali ke beranda</button>
    </div>
  </div>
</template>
