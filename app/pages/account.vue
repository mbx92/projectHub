<script setup lang="ts">
useHead({ title: 'Akun — OCN Project Hub' })
const { user, roleLabel } = useAuth()
const toast = useToast()
const { data } = await useFetch('/api/settings')
const prefs = ref<Record<string, NotifPref>>({ ...(data.value?.notif ?? {}) })
const pw = reactive({ current: '', password: '', confirm: '' })
const saving = ref(false)

async function savePrefs() {
  saving.value = true
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { notif: prefs.value } })
    toast.success('Preferensi notifikasi disimpan')
  } catch (e) { toast.error(errorMessage(e)) } finally { saving.value = false }
}
async function changePassword() {
  if (pw.password !== pw.confirm) return toast.error('Konfirmasi kata sandi tidak sama.')
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: pw.current, password: pw.password } })
    Object.assign(pw, { current: '', password: '', confirm: '' })
    toast.success('Kata sandi diubah')
  } catch (e) { toast.error(errorMessage(e)) }
}
</script>

<template>
  <UiPageHeader title="Akun Saya" :subtitle="`${user?.name} · ${roleLabel} · ${user?.email}`" />
  <div class="grid gap-6 lg:grid-cols-2 items-start">
    <section class="card-pad flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="section-title">Notifikasi</h2>
        <span class="text-sm text-muted">Pilih kejadian dan saluran pemberitahuan untuk akun Anda.</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th scope="col">Kejadian</th><th scope="col">Di aplikasi</th><th scope="col">Email</th></tr></thead>
          <tbody>
            <tr v-for="n in NOTIF_EVENTS" :key="n.key">
              <td><div class="flex flex-col gap-0.5 whitespace-normal"><span class="font-semibold">{{ n.name }}</span><span class="text-xs text-muted">{{ n.desc }}</span></div></td>
              <td><input v-if="prefs[n.key]" v-model="prefs[n.key]!.app" type="checkbox" class="w-5 h-5 accent-brand-600" :aria-label="`${n.name} di aplikasi`"></td>
              <td><input v-if="prefs[n.key]" v-model="prefs[n.key]!.email" type="checkbox" class="w-5 h-5 accent-brand-600" :aria-label="`${n.name} lewat email`"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="m-0 text-xs text-muted">Pengingat lewat WhatsApp & Telegram tersedia di fase 2.</p>
      <div class="flex justify-end"><button type="button" class="btn-primary" :disabled="saving" @click="savePrefs">Simpan</button></div>
    </section>
    <form class="card-pad flex flex-col gap-4" @submit.prevent="changePassword">
      <h2 class="section-title">Ganti Kata Sandi</h2>
      <label class="field">Kata sandi saat ini<input v-model="pw.current" type="password" class="input" autocomplete="current-password" required></label>
      <label class="field">Kata sandi baru<input v-model="pw.password" type="password" class="input" autocomplete="new-password" minlength="8" required><span class="hint">Minimal 8 karakter.</span></label>
      <label class="field">Ulangi kata sandi baru<input v-model="pw.confirm" type="password" class="input" autocomplete="new-password" required></label>
      <div class="flex justify-end"><button type="submit" class="btn-primary">Ganti kata sandi</button></div>
    </form>
  </div>
</template>
