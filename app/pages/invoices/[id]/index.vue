<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['keuangan', 'lihat'] })
const id = Number(useRoute().params.id)
const toast = useToast()
const { confirm } = useConfirm()
const { data, refresh, error } = await useFetch(`/api/invoices/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: errorMessage(error.value), fatal: true })
useHead({ title: () => `${data.value?.invoice.number} — OCN Project Hub` })
const inv = computed(() => data.value!.invoice)
const showPay = ref(false)

async function send() {
  const ok = await confirm({ variant: 'info', title: `Kirim ${inv.value.number} ke klien?`, message: `Senilai ${rupiah(inv.value.total)}, jatuh tempo ${dateId(inv.value.dueDate)}. PDF dikirim ke ${data.value?.client?.email || '(email klien belum diisi)'} dan pengingat H-7 & hari H aktif.`, confirmText: 'Kirim sekarang', action: async () => {
    const r = await $fetch<{ warning?: string, emailed: boolean }>(`/api/invoices/${id}/send`, { method: 'POST', body: { email: true, reminders: true } })
    if (r.warning) toast.info(r.warning)
  } })
  if (ok) { toast.success('Invoice ditandai terkirim'); await refresh() }
}
async function cancel() {
  const ok = await confirm({ variant: 'danger', title: `Batalkan ${inv.value.number}?`, message: 'Termin kembali Terjadwal dan bisa ditagih dengan invoice baru.', confirmText: 'Batalkan invoice', action: () => $fetch<unknown>(`/api/invoices/${id}/cancel`, { method: 'POST' }) })
  if (ok) { toast.success('Invoice dibatalkan'); await refresh() }
}
async function delPayment(pid: number) {
  const ok = await confirm({ variant: 'danger', title: 'Hapus pembayaran ini?', message: 'Status invoice/termin dan saldo kas dihitung ulang.', confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/payments/${pid}`, { method: 'DELETE' }) })
  if (ok) await refresh()
}
</script>

<template>
  <div v-if="data" class="flex flex-col gap-6">
    <UiPageHeader :title="inv.number" :subtitle="`${data.project.name} · ${data.term?.name ?? ''} · ${data.client?.name ?? 'tanpa klien'}`">
      <template #before><NuxtLink to="/payments" class="text-sm font-semibold">← Pembayaran</NuxtLink></template>
      <template #badge><UiBadge :tone="INVOICE_STATUS[data.displayStatus]" /></template>
      <template #actions>
        <a :href="`/api/invoices/${id}/pdf?download=1`" class="btn-secondary">Unduh PDF</a>
        <NuxtLink v-if="inv.status === 'draf'" :to="`/invoices/${id}/edit`" class="btn-secondary">Ubah</NuxtLink>
        <button v-if="inv.status === 'draf'" type="button" class="btn-primary" @click="send">Kirim Invoice</button>
        <button v-if="inv.status === 'terkirim'" type="button" class="btn-secondary" @click="send">Kirim Ulang</button>
        <button v-if="inv.status === 'terkirim' || inv.status === 'draf'" type="button" class="btn-primary" @click="showPay = true">Catat Pembayaran</button>
      </template>
    </UiPageHeader>

    <div class="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
      <FinanceInvoicePaper
        :business="data.paper.business"
        :number="inv.number"
        :client-name="data.client?.name"
        :client-contact="[data.client?.contactName, data.client?.email].filter(Boolean).join(' · ') || null"
        :project-name="data.project.name"
        :issue-date="inv.issueDate"
        :due-date="inv.dueDate"
        :items="data.items.map(i => ({ description: i.description, qty: Number(i.qty), price: i.price }))"
        :subtotal="inv.subtotal"
        :discount="inv.discount"
        :tax-percent="Number(inv.taxPercent)"
        :tax="inv.taxAmount"
        :total="inv.total"
        :paid="data.paid"
        :outstanding="data.outstanding"
        :bank="data.bank"
        :notes="inv.notes"
        :footer="data.paper.footer"
        :qris-url="data.paper.qrisUrl"
        :status="inv.status"
      />
      <div class="flex flex-col gap-6">
        <section class="card-pad flex flex-col gap-3">
          <h2 class="section-title">Ringkasan</h2>
          <dl class="m-0 flex flex-col gap-2 text-sm">
            <div class="flex justify-between"><dt class="text-muted">Terbit</dt><dd class="m-0 font-semibold">{{ dateId(inv.issueDate) }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Jatuh tempo</dt><dd class="m-0 font-semibold">{{ dateId(inv.dueDate) }}<span v-if="inv.status === 'terkirim'" class="block text-xs font-normal text-right" :class="inv.dueDate < todayISO() ? 'text-danger-700' : 'text-muted'">{{ relativeDue(inv.dueDate) }}</span></dd></div>
            <div class="flex justify-between"><dt class="text-muted">Total</dt><dd class="m-0 font-bold">{{ rupiah(inv.total) }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Dibayar</dt><dd class="m-0 font-semibold text-success-700">{{ rupiah(data.paid) }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Sisa</dt><dd class="m-0 font-semibold">{{ rupiah(data.outstanding) }}</dd></div>
            <div v-if="inv.sentAt" class="flex justify-between"><dt class="text-muted">Dikirim</dt><dd class="m-0">{{ dateTimeId(inv.sentAt) }}</dd></div>
          </dl>
          <NuxtLink :to="`/projects/${data.project.id}?tab=pembayaran`" class="text-sm font-semibold">Lihat termin proyek →</NuxtLink>
        </section>
        <section class="card-pad flex flex-col gap-3">
          <h2 class="section-title">Pembayaran</h2>
          <div v-for="py in data.payments" :key="py.id" class="flex flex-col gap-1 py-2 border-t border-line-3 first:border-t-0">
            <div class="flex items-center justify-between gap-2">
              <span class="flex flex-col"><span class="text-sm font-semibold">{{ rupiah(py.amount) }}</span><span class="text-xs text-muted">{{ dateId(py.date) }} · {{ py.method }}</span></span>
              <UiActionMenu :label="`Aksi pembayaran ${dateId(py.date)}`" :items="[
                { label: 'Unduh kuitansi', href: `/api/payments/${py.id}/receipt?download=1`, external: true },
                { label: 'Lihat bukti', href: py.proofUrl ?? undefined, external: true, hidden: !py.proofUrl },
                { label: 'Hapus pembayaran', danger: true, onClick: () => delPayment(py.id) },
              ]" />
            </div>
          </div>
          <p v-if="!data.payments.length" class="m-0 text-sm text-muted">Belum ada pembayaran.</p>
        </section>
        <button v-if="(inv.status === 'draf' || inv.status === 'terkirim') && !data.payments.length" type="button" class="btn-secondary text-danger-700 border-danger-600 hover:bg-danger-50 self-start" @click="cancel">Batalkan invoice</button>
      </div>
    </div>
    <FinancePaymentModal :open="showPay" :project-id="data.project.id" :term-id="inv.termId" @close="showPay = false" @saved="() => refresh()" />
  </div>
</template>
