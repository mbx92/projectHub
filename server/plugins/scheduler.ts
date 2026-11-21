/** Penjadwal sederhana: jalankan pengingat saat server hidup lalu setiap jam. */
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  const run = () => runReminders().catch(err => console.error('[scheduler] pengingat gagal:', err?.message ?? err))
  setTimeout(run, 15_000)
  setInterval(run, 60 * 60 * 1000)
})
