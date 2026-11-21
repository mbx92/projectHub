<script setup lang="ts">
/** Tambah/ubah pengeluaran. Aset dicatat terpisah dan tidak mengurangi laba proyek. */
interface Expense { id: number, projectId: number | null, date: string, description: string, category: string, amount: number, source: string, isAsset: boolean, proofUrl?: string | null }
const props = defineProps<{ open: boolean, projectId?: number | null, expense?: Expense | null, projects?: { id: number, name: string }[] }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const toast = useToast()
const { confirm } = useConfirm()
const f = reactive({ projectId: null as number | null, date: todayISO() as string | null, description: '', category: 'Server & hosting', amount: 0, source: 'kas_ocn', isAsset: false, proofUrl: null as string | null })
const err = ref('')
const saving = ref(false)
const proofChanged = ref(false)

watch(() => props.open, (o) => {
  if (!o) return
  err.value = ''
  proofChanged.value = false
  const e = props.expense
  Object.assign(f, e
    ? { projectId: e.projectId, date: e.date, description: e.description, category: e.category, amount: e.amount, source: e.source, isAsset: e.isAsset, proofUrl: null }
    : { projectId: props.projectId ?? null, date: todayISO(), description: '', category: 'Server & hosting', amount: 0, source: 'kas_ocn', isAsset: false, proofUrl: null })
})
const catOpts = EXPENSE_CATEGORIES.map(c => ({ value: c as string, label: c }))
const projOpts = computed(() => [{ value: null as number | null, label: 'Tanpa proyek (operasional OCN)' }, ...(props.projects ?? []).map(p => ({ value: p.id as number | null, label: p.name }))])

async function save() {
  err.value = ''
  if (!f.description.trim()) { err.value = 'Isi keterangan.'; return }
  if (!f.amount) { err.value = 'Isi nominal.'; return }
  saving.value = true
  try {
    if (props.expense) await $fetch<unknown>(`/api/expenses/${props.expense.id}`, { method: 'PUT', body: { ...f, keepProof: !proofChanged.value } })
    else await $fetch('/api/expenses', { method: 'POST', body: f })
    toast.success(props.expense ? 'Pengeluaran diperbarui' : 'Pengeluaran dicatat')
    emit('saved')
    emit('close')
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}
async function remove() {
  if (!props.expense) return
  const url: string = `/api/expenses/${props.expense.id}`
  const ok = await confirm({ variant: 'danger', title: 'Hapus pengeluaran ini?', message: `${props.expense.description} · ${rupiah(props.expense.amount)}. Mutasi kas terkait ikut dihapus.`, confirmText: 'Hapus', action: () => $fetch<{ ok: boolean }>(url, { method: 'DELETE' }) })
  if (ok) { toast.success('Pengeluaran dihapus'); emit('saved'); emit('close') }
}
</script>

<template>
  <UiModal :open="open" :title="expense ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'" description="Dibayar dari kas OCN dan mengurangi laba proyek (kecuali aset)." width="680px" @close="emit('close')">
    <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <UiSearchSelect v-if="projects" v-model="f.projectId" label="Proyek" :options="projOpts" search-placeholder="Cari proyek…" />
      <UiSelect v-model="f.source" label="Sumber dana" :options="[{ value: 'kas_ocn', label: 'Kas OCN' }, { value: 'pribadi', label: 'Uang pribadi (di luar kas)' }]" />
    </div>
    <label class="field">Keterangan<input v-model="f.description" class="input" placeholder="Mis. Sewa VPS 3 bulan"></label>
    <div class="grid gap-3 sm:grid-cols-3">
      <UiSelect v-model="f.category" label="Kategori" :options="catOpts" />
      <UiMoneyInput v-model="f.amount" label="Nominal" />
      <UiDateTimeInput v-model="f.date" label="Tanggal" :clearable="false" />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
      <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer" title="Mis. tablet kasir, laptop. Dicatat terpisah dan tidak mengurangi laba proyek."><input v-model="f.isAsset" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Pembelian aset OCN <span class="text-xs text-muted">(tidak mengurangi laba)</span></label>
      <div class="flex flex-wrap items-center gap-2"><UiFileButton v-model="f.proofUrl" folder="bukti" label="Lampirkan bukti" @update:model-value="proofChanged = true" /><a v-if="expense?.proofUrl && !proofChanged" :href="expense.proofUrl" target="_blank" class="text-xs">Lihat bukti saat ini</a></div>
    </div>
    <template #footer>
      <button v-if="expense" type="button" class="btn-ghost text-danger-700 mr-auto" @click="remove">Hapus</button>
      <button type="button" class="btn-secondary" @click="emit('close')">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
    </template>
  </UiModal>
</template>
