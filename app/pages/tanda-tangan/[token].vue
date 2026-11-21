<script setup lang="ts">
/** Halaman publik untuk klien: baca isi persetujuan lalu tanda tangan. Tanpa login (tautan acak sekali pakai). */
definePageMeta({ layout: false })
useHead({ title: 'Persetujuan — OCN Project Hub', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const token = String(useRoute().params.token)
const { data, error, refresh } = await useFetch(`/api/sign/${token}`)

const form = reactive({ name: '', consent: false })
const signature = ref<string | null>(null)
const sending = ref(false)
const err = ref('')

const STATUS_TEXT: Record<string, string> = {
  ditandatangani: 'Dokumen ini sudah ditandatangani.',
  dibatalkan: 'Permintaan ini dibatalkan oleh pengirim.',
  kedaluwarsa: 'Tautan ini sudah kedaluwarsa. Hubungi pengirim untuk meminta tautan baru.',
}

async function submit() {
  err.value = ''
  if (form.name.trim().length < 2) { err.value = 'Isi nama lengkap Anda.'; return }
  if (!signature.value) { err.value = 'Bubuhkan tanda tangan Anda.'; return }
  if (!form.consent) { err.value = 'Centang pernyataan persetujuan.'; return }
  sending.value = true
  try {
    await $fetch(`/api/sign/${token}`, { method: 'POST', body: { name: form.name, consent: true, signature: signature.value } })
    await refresh()
  } catch (e) {
    err.value = errorMessage(e, 'Gagal mengirim. Periksa koneksi lalu coba lagi.')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas flex flex-col items-center px-4 py-8 sm:py-12">
    <div class="w-full max-w-[640px] flex flex-col gap-5">
      <div class="flex items-center gap-3">
        <img src="/logo-mark.svg" alt="" class="w-10 h-10 rounded-[10px]">
        <span class="font-bold text-base">{{ data?.businessName ?? 'OCN Project Hub' }}</span>
      </div>

      <div v-if="error" class="card-pad flex flex-col gap-2">
        <h1 class="m-0 text-xl font-bold">Tautan tidak ditemukan</h1>
        <p class="m-0 text-sm text-muted">Periksa kembali tautan yang Anda terima, atau hubungi pengirim.</p>
      </div>

      <template v-else-if="data">
        <section class="card-pad flex flex-col gap-3">
          <span class="text-xs font-semibold text-muted">Proyek {{ data.projectName }}</span>
          <h1 class="m-0 text-xl font-bold">{{ data.title }}</h1>
          <p v-if="data.body" class="m-0 text-sm leading-relaxed whitespace-pre-line">{{ data.body }}</p>
        </section>

        <section v-if="data.status !== 'menunggu'" class="card-pad flex flex-col gap-2" :class="data.status === 'ditandatangani' && 'border-success-700'">
          <h2 class="section-title">{{ STATUS_TEXT[data.status] }}</h2>
          <p v-if="data.status === 'ditandatangani'" class="m-0 text-sm text-muted">Ditandatangani oleh <b>{{ data.signerName }}</b> pada {{ dateTimeId(data.signedAt) }}. Terima kasih.</p>
        </section>

        <form v-else class="card-pad flex flex-col gap-4" novalidate @submit.prevent="submit">
          <h2 class="section-title">Tanda tangan Anda</h2>
          <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
          <label class="field">Nama lengkap<input v-model="form.name" type="text" class="input" autocomplete="name" placeholder="Nama sesuai identitas"></label>
          <UiSignaturePad v-model="signature" label="Tanda tangan" />
          <label class="flex items-start gap-2.5 text-sm cursor-pointer">
            <input v-model="form.consent" type="checkbox" class="w-[18px] h-[18px] mt-0.5 accent-brand-600 shrink-0">
            <span>Saya telah membaca dan menyetujui isi dokumen di atas, dan tanda tangan ini sah sebagai persetujuan saya.</span>
          </label>
          <button type="submit" class="btn-primary w-full" :disabled="sending">{{ sending ? 'Mengirim…' : 'Tandatangani & Kirim' }}</button>
          <p class="m-0 text-xs text-muted">Berlaku sampai {{ dateLongId(data.expiresAt) }}. Waktu dan alamat IP perangkat Anda dicatat sebagai bukti.</p>
        </form>
      </template>
    </div>
    <UiToasts />
  </div>
</template>
