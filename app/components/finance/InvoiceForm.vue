<script setup lang="ts">
/** Buat / ubah invoice dari proyek + termin, dengan pratinjau langsung. */
const props = defineProps<{ invoiceId?: number }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data: ctx } = await useFetch('/api/invoices/context')
const existing = props.invoiceId ? (await useFetch(`/api/invoices/${props.invoiceId}`)).data : ref(null)

interface Item { description: string, qty: number, price: number }
const f = reactive({
  projectId: null as number | null, termId: null as number | null,
  issueDate: ctx.value?.today ?? todayISO(), dueDate: addDays(ctx.value?.today ?? todayISO(), ctx.value?.settings.defaultDueDays ?? 14) as string | null,
  items: [] as Item[], discount: 0, taxPercent: ctx.value?.settings.showTax ? ctx.value.settings.defaultTaxPercent : 0,
  notes: ctx.value?.settings.footer ?? '', bankAccountId: (ctx.value?.banks.find(b => b.isDefault) ?? ctx.value?.banks[0])?.id ?? null as number | null,
  showQris: !!ctx.value?.settings.methods.qris && !!ctx.value?.settings.qrisKey,
})

if (existing.value) {
  const e = existing.value as any
  Object.assign(f, {
    projectId: e.invoice.projectId, termId: e.invoice.termId, issueDate: e.invoice.issueDate, dueDate: e.invoice.dueDate,
    items: e.items.map((i: any) => ({ description: i.description, qty: Number(i.qty), price: i.price })),
    discount: e.invoice.discount, taxPercent: Number(e.invoice.taxPercent), notes: e.invoice.notes ?? '', bankAccountId: e.invoice.bankAccountId, showQris: e.invoice.showQris,
  })
} else {
  const qTerm = Number(route.query.term) || null
  const qProject = Number(route.query.project) || null
  const t = ctx.value?.terms.find(x => x.id === qTerm)
  f.projectId = t?.projectId ?? qProject ?? null
  if (t?.billable) f.termId = t.id
}

const project = computed(() => ctx.value?.projects.find(p => p.id === f.projectId))
const projectOpts = computed(() => (ctx.value?.projects ?? []).filter(p => existing.value || (ctx.value?.terms ?? []).some(t => t.projectId === p.id && t.billable)).map(p => ({ value: p.id as number | null, label: p.name, desc: p.client?.name })))
const termsOfProject = computed(() => (ctx.value?.terms ?? []).filter(t => t.projectId === f.projectId && (t.billable || t.id === f.termId)))
const termOpts = computed(() => termsOfProject.value.map(t => ({ value: t.id as number | null, label: `${t.name} — ${rupiah(t.amount)}`, desc: `${percent(t.percent)} kontrak${t.dueDate ? ` · jatuh tempo ${dateId(t.dueDate)}` : ''}` })))
const term = computed(() => ctx.value?.terms.find(t => t.id === f.termId))

watch(() => f.projectId, (pid, old) => {
  if (existing.value || old === undefined) return
  if (!termsOfProject.value.some(t => t.id === f.termId)) f.termId = termsOfProject.value[0]?.id ?? null
}, { immediate: true })
watch(() => f.termId, (tid) => {
  if (existing.value || !tid) return
  const t = term.value
  if (!t) return
  f.items = [{ description: `${t.name} (${percent(t.percent)} nilai kontrak) — ${project.value?.name ?? ''}`, qty: 1, price: t.amount }]
  if (t.dueDate && t.dueDate >= f.issueDate) f.dueDate = t.dueDate
}, { immediate: true })

const totals = computed(() => invoiceTotals(f.items, f.discount, f.taxPercent))
const bank = computed(() => ctx.value?.banks.find(b => b.id === f.bankAccountId))
const bankOpts = computed(() => (ctx.value?.banks ?? []).map(b => ({ value: b.id as number | null, label: `${b.bankName} · ${b.accountNumber} · a.n. ${b.accountName}` })))
const number = computed(() => (existing.value as any)?.invoice.number ?? ctx.value?.nextNumber)

const saving = ref(false)
const err = ref('')
async function persist(): Promise<number | null> {
  err.value = ''
  if (!f.termId) { err.value = 'Pilih proyek dan termin.'; return null }
  if (!f.items.length || f.items.some(i => !i.description.trim())) { err.value = 'Lengkapi deskripsi item.'; return null }
  if (!f.dueDate) { err.value = 'Isi tanggal jatuh tempo.'; return null }
  saving.value = true
  try {
    const body = { termId: f.termId, issueDate: f.issueDate, dueDate: f.dueDate, items: f.items, discount: f.discount, taxPercent: f.taxPercent, notes: f.notes || null, bankAccountId: f.bankAccountId, showQris: f.showQris }
    const r = props.invoiceId
      ? await $fetch<{ id: number }>(`/api/invoices/${props.invoiceId}`, { method: 'PUT', body })
      : await $fetch<{ id: number }>('/api/invoices', { method: 'POST', body })
    return r.id
  } catch (e) { err.value = errorMessage(e); return null } finally { saving.value = false }
}
async function saveDraft() {
  const id = await persist()
  if (id) { toast.success('Draf invoice disimpan'); router.push(`/invoices/${id}`) }
}
async function downloadPdf() {
  const id = await persist()
  if (id) { window.open(`/api/invoices/${id}/pdf`, '_blank'); router.push(`/invoices/${id}`) }
}
const sendOpen = ref(false)
const send = reactive({ email: true, reminders: true })
async function doSend() {
  const id = await persist()
  if (!id) { sendOpen.value = false; return }
  try {
    const r = await $fetch<{ emailed: boolean, warning?: string }>(`/api/invoices/${id}/send`, { method: 'POST', body: send })
    if (r.warning) toast.info(r.warning)
    else toast.success(r.emailed ? 'Invoice terkirim ke email klien' : 'Invoice ditandai terkirim (SMTP belum diatur — email dicetak di log server)')
    router.push(`/invoices/${id}`)
  } catch (e) { err.value = errorMessage(e) } finally { sendOpen.value = false }
}
</script>

<template>
  <UiPageHeader :title="invoiceId ? `Ubah ${number}` : 'Buat Invoice'" subtitle="Pilih proyek dan termin — item, klien, dan nominal terisi otomatis.">
    <template #badge><UiBadge :tone="INVOICE_STATUS.draf" /></template>
    <template #actions>
      <NuxtLink :to="invoiceId ? `/invoices/${invoiceId}` : '/payments'" class="btn-secondary">Batal</NuxtLink>
      <button type="button" class="btn-secondary" :disabled="saving" @click="saveDraft">Simpan Draf</button>
      <button type="button" class="btn-secondary" :disabled="saving" @click="downloadPdf">Unduh PDF</button>
      <button type="button" class="btn-primary" :disabled="saving" @click="sendOpen = true">Kirim Invoice</button>
    </template>
  </UiPageHeader>
  <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-4 py-3">{{ err }}</p>

  <div class="grid gap-6 xl:grid-cols-[1fr_440px] items-start">
    <div class="flex flex-col gap-6 min-w-0">
      <section class="card-pad flex flex-col gap-4">
        <h2 class="section-title">Proyek &amp; Klien</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiSearchSelect v-model="f.projectId" label="Proyek" :options="projectOpts" :disabled="!!invoiceId" search-placeholder="Cari proyek…" placeholder="Pilih proyek…" />
          <UiSelect v-model="f.termId" label="Termin" :options="termOpts" :disabled="!!invoiceId || !f.projectId" :placeholder="f.projectId ? 'Semua termin sudah ditagih' : 'Pilih proyek dulu'" />
        </div>
        <dl class="m-0 grid gap-2 sm:grid-cols-3 text-sm rounded-lg bg-soft p-4">
          <div class="flex flex-col gap-0.5"><dt class="text-xs text-muted">Ditagihkan ke</dt><dd class="m-0 font-semibold">{{ project?.client?.name ?? '—' }}</dd></div>
          <div class="flex flex-col gap-0.5"><dt class="text-xs text-muted">Kontak</dt><dd class="m-0 font-semibold">{{ [project?.client?.contactName, project?.client?.email].filter(Boolean).join(' · ') || '—' }}</dd></div>
          <div class="flex flex-col gap-0.5"><dt class="text-xs text-muted">Nilai kontrak</dt><dd class="m-0 font-semibold">{{ rupiah(project?.contractValue) }}</dd></div>
        </dl>
        <p v-if="project && !project.client?.email" class="m-0 text-xs text-warning-700">Email klien belum diisi — invoice tidak bisa dikirim lewat email. Lengkapi di Edit Proyek.</p>
      </section>

      <section class="card-pad flex flex-col gap-4">
        <h2 class="section-title">Detail Invoice</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="field">No. invoice<input :value="number" class="input bg-soft" readonly><span class="hint">Otomatis sesuai format di Pengaturan</span></label>
          <UiDateTimeInput v-model="f.issueDate as any" label="Tanggal terbit" :clearable="false" />
          <UiDateTimeInput v-model="f.dueDate" label="Jatuh tempo" :min="f.issueDate" />
        </div>
      </section>

      <section class="card-pad flex flex-col gap-4">
        <h2 class="section-title">Item</h2>
        <div v-for="(it, i) in f.items" :key="i" class="grid gap-3 sm:grid-cols-[1fr_80px_170px_auto] items-end">
          <label class="field">Deskripsi<input v-model="it.description" class="input"></label>
          <label class="field">Qty<input v-model.number="it.qty" type="number" min="1" class="input"></label>
          <UiMoneyInput v-model="it.price" label="Harga" />
          <button type="button" class="btn-ghost !min-h-11 !px-2.5" aria-label="Hapus item" :disabled="f.items.length <= 1" @click="f.items.splice(i, 1)">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div><button type="button" class="btn-secondary btn-sm" @click="f.items.push({ description: '', qty: 1, price: 0 })">+ Tambah item</button></div>
        <div class="grid gap-4 sm:grid-cols-2 border-t border-line-3 pt-4">
          <UiMoneyInput v-model="f.discount" label="Diskon" />
          <label class="field">Pajak (%)<input v-model.number="f.taxPercent" type="number" min="0" max="100" step="0.01" class="input"><span class="hint">Isi 0 jika tidak dikenakan pajak</span></label>
        </div>
      </section>

      <section class="card-pad flex flex-col gap-4">
        <h2 class="section-title">Pembayaran &amp; Catatan</h2>
        <UiSelect v-model="f.bankAccountId" label="Rekening tujuan" :options="bankOpts" placeholder="Belum ada rekening — tambah di Pengaturan" />
        <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer" :class="!ctx?.settings.qrisKey && 'opacity-60'"><input v-model="f.showQris" type="checkbox" class="w-[18px] h-[18px] accent-brand-600" :disabled="!ctx?.settings.qrisKey">Tampilkan kode QRIS di invoice<span v-if="!ctx?.settings.qrisKey" class="text-xs text-muted">(unggah QRIS di Pengaturan)</span></label>
        <label class="field">Catatan untuk klien<textarea v-model="f.notes" rows="3" class="input" /></label>
      </section>
    </div>

    <aside aria-label="Pratinjau invoice" class="xl:sticky xl:top-24 flex flex-col gap-2">
      <span class="text-xs font-semibold text-muted uppercase tracking-wide">Pratinjau</span>
      <FinanceInvoicePaper
        :business="ctx?.business ?? { name: 'OCN Development' }"
        :number="number ?? ''"
        :client-name="project?.client?.name"
        :client-contact="[project?.client?.contactName, project?.client?.email].filter(Boolean).join(' · ') || null"
        :project-name="project?.name"
        :issue-date="f.issueDate"
        :due-date="f.dueDate"
        :items="f.items"
        :subtotal="totals.subtotal"
        :discount="totals.discount"
        :tax-percent="f.taxPercent"
        :tax="totals.tax"
        :total="totals.total"
        :bank="bank"
        :notes="f.notes"
        :footer="ctx?.settings.footer"
        :qris-url="f.showQris ? ctx?.settings.qrisUrl : null"
        status="draf"
      />
    </aside>
  </div>

  <UiModal :open="sendOpen" title="Kirim invoice ke klien?" width="460px" @close="sendOpen = false">
    <p class="m-0 text-sm text-muted">{{ number }} senilai <strong class="text-ink">{{ rupiah(totals.total) }}</strong> untuk {{ project?.client?.name ?? 'klien' }}, jatuh tempo {{ dateId(f.dueDate) }}.</p>
    <label class="flex items-center gap-2 text-sm min-h-11"><input v-model="send.email" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Email ke {{ project?.client?.email || '(email klien belum diisi)' }} — PDF terlampir</label>
    <label class="flex items-center gap-2 text-sm min-h-11 opacity-60"><input type="checkbox" disabled class="w-[18px] h-[18px]">WhatsApp (fase 2)</label>
    <label class="flex items-center gap-2 text-sm min-h-11"><input v-model="send.reminders" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Aktifkan pengingat H-7 &amp; hari H ke klien</label>
    <template #footer>
      <button type="button" class="btn-secondary" @click="sendOpen = false">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving" @click="doSend">Kirim sekarang</button>
    </template>
  </UiModal>
</template>
