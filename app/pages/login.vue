<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Masuk — OCN Project Hub' })

const route = useRoute()
const { fetchMe } = useAuth()
const form = reactive({ email: '', password: '', remember: false })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const r = await $fetch<{ redirect: string }>('/api/auth/login', { method: 'POST', body: form })
    await fetchMe()
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//') ? route.query.next : r.redirect
    await navigateTo(next)
  } catch (e) {
    error.value = errorMessage(e, 'Gagal masuk. Periksa koneksi lalu coba lagi.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <div class="flex flex-col gap-2">
      <h2 class="m-0 text-2xl font-bold">Masuk</h2>
      <p class="m-0 text-sm text-muted leading-relaxed">Gunakan akun yang dikirim lewat undangan. Anda akan diarahkan ke halaman sesuai peran akun.</p>
    </div>
    <p v-if="error" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ error }}</p>
    <label class="field">Email
      <input v-model="form.email" type="email" class="input" placeholder="nama@email.com" autocomplete="email" required>
    </label>
    <label class="field">Kata sandi
      <input v-model="form.password" type="password" class="input" placeholder="••••••••" autocomplete="current-password" required>
    </label>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <label class="flex items-center gap-2 text-sm text-ink-2 min-h-11 cursor-pointer">
        <input v-model="form.remember" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Ingat saya
      </label>
      <NuxtLink to="/forgot-password" class="text-sm font-semibold">Lupa kata sandi?</NuxtLink>
    </div>
    <button type="submit" class="btn-primary w-full" :disabled="loading">{{ loading ? 'Memproses…' : 'Masuk' }}</button>
    <p class="m-0 text-sm text-muted text-center">Belum punya akses? Hubungi admin OCN Development.</p>
  </form>
</template>
