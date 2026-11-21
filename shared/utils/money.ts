/** Perhitungan uang. Semua nilai adalah bilangan bulat rupiah. */

export function roundRp(n: number): number {
  return Math.round(n)
}

/** Nominal termin dari persen nilai kontrak. Termin terakhir menyerap sisa pembulatan. */
export function termAmounts(contractValue: number, percents: number[]): number[] {
  const out = percents.map(p => Math.floor(contractValue * p / 100))
  const total = percents.reduce((a, b) => a + b, 0)
  if (Math.abs(total - 100) < 0.001 && out.length) {
    const diff = contractValue - out.reduce((a, b) => a + b, 0)
    out[out.length - 1]! += diff
  }
  return out
}

export function percentTotal(percents: number[]): number {
  return Math.round(percents.reduce((a, b) => a + Number(b || 0), 0) * 100) / 100
}

export interface InvoiceLine { qty: number, price: number }

/** total = subtotal − diskon + pajak, dibulatkan ke rupiah. Pajak dihitung dari (subtotal − diskon). */
export function invoiceTotals(items: InvoiceLine[], discount: number, taxPercent: number) {
  const subtotal = roundRp(items.reduce((a, it) => a + Number(it.qty || 0) * Number(it.price || 0), 0))
  const disc = Math.min(Math.max(0, roundRp(discount || 0)), subtotal)
  const tax = roundRp((subtotal - disc) * Number(taxPercent || 0) / 100)
  return { subtotal, discount: disc, tax, total: subtotal - disc + tax }
}

/**
 * Bagi `total` ke beberapa penerima sesuai bobot, dengan metode sisa terbesar
 * sehingga jumlah bagian selalu sama persis dengan total.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || total <= 0) return weights.map(() => 0)
  const raw = weights.map(w => total * w / sum)
  const floored = raw.map(Math.floor)
  let rest = total - floored.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac)
  for (const o of order) {
    if (rest <= 0) break
    floored[o.i]! += 1
    rest--
  }
  return floored
}

export interface DistributionInput {
  netProfit: number
  capitalPct: number
  workerPct: number
  cashPct: number
  investors: { investorId: number, userId: number, name: string, capital: number }[]
  workers: { userId: number, name: string, weight: number }[]
}

export interface DistributionLineCalc {
  part: 'modal' | 'pekerja' | 'kas'
  recipientUserId: number | null
  name: string
  amount: number
  basisPct: number
}

/** Laba bersih × persentase skema; bagian modal dibagi lagi sesuai porsi modal tiap investor. */
export function calcDistribution(input: DistributionInput): { lines: DistributionLineCalc[], parts: { modal: number, pekerja: number, kas: number } } {
  const profit = Math.max(0, roundRp(input.netProfit))
  const [modal, pekerja, kas] = splitByWeights(profit, [input.capitalPct, input.workerPct, input.cashPct])
  const parts = { modal: modal ?? 0, pekerja: pekerja ?? 0, kas: kas ?? 0 }
  const lines: DistributionLineCalc[] = []

  const totalCapital = input.investors.reduce((a, i) => a + i.capital, 0)
  if (parts.modal > 0) {
    if (totalCapital > 0) {
      const amounts = splitByWeights(parts.modal, input.investors.map(i => i.capital))
      input.investors.forEach((inv, idx) => {
        lines.push({ part: 'modal', recipientUserId: inv.userId, name: inv.name, amount: amounts[idx]!, basisPct: Math.round(inv.capital / totalCapital * 10000) / 100 })
      })
    } else {
      // Belum ada modal investor: bagian modal masuk kas OCN.
      parts.kas += parts.modal
      parts.modal = 0
    }
  }

  const totalWeight = input.workers.reduce((a, w) => a + w.weight, 0)
  if (parts.pekerja > 0) {
    if (totalWeight > 0) {
      const amounts = splitByWeights(parts.pekerja, input.workers.map(w => w.weight))
      input.workers.forEach((w, idx) => {
        lines.push({ part: 'pekerja', recipientUserId: w.userId, name: w.name, amount: amounts[idx]!, basisPct: Math.round(w.weight / totalWeight * 10000) / 100 })
      })
    } else {
      parts.kas += parts.pekerja
      parts.pekerja = 0
    }
  }

  if (parts.kas > 0) lines.push({ part: 'kas', recipientUserId: null, name: 'Kas OCN', amount: parts.kas, basisPct: 100 })
  return { lines, parts }
}
