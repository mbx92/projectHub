<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Kata sandi baru — OCN Project Hub' })
const route = useRoute()
const token = computed(() => String(route.query.token || ''))
const pw = ref('')
const pw2 = ref('')
const error = ref('')
const done = ref(false)
const loading = ref(false)
async function submit() {
  error.value = ''
  if (pw.value.length < 8) { error.value = 'Kata sandi minimal 8 karakter.'; return }
  if (pw.value !== pw2.value) { error.value = 'Konfirmasi kata sandi tidak sama.'; return }
  loading.value = true
  try {
    await $fetch('/api/auth/reset', { method: 'POST', body: { token: token.value, password: pw.value } })
    done.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <h2 class="m-0 text-2xl font-bold">Buat kata sandi baru</h2>
    <div v-if="done" role="status" class="flex flex-col gap-4">
      <p class="m-0 text-sm bg-brand-50 text-brand-700 rounded-lg px-3 py-3">Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.</p>
      <NuxtLink to="/login" class="btn-primary">Masuk</NuxtLink>
    </div>
    <form v-else class="flex flex-col gap-5" @submit.prevent="submit">
      <p v-if="!token" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">Tautan tidak lengkap. Minta tautan baru dari halaman lupa kata sandi.</p>
      <p v-if="error" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ error }}</p>
      <label class="field">Kata sandi baru
        <input v-model="pw" type="password" class="input" autocomplete="new-password" minlength="8" required>
        <span class="hint">Minimal 8 karakter.</span>
      </label>
      <label class="field">Ulangi kata sandi
        <input v-model="pw2" type="password" class="input" autocomplete="new-password" required>
      </label>
      <button type="submit" class="btn-primary w-full" :disabled="loading || !token">{{ loading ? 'Menyimpan…' : 'Simpan kata sandi' }}</button>
    </form>
  </div>
</template>
