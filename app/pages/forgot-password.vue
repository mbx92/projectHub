<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Lupa kata sandi — OCN Project Hub' })
const email = ref('')
const sent = ref(false)
const error = ref('')
const loading = ref(false)
async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <h2 class="m-0 text-2xl font-bold">Lupa kata sandi</h2>
      <p class="m-0 text-sm text-muted leading-relaxed">Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru (berlaku 2 jam).</p>
    </div>
    <div v-if="sent" role="status" class="text-sm bg-brand-50 text-brand-700 rounded-lg px-3 py-3 leading-relaxed">
      Bila email <strong>{{ email }}</strong> terdaftar, tautan atur ulang kata sandi sudah dikirim. Periksa kotak masuk dan folder spam.
    </div>
    <form v-else class="flex flex-col gap-5" @submit.prevent="submit">
      <p v-if="error" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ error }}</p>
      <label class="field">Email
        <input v-model="email" type="email" class="input" placeholder="nama@email.com" autocomplete="email" required>
      </label>
      <button type="submit" class="btn-primary w-full" :disabled="loading">{{ loading ? 'Mengirim…' : 'Kirim tautan' }}</button>
    </form>
    <NuxtLink to="/login" class="text-sm font-semibold text-center">← Kembali ke halaman masuk</NuxtLink>
  </div>
</template>
