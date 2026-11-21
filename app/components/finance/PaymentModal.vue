<script setup lang="ts">
/** Catat pembayaran masuk untuk termin (invoice dibuat otomatis bila belum ada). */
const props = defineProps<{ open: boolean, projectId?: number | null, termId?: number | null }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const toast = useToast()
const { data: ctx, refresh } = await useFetch('/api/invoices/context', { immediate: false, server: false })

const f = reactive({ termId: null as number | null, amount: 0, date: todayISO() as string | null, method: 'Transfer bank', proofUrl: null as string | null, notes: '', sendReceipt: true })
const saving = ref(false)
const err = ref('')

watch(() => props.open, async (o) => {
  if (!o) return
  err.value = ''
  await refresh()
  Object.assign(f, { termId: props.termId ?? null, date: todayISO(), proofUrl: null, notes: '', method: 'Transfer bank', sendReceipt: true })
  if (!f.termId && termOpts.value.length) f.termId = termOpts.value[0]!.value
  syncAmount()
})
const terms = computed(() => (ctx.value?.terms ?? []).filter(t => t.status !== 'lunas' && (!props.projectId || t.projectId === props.projectId)))
const projectName = (id: number) => ctx.value?.projects.find(p => p.id === id)?.name ?? ''
const termOpts = computed(() => terms.value.map(t => ({ value: t.id as number | null, label: `${props.projectId ? '' : `${projectName(t.projectId)} · `}${t.name} — ${rupiah(t.outstanding)}`, desc: t.invoiceNumber ? `${t.invoiceNumber} · sisa ${rupiah(t.outstanding)}` : 'Belum ada invoice — dibuat otomatis' })))
const current = computed(() => terms.value.find(t => t.id === f.termId))
function syncAmount() { f.amount = current.value?.outstanding ?? 0 }
watch(() => f.termId, syncAmount)

async function save() {
  err.value = ''
  if (!f.termId) { err.value = 'Pilih termin.'; return }
  if (!f.date) { err.value = 'Isi tanggal bayar.'; return }
  saving.value = true
  try {
    const r = await $fetch<{ lunas: boolean, number: string, receiptSent: boolean }>('/api/payments', { method: 'POST', body: { ...f, termId: f.termId, notes: f.notes || null } })
    toast.success(`Pembayaran ${rupiah(f.amount)} dicatat${r.lunas ? ' · termin lunas' : ''}${f.sendReceipt ? (r.receiptSent ? ' · kuitansi terkirim' : ' · kuitansi tidak terkirim (email klien/SMTP belum diatur)') : ''}`)
    emit('saved')
    emit('close')
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}
const methods = computed(() => {
  const m = ctx.value?.settings.methods
  return PAYMENT_METHODS.filter(x => !m || (x === 'Transfer bank' ? m.transfer : x === 'QRIS' ? m.qris : m.tunai) || x === f.method).map(x => ({ value: x as string, label: x }))
})
</script>

<template>
  <UiModal :open="open" title="Catat Pembayaran Masuk" description="Pembayaran masuk ke kas OCN; termin otomatis Lunas bila sudah terbayar penuh." @close="emit('close')">
    <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
    <UiSelect v-model="f.termId" label="Termin" :options="termOpts" placeholder="Tidak ada termin yang belum lunas" />
    <div class="grid gap-4 sm:grid-cols-2">
      <UiMoneyInput v-model="f.amount" label="Nominal diterima" :hint="current ? `Sisa tagihan ${rupiah(current.outstanding)}` : undefined" />
      <UiDateTimeInput v-model="f.date" label="Tanggal bayar" :clearable="false" />
      <UiSelect v-model="f.method" label="Metode" :options="methods" />
      <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold text-ink-2">Bukti transfer</span><UiFileButton v-model="f.proofUrl" folder="bukti" /></div>
    </div>
    <label class="field">Catatan<input v-model="f.notes" class="input" placeholder="Opsional"></label>
    <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer"><input v-model="f.sendReceipt" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Kirim kuitansi ke email klien</label>
    <template #footer>
      <button type="button" class="btn-secondary" @click="emit('close')">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving || !f.termId" @click="save">{{ saving ? 'Menyimpan…' : 'Simpan Pembayaran' }}</button>
    </template>
  </UiModal>
</template>
