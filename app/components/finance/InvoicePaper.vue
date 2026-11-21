<script setup lang="ts">
/** Tampilan invoice bergaya kertas (HTML) — dipakai di pratinjau form dan halaman detail invoice. */
interface PaperItem { description: string, qty: number, price: number }
defineProps<{
  business: { name: string, address?: string | null, email?: string | null, whatsapp?: string | null, npwp?: string | null, logoUrl?: string | null }
  number: string
  clientName?: string | null
  clientContact?: string | null
  projectName?: string | null
  issueDate: string | null
  dueDate: string | null
  items: PaperItem[]
  subtotal: number
  discount: number
  taxPercent: number
  tax: number
  total: number
  paid?: number
  outstanding?: number
  bank?: { bankName: string, accountNumber: string, accountName: string } | null
  notes?: string | null
  footer?: string | null
  qrisUrl?: string | null
  /** draf | terkirim | lunas | batal */
  status?: string
}>()
</script>

<template>
  <article class="card mx-auto w-full max-w-[820px] p-5 sm:p-8 flex flex-col gap-6 text-[13px] shadow-sm" :aria-label="`Invoice ${number}`">
    <header class="flex flex-wrap justify-between gap-4">
      <div class="flex items-start gap-3 min-w-0">
        <img v-if="business.logoUrl" :src="business.logoUrl" alt="" class="w-10 h-10 rounded-lg object-contain shrink-0">
        <div v-else class="w-10 h-10 rounded-lg bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">OCN</div>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="font-bold text-sm">{{ business.name }}</span>
          <span class="text-xs text-muted whitespace-pre-line">{{ business.address || '[Alamat usaha]' }}</span>
          <span v-if="business.email || business.whatsapp" class="text-xs text-muted">{{ [business.email, business.whatsapp].filter(Boolean).join(' · ') }}</span>
          <span v-if="business.npwp" class="text-xs text-muted">NPWP {{ business.npwp }}</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="text-xl font-bold text-brand-600 tracking-wide">INVOICE</span>
        <span class="text-xs text-muted">{{ number }}</span>
        <span v-if="status === 'lunas'" class="badge bg-success-50 text-success-700 !text-xs">LUNAS</span>
        <span v-else-if="status === 'batal'" class="badge bg-soft-2 text-muted !text-xs">DIBATALKAN</span>
        <span v-else-if="status === 'draf'" class="badge bg-violet-50 text-[#5925DC] !text-xs">DRAF</span>
      </div>
    </header>

    <div class="flex flex-wrap justify-between gap-4">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-xs text-muted">Ditagihkan ke</span>
        <span class="font-semibold text-sm">{{ clientName ?? '—' }}</span>
        <span v-if="clientContact" class="text-xs text-muted">{{ clientContact }}</span>
        <span class="text-xs mt-1">Proyek: {{ projectName ?? '—' }}</span>
      </div>
      <div class="flex flex-col items-end gap-0.5 text-xs">
        <span><span class="text-muted">Terbit:</span> {{ dateId(issueDate) }}</span>
        <span><span class="text-muted">Jatuh tempo:</span> <strong>{{ dateId(dueDate) }}</strong></span>
      </div>
    </div>

    <table class="w-full text-xs border-collapse">
      <thead><tr class="bg-soft text-muted"><th class="text-left p-2 font-semibold">Deskripsi</th><th class="p-2 font-semibold text-right">Qty</th><th class="p-2 font-semibold text-right">Harga</th><th class="p-2 font-semibold text-right">Jumlah</th></tr></thead>
      <tbody>
        <tr v-for="(it, i) in items" :key="i" class="border-b border-line-3 align-top">
          <td class="p-2">{{ it.description || '—' }}</td>
          <td class="p-2 text-right tabular-nums">{{ numberId(it.qty) }}</td>
          <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ rupiah(it.price) }}</td>
          <td class="p-2 text-right whitespace-nowrap tabular-nums">{{ rupiah(Math.round(it.qty * it.price)) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="flex flex-col gap-1 self-end w-full sm:w-72 text-xs">
      <div class="flex justify-between"><span class="text-muted">Subtotal</span><span class="tabular-nums">{{ rupiah(subtotal) }}</span></div>
      <div v-if="discount" class="flex justify-between"><span class="text-muted">Diskon</span><span class="tabular-nums">− {{ rupiah(discount) }}</span></div>
      <div v-if="taxPercent" class="flex justify-between"><span class="text-muted">Pajak {{ percent(taxPercent) }}</span><span class="tabular-nums">{{ rupiah(tax) }}</span></div>
      <div class="flex justify-between text-sm font-bold border-t border-line-2 pt-1.5 mt-1"><span>Total</span><span class="text-brand-700 tabular-nums">{{ rupiah(total) }}</span></div>
      <template v-if="paid && outstanding !== undefined && outstanding > 0">
        <div class="flex justify-between"><span class="text-muted">Sudah dibayar</span><span class="tabular-nums">{{ rupiah(paid) }}</span></div>
        <div class="flex justify-between font-bold"><span>Sisa tagihan</span><span class="tabular-nums">{{ rupiah(outstanding) }}</span></div>
      </template>
    </div>

    <footer class="flex flex-wrap justify-between gap-4 border-t border-line-3 pt-4">
      <div class="flex flex-col gap-0.5 text-xs min-w-0 flex-1">
        <span class="font-semibold">Pembayaran</span>
        <span>{{ bank ? `Transfer ke ${bank.bankName} ${bank.accountNumber}` : 'Rekening belum dipilih' }}</span>
        <span v-if="bank" class="text-muted">a.n. {{ bank.accountName }}</span>
        <span v-if="notes" class="text-muted mt-2 whitespace-pre-line">{{ notes }}</span>
        <span v-if="footer && footer !== notes" class="text-muted text-[11px] mt-2 whitespace-pre-line">{{ footer }}</span>
      </div>
      <div v-if="qrisUrl" class="flex flex-col items-center gap-1 shrink-0">
        <span class="text-[11px] font-semibold">QRIS</span>
        <img :src="qrisUrl" alt="Kode QRIS pembayaran" class="w-24 h-24 object-contain">
      </div>
    </footer>
  </article>
</template>
