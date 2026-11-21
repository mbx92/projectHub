<template>
  <div class="flex min-h-screen bg-white">
    <section class="hidden lg:flex flex-[1_1_420px] bg-navy text-line p-12 flex-col justify-between gap-10">
      <div class="flex items-center gap-3">
        <img src="/logo-mark.svg" alt="" class="w-10 h-10 rounded-[10px]">
        <span class="text-white font-bold text-base">OCN Project Hub</span>
      </div>
      <div class="flex flex-col gap-4 max-w-[460px]">
        <h1 class="m-0 text-white text-3xl sm:text-[34px] font-bold leading-tight tracking-[-0.5px]">Proyek, pembayaran, dan bagi hasil dalam satu tempat.</h1>
        <p class="m-0 text-[15px] leading-relaxed text-line">Pengganti file Excel per proyek: tim melihat progres dan bug, investor melihat modal dan hasilnya secara transparan.</p>
      </div>
      <ul class="m-0 p-0 list-none flex flex-col gap-3 text-sm">
        <li v-for="t in ['Termin pembayaran klien dan pengingat otomatis', 'Skema bagi hasil per proyek', 'Bug tracker untuk tiap proyek']" :key="t" class="flex items-center gap-2.5">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5FD3C1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>{{ t }}
        </li>
      </ul>
    </section>
    <section class="flex-[1_1_420px] flex items-center justify-center p-6 sm:p-12">
      <div class="w-full max-w-[400px]">
        <slot />
      </div>
    </section>
    <UiToasts />
  </div>
</template>
