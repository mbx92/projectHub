<script setup lang="ts">
/** Persetujuan klien (berita acara / serah terima) dengan tanda tangan digital, di detail proyek. */
const props = defineProps<{ projectId: number, clientEmail?: string | null, projectName: string }>()
const toast = useToast()
const { confirm } = useConfirm()
const { data: list, refresh } = await useFetch(`/api/projects/${props.projectId}/signatures`, { default: () => [] })

const TEMPLATES = computed(() => [
  { label: 'Berita Acara Serah Terima', title: `Berita Acara Serah Terima — ${props.projectName}`, body: `Dengan ini klien menyatakan telah menerima hasil pekerjaan proyek "${props.projectName}" dari pihak pengembang, dan hasil pekerjaan telah sesuai dengan kesepakatan serta dapat digunakan.\n\nSeluruh pekerjaan yang tercantum dalam kesepakatan dinyatakan selesai pada tanggal penandatanganan dokumen ini.` },
  { label: 'Persetujuan UAT', title: `Persetujuan UAT — ${props.projectName}`, body: `Klien telah melakukan pengujian penerimaan pengguna (UAT) pada proyek "${props.projectName}" dan menyatakan fitur yang diuji telah berfungsi sesuai kebutuhan. Catatan yang masih ada dianggap tidak menghambat penerimaan.` },
  { label: 'Kosong', title: '', body: '' },
])

const open = ref(false)
const f = reactive({ title: '', body: '', email: '', validDays: 14 })
const saving = ref(false)
const err = ref('')
const created = ref<{ link: string, emailSent: boolean | null } | null>(null)

function openNew() {
  Object.assign(f, { title: TEMPLATES.value[0]!.title, body: TEMPLATES.value[0]!.body, email: props.clientEmail ?? '', validDays: 14 })
  err.value = ''
  created.value = null
  open.value = true
}
function applyTemplate(i: number) { const t = TEMPLATES.value[i]!; f.title = t.title; f.body = t.body }

async function create() {
  err.value = ''
  saving.value = true
  try {
    const r = await $fetch<{ link: string, emailSent: boolean | null }>(`/api/projects/${props.projectId}/signatures`, { method: 'POST', body: { ...f, email: f.email.trim() || null } })
    created.value = r
    await refresh()
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}

async function copy(link: string) {
  try { await navigator.clipboard.writeText(link); toast.success('Tautan disalin') } catch { toast.error('Gagal menyalin. Salin manual dari kolom tautan.') }
}
async function cancel(id: number) {
  const ok = await confirm({
    variant: 'warning', title: 'Batalkan permintaan ini?', message: 'Tautan yang sudah dikirim ke klien tidak akan bisa dipakai lagi.', confirmText: 'Batalkan',
    action: () => $fetch<unknown>(`/api/projects/${props.projectId}/signatures/${id}/cancel`, { method: 'POST' }),
  })
  if (ok) { toast.success('Permintaan dibatalkan'); await refresh() }
}
const resendId = ref<number | null>(null)
const resendEmail = ref('')
async function resend(id: number) {
  try {
    const r = await $fetch<{ emailSent: boolean }>(`/api/projects/${props.projectId}/signatures/${id}/send`, { method: 'POST', body: { email: resendEmail.value } })
    r.emailSent ? toast.success('Email terkirim') : toast.error('Email tidak terkirim (SMTP belum diatur). Salin tautannya saja.')
    resendId.value = null
    await refresh()
  } catch (e) { toast.error(errorMessage(e)) }
}

const TONE: Record<string, { label: string, fg: string, bg: string }> = {
  menunggu: { label: 'Menunggu tanda tangan', fg: '#B54708', bg: '#FEF0C7' },
  ditandatangani: { label: 'Ditandatangani', fg: '#067647', bg: '#DCFAE6' },
  dibatalkan: { label: 'Dibatalkan', fg: '#475467', bg: '#F2F4F7' },
  kedaluwarsa: { label: 'Kedaluwarsa', fg: '#B42318', bg: '#FEE4E2' },
}
</script>

<template>
  <section class="card overflow-hidden min-w-0">
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div class="flex flex-col gap-0.5">
        <h2 class="section-title">Persetujuan Klien</h2>
        <span class="text-xs text-muted">Berita acara atau persetujuan yang ditandatangani klien lewat tautan.</span>
      </div>
      <button type="button" class="btn-secondary btn-sm" @click="openNew">+ Minta Tanda Tangan</button>
    </div>
    <ul v-if="list.length" class="m-0 p-0 list-none divide-y divide-line-3 border-t border-line-3">
      <li v-for="r in list" :key="r.id" class="px-5 py-3 flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-semibold text-sm flex-1 min-w-48">{{ r.title }}</span>
          <UiBadge :tone="TONE[r.status]" />
        </div>
        <span class="text-xs text-muted">
          Dibuat {{ dateId(r.createdAt) }}
          <template v-if="r.status === 'ditandatangani'"> · oleh <b>{{ r.signerName }}</b>, {{ dateTimeId(r.signedAt) }}</template>
          <template v-else-if="r.status === 'menunggu'"> · berlaku sampai {{ dateId(r.expiresAt) }}</template>
          <template v-if="r.sentTo"> · dikirim ke {{ r.sentTo }}</template>
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="r.status === 'menunggu' && r.link">
            <button type="button" class="btn-secondary btn-sm" @click="copy(r.link!)">Salin tautan</button>
            <button type="button" class="btn-secondary btn-sm" @click="resendId = resendId === r.id ? null : r.id; resendEmail = r.sentTo ?? clientEmail ?? ''">Kirim email</button>
            <button type="button" class="btn-ghost btn-sm text-danger-700" @click="cancel(r.id)">Batalkan</button>
          </template>
          <template v-if="r.status === 'ditandatangani'">
            <a :href="`/api/projects/${projectId}/signatures/${r.id}/pdf`" target="_blank" rel="noopener" class="btn-secondary btn-sm">Unduh bukti PDF</a>
            <img v-if="r.signatureUrl" :src="r.signatureUrl" alt="Tanda tangan klien" class="h-10 max-w-32 object-contain border border-line-2 rounded bg-white">
          </template>
        </div>
        <form v-if="resendId === r.id" class="flex flex-wrap items-end gap-2" @submit.prevent="resend(r.id)">
          <label class="field flex-1 min-w-56">Email klien<input v-model="resendEmail" type="email" class="input" required></label>
          <button type="submit" class="btn-primary btn-sm">Kirim</button>
        </form>
      </li>
    </ul>
    <p v-else class="m-0 px-5 pb-5 text-sm text-muted">Belum ada permintaan tanda tangan.</p>

    <UiModal :open="open" title="Minta Tanda Tangan Klien" description="Klien membuka tautan, membaca isi, lalu menandatangani di layar tanpa perlu akun." width="640px" @close="open = false">
      <template v-if="!created">
        <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Templat">
          <button v-for="(t, i) in TEMPLATES" :key="t.label" type="button" class="btn-secondary btn-sm" @click="applyTemplate(i)">{{ t.label }}</button>
        </div>
        <label class="field">Judul<input v-model="f.title" type="text" class="input" maxlength="200"></label>
        <label class="field">Isi / uraian<textarea v-model="f.body" rows="7" class="input" /></label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field">Kirim ke email klien<input v-model="f.email" type="email" class="input" placeholder="Opsional"><span class="hint">Kosongkan bila tautan dibagikan lewat WhatsApp.</span></label>
          <label class="field">Berlaku (hari)<input v-model.number="f.validDays" type="number" min="1" max="90" class="input"></label>
        </div>
      </template>
      <template v-else>
        <p class="m-0 text-sm text-success-700 bg-success-50 rounded-lg px-3 py-2.5">Permintaan dibuat.{{ created.emailSent === true ? ' Email terkirim ke klien.' : created.emailSent === false ? ' Email tidak terkirim (SMTP belum diatur); bagikan tautan di bawah.' : '' }}</p>
        <label class="field">Tautan untuk klien<input :value="created.link" readonly class="input" @focus="($event.target as HTMLInputElement).select()"></label>
      </template>
      <template #footer>
        <button type="button" class="btn-secondary" @click="open = false">{{ created ? 'Tutup' : 'Batal' }}</button>
        <button v-if="created" type="button" class="btn-primary" @click="copy(created.link)">Salin tautan</button>
        <button v-else type="button" class="btn-primary" :disabled="saving" @click="create">{{ saving ? 'Membuat…' : 'Buat Permintaan' }}</button>
      </template>
    </UiModal>
  </section>
</template>
