<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Terima undangan — OCN Project Hub' })
const route = useRoute()
const { fetchMe } = useAuth()
const token = String(route.query.token || '')
const { data: info, error: loadError } = await useFetch('/api/auth/invite', { query: { token } })
const name = ref(info.value?.name ?? '')
const pw = ref('')
const pw2 = ref('')
const error = ref('')
const loading = ref(false)
async function submit() {
  error.value = ''
  if (pw.value.length < 8) { error.value = 'Kata sandi minimal 8 karakter.'; return }
  if (pw.value !== pw2.value) { error.value = 'Konfirmasi kata sandi tidak sama.'; return }
  loading.value = true
  try {
    const r = await $fetch<{ redirect: string }>('/api/auth/accept-invite', { method: 'POST', body: { token, name: name.value, password: pw.value } })
    await fetchMe()
    await navigateTo(r.redirect)
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
      <h2 class="m-0 text-2xl font-bold">Selamat datang</h2>
      <p v-if="info" class="m-0 text-sm text-muted leading-relaxed">Anda diundang sebagai <strong class="text-ink">{{ ROLE_LABEL[info.role] }}</strong> dengan email {{ info.email }}. Buat kata sandi untuk mulai memakai OCN Project Hub.</p>
    </div>
    <div v-if="loadError" role="alert" class="flex flex-col gap-4">
      <p class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ errorMessage(loadError) }}</p>
      <p class="m-0 text-sm text-muted">Minta admin OCN mengirim ulang undangan.</p>
    </div>
    <form v-else class="flex flex-col gap-5" @submit.prevent="submit">
      <p v-if="error" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ error }}</p>
      <label class="field">Nama lengkap
        <input v-model="name" type="text" class="input" autocomplete="name" required>
      </label>
      <label class="field">Kata sandi
        <input v-model="pw" type="password" class="input" autocomplete="new-password" minlength="8" required>
        <span class="hint">Minimal 8 karakter.</span>
      </label>
      <label class="field">Ulangi kata sandi
        <input v-model="pw2" type="password" class="input" autocomplete="new-password" required>
      </label>
      <button type="submit" class="btn-primary w-full" :disabled="loading">{{ loading ? 'Memproses…' : 'Aktifkan akun' }}</button>
    </form>
  </div>
</template>
