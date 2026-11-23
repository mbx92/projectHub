<script setup lang="ts">
/** Pengaturan → Template Dokumen: unggah SVG Penpot per artboard, pratinjau, aktifkan, kembali ke bawaan. */
type Kind = 'invoice' | 'kuitansi' | 'dokumen'
type PageKey = 'halaman-1' | 'halaman-lanjutan'
interface TplRef { version: number, pages: Partial<Record<PageKey, string>>, uploadedAt: string, uploadedBy: number }
interface Row { kind: Kind, active: TplRef | null, draft: TplRef | null, validation: { errors: string[], warnings: string[] } | null }

const toast = useToast()
const { confirm } = useConfirm()
const { data, refresh } = await useFetch<{ kinds: Row[] }>('/api/settings/templates')

const META: Record<Kind, { name: string, desc: string, pages: { key: PageKey, label: string, hint: string }[] }> = {
  invoice: {
    name: 'Invoice',
    desc: 'Layout penuh: kop, tagihan, tabel item (baris berulang), total, pembayaran, tanda tangan.',
    pages: [{ key: 'halaman-1', label: 'Halaman 1', hint: 'Wajib' }, { key: 'halaman-lanjutan', label: 'Halaman lanjutan', hint: 'Wajib — untuk invoice dengan banyak item' }],
  },
  kuitansi: {
    name: 'Kuitansi',
    desc: 'Layout penuh satu halaman, dibekukan saat pembayaran dicatat.',
    pages: [{ key: 'halaman-1', label: 'Halaman 1', hint: 'Wajib' }],
  },
  dokumen: {
    name: 'Dokumen proyek',
    desc: 'Bingkai halaman (kop, footer, ornamen) untuk Kontrak, Spesifikasi, Laporan UAT, dan BAST. Isi tetap dari editor.',
    pages: [{ key: 'halaman-1', label: 'Halaman 1', hint: 'Wajib' }, { key: 'halaman-lanjutan', label: 'Halaman lanjutan', hint: 'Opsional — bila kosong memakai halaman 1' }],
  },
}

const busy = ref<string | null>(null)

async function upload(kind: Kind, page: PageKey, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = `${kind}:${page}`
  try {
    const fd = new FormData()
    fd.append('page', page)
    fd.append('file', file)
    await $fetch<unknown>(`/api/settings/templates/${kind}`, { method: 'POST', body: fd })
    toast.success(`${META[kind].name}: ${page} diunggah ke draf`)
    await refresh()
  } catch (err) {
    toast.error(errorMessage(err, (err as Error).message))
  } finally {
    busy.value = null
    input.value = ''
  }
}

function preview(kind: Kind, aktif: boolean) {
  window.open(`/api/settings/templates/${kind}/preview?${aktif ? 'aktif=1&' : ''}contoh=12`, '_blank', 'noopener')
}

async function activate(row: Row) {
  const ok = await confirm({
    variant: 'info', title: `Aktifkan template ${META[row.kind].name}?`,
    message: 'Dokumen baru memakai template ini. Dokumen yang sudah dikirim atau difinalkan tetap memakai tampilan sebelumnya.',
    confirmText: 'Aktifkan', action: () => $fetch<unknown>(`/api/settings/templates/${row.kind}/activate`, { method: 'POST' }),
  })
  if (ok) { toast.success('Template diaktifkan'); await refresh() }
}

async function reset(row: Row) {
  const ok = await confirm({
    variant: 'danger', title: `Kembali ke layout bawaan untuk ${META[row.kind].name}?`,
    message: 'Template aktif dan draf dilepas. Dokumen yang sudah dikirim atau difinalkan tetap memakai tampilannya.',
    confirmText: 'Kembali ke bawaan', action: () => $fetch<unknown>(`/api/settings/templates/${row.kind}/reset`, { method: 'POST' }),
  })
  if (ok) { toast.success('Kembali ke layout bawaan'); await refresh() }
}

const label = (r: TplRef) => `Versi ${r.version} · ${dateId(r.uploadedAt)}`
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="card-pad flex flex-col gap-1">
      <h2 class="section-title">Template Dokumen</h2>
      <span class="text-sm text-muted">Desain dokumen dibuat di Penpot, diekspor sebagai SVG (artboard A4 595 × 842), lalu diunggah di sini. Sistem mengisi datanya otomatis. Tanpa template, layout bawaan dipakai. Panduan penanda: <code>docs/template-dokumen.md</code>.</span>
    </div>

    <article v-for="row in data?.kinds ?? []" :key="row.kind" class="card-pad flex flex-col gap-4" :aria-label="`Template ${META[row.kind].name}`">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0">
          <h3 class="m-0 text-base font-bold">{{ META[row.kind].name }}</h3>
          <span class="text-sm text-muted">{{ META[row.kind].desc }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="row.active" class="badge bg-success-50 text-success-700">Aktif · {{ label(row.active) }}</span>
          <span v-else class="badge bg-soft-2 text-ink-2">Layout bawaan</span>
          <span v-if="row.draft" class="badge bg-warning-50 text-warning-700">Draf · {{ label(row.draft) }}</span>
        </div>
      </div>

      <ul class="m-0 p-0 list-none flex flex-col gap-2">
        <li v-for="p in META[row.kind].pages" :key="p.key" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-2 px-3 py-2">
          <div class="flex flex-col">
            <span class="text-sm font-semibold">{{ p.label }}</span>
            <span class="text-xs text-muted">{{ p.hint }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs" :class="(row.draft ?? row.active)?.pages[p.key] ? 'text-success-700 font-semibold' : 'text-muted'">{{ (row.draft ?? row.active)?.pages[p.key] ? 'Terunggah' : 'Belum ada' }}</span>
            <label class="btn-secondary btn-sm cursor-pointer" :class="busy === `${row.kind}:${p.key}` && 'opacity-50 pointer-events-none'">
              {{ busy === `${row.kind}:${p.key}` ? 'Mengunggah…' : 'Unggah SVG' }}
              <input type="file" class="sr-only" accept=".svg,image/svg+xml" :aria-label="`Unggah SVG ${p.label} ${META[row.kind].name}`" @change="upload(row.kind, p.key, $event)">
            </label>
          </div>
        </li>
      </ul>

      <div v-if="row.validation && (row.validation.errors.length || row.validation.warnings.length)" class="flex flex-col gap-1.5" role="status">
        <p v-for="m in row.validation.errors" :key="m" class="m-0 text-sm text-danger-700 font-medium">✕ {{ m }}</p>
        <p v-for="m in row.validation.warnings" :key="m" class="m-0 text-sm text-warning-700">! {{ m }}</p>
      </div>
      <p v-else-if="row.validation" class="m-0 text-sm text-success-700 font-medium" role="status">Template valid.</p>

      <div class="flex flex-wrap gap-2">
        <button v-if="row.draft" type="button" class="btn-secondary btn-sm" @click="preview(row.kind, false)">Pratinjau draf</button>
        <button v-if="row.active" type="button" class="btn-secondary btn-sm" @click="preview(row.kind, true)">Pratinjau aktif</button>
        <button v-if="row.draft" type="button" class="btn-primary btn-sm" :disabled="!!row.validation?.errors.length" @click="activate(row)">Aktifkan draf</button>
        <button v-if="row.active || row.draft" type="button" class="btn-ghost btn-sm !text-danger-700" @click="reset(row)">Kembali ke bawaan</button>
      </div>
    </article>
  </section>
</template>
