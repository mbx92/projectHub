<script setup lang="ts">
/** Tampilan laporan keuangan bergaya kertas akuntansi: judul di tengah, indentasi, garis subtotal & garis ganda total akhir. */
defineProps<{ st: Statement, company: string }>()
</script>

<template>
  <article class="card mx-auto w-full max-w-[820px] px-4 sm:px-10 py-6 sm:py-8 flex flex-col gap-6" :aria-label="st.title">
    <header class="text-center flex flex-col gap-1">
      <span class="text-sm font-bold uppercase tracking-wide text-ink-2">{{ company }}</span>
      <h2 class="m-0 text-xl font-bold text-brand-700">{{ st.title }}</h2>
      <span class="text-sm text-muted">{{ st.subtitle }}</span>
    </header>
    <table class="w-full border-collapse text-[13px] sm:text-sm">
      <caption class="sr-only">{{ st.title }} {{ st.subtitle }}</caption>
      <thead class="sr-only"><tr><th scope="col">Keterangan</th><th scope="col">Jumlah (Rp)</th></tr></thead>
      <tbody>
        <template v-for="(r, i) in st.rows" :key="i">
          <tr v-if="r.kind === 'spacer'" aria-hidden="true"><td colspan="2" class="h-3" /></tr>
          <tr v-else>
            <th
              scope="row"
              class="text-left py-1.5 pr-4 align-top"
              :class="{
                'font-bold text-ink pt-2.5': r.kind === 'section',
                'font-bold text-ink': r.kind === 'total' || r.kind === 'grand',
                'font-semibold text-ink-2': r.kind === 'subtotal',
                'font-normal italic text-muted': r.kind === 'note',
                'font-normal text-ink-2': r.kind === 'line',
                'tracking-wide': r.kind === 'grand',
              }"
              :style="{ paddingLeft: `${(r.indent ?? 0) * 14}px` }"
            >{{ r.label }}</th>
            <td
              class="text-right tabular-nums whitespace-nowrap py-1.5 w-[8.5rem] sm:w-44 align-top"
              :class="[
                (r.kind === 'subtotal' || r.kind === 'total') && 'border-t border-ink-2',
                r.kind === 'grand' && 'border-t border-ink border-b-[3px] border-b-double font-bold',
                r.kind === 'total' && 'font-bold',
                r.kind === 'note' && 'italic text-muted',
                (r.amount ?? 0) < 0 && r.kind !== 'note' && 'text-danger-700',
              ]"
            >{{ r.kind === 'section' ? '' : rupiahAcc(r.amount) }}</td>
          </tr>
        </template>
      </tbody>
    </table>
    <footer v-if="st.check || st.notes?.length" class="flex flex-col gap-1.5 border-t border-line-3 pt-4">
      <span v-if="st.check" class="text-xs font-semibold flex items-center gap-1.5" :class="st.check.ok ? 'text-success-700' : 'text-danger-700'">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path :d="st.check.ok ? 'M5 12l5 5L20 7' : 'M6 6l12 12M18 6L6 18'" /></svg>
        {{ st.check.label }}<template v-if="!st.check.ok"> (selisih {{ rupiahAcc(st.check.diff) }})</template>
      </span>
      <span v-for="(n, i) in st.notes" :key="i" class="text-xs text-muted">{{ n }}</span>
    </footer>
  </article>
</template>

<style scoped>
.border-b-double { border-bottom-style: double; }
</style>
