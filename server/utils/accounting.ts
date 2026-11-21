/**
 * Laporan keuangan gaya akuntansi (basis kas) dari data transaksi OCN Project Hub:
 * Laba Rugi, Neraca, Arus Kas, Perubahan Modal, dan Buku Kas.
 *
 * Dasar penyusunan:
 *  - Pendapatan diakui saat pembayaran klien diterima; beban saat pengeluaran dicatat.
 *  - Pembelian aset dicatat sebagai aset tetap (tanpa penyusutan), tidak mengurangi laba.
 *  - Pengeluaran yang dibayar dengan uang pribadi dicatat sebagai kontribusi pemilik.
 *  - Distribusi bagi hasil (bagian modal & pekerja) mengurangi laba ditahan; bagian kas tetap di kas.
 * Dengan dasar ini Neraca selalu seimbang: Kas + Aset tetap = Ekuitas.
 */
import { sql, type SQL } from 'drizzle-orm'

const n = (v: unknown) => Number(v ?? 0)

function range(col: string, from: string | null, to: string | null): SQL {
  const parts: SQL[] = [sql`true`]
  if (from) parts.push(sql`${sql.raw(col)} >= ${from}`)
  if (to) parts.push(sql`${sql.raw(col)} <= ${to}`)
  return sql.join(parts, sql` and `)
}

async function one(q: SQL): Promise<any> {
  return (await useDB().execute(q)).rows[0] ?? {}
}
async function many(q: SQL): Promise<any[]> {
  return (await useDB().execute(q)).rows as any[]
}

/** Agregat transaksi dalam rentang tanggal (from/to inklusif; null = tanpa batas). */
export async function aggregates(from: string | null, to: string | null) {
  const r = await one(sql`
    select
      (select coalesce(sum(nominal), 0) from payments where ${range('tanggal', from, to)}) as payments,
      (select coalesce(sum(nominal), 0) from expenses where not adalah_aset and sumber = 'kas_ocn' and project_id is not null and ${range('tanggal', from, to)}) as kas_proj,
      (select coalesce(sum(nominal), 0) from expenses where not adalah_aset and sumber = 'kas_ocn' and project_id is null and ${range('tanggal', from, to)}) as kas_ops,
      (select coalesce(sum(nominal), 0) from expenses where adalah_aset and sumber = 'kas_ocn' and ${range('tanggal', from, to)}) as kas_asset,
      (select coalesce(sum(nominal), 0) from expenses where not adalah_aset and sumber <> 'kas_ocn' and ${range('tanggal', from, to)}) as prib_nonasset,
      (select coalesce(sum(nominal), 0) from expenses where adalah_aset and sumber <> 'kas_ocn' and ${range('tanggal', from, to)}) as prib_asset,
      (select coalesce(sum(nominal), 0) from capital_deposits where ${range('tanggal', from, to)}) as deposits,
      (select coalesce(sum(case when jenis = 'masuk' then nominal else -nominal end), 0) from cash_ledger where ref_type = 'saldo_awal' and ${range('tanggal', from, to)}) as opening,
      (select coalesce(sum(dl.nominal), 0) from distribution_lines dl join distributions d on d.id = dl.distribution_id where dl.bagian in ('modal', 'pekerja') and ${range('d.tanggal', from, to)}) as payouts,
      (select coalesce(sum(dl.nominal), 0) from distribution_lines dl join distributions d on d.id = dl.distribution_id where dl.bagian = 'modal' and ${range('d.tanggal', from, to)}) as payout_modal,
      (select coalesce(sum(dl.nominal), 0) from distribution_lines dl join distributions d on d.id = dl.distribution_id where dl.bagian = 'pekerja' and ${range('d.tanggal', from, to)}) as payout_pekerja,
      (select coalesce(sum(dl.nominal), 0) from distribution_lines dl join distributions d on d.id = dl.distribution_id where dl.bagian = 'kas' and ${range('d.tanggal', from, to)}) as dist_kas,
      (select coalesce(sum(case when jenis = 'masuk' then nominal else -nominal end), 0) from cash_ledger where ${range('tanggal', from, to)}) as cash_net
  `)
  const a = {
    payments: n(r.payments), kasProj: n(r.kas_proj), kasOps: n(r.kas_ops), kasAsset: n(r.kas_asset),
    pribNonAsset: n(r.prib_nonasset), pribAsset: n(r.prib_asset), deposits: n(r.deposits), opening: n(r.opening),
    payouts: n(r.payouts), payoutModal: n(r.payout_modal), payoutPekerja: n(r.payout_pekerja), distKas: n(r.dist_kas), cashNet: n(r.cash_net),
  }
  return {
    ...a,
    expensesNonAsset: a.kasProj + a.kasOps + a.pribNonAsset,
    netProfit: a.payments - (a.kasProj + a.kasOps + a.pribNonAsset),
  }
}

/** Komponen ekuitas per tanggal (kumulatif sampai `asOf`). */
async function equityAsOf(asOf: string | null) {
  const a = await aggregates(null, asOf)
  const retained = a.netProfit - a.payouts
  return {
    capital: a.deposits, opening: a.opening, owner: a.pribNonAsset + a.pribAsset, retained,
    total: a.deposits + a.opening + a.pribNonAsset + a.pribAsset + retained,
  }
}

const dayBefore = (d: string) => addDays(d, -1)

export async function buildStatements(me: SessionUser, period: Period & { label: string }) {
  const today = todayISO()
  const from = period.from ?? null
  // Periode yang belum selesai dipotong sampai hari ini.
  const to = period.to && period.to < today ? period.to : today
  const asOf = to
  const periodText = from ? `${dateLongId(from)} – ${dateLongId(to)}` : `sampai dengan ${dateLongId(to)}`
  const ids = await accessibleProjectIds(me)
  const p = await aggregates(from, to)

  // ── Laba Rugi ──
  const revenueRows = await many(sql`
    select pr.id, pr.name, sum(pay.nominal) as v
    from payments pay join invoices i on i.id = pay.invoice_id join projects pr on pr.id = i.project_id
    where ${range('pay.tanggal', from, to)} group by pr.id, pr.name order by v desc`)
  const visible = revenueRows.filter(r => ids === null || ids.includes(r.id))
  const hiddenRevenue = revenueRows.filter(r => !(ids === null || ids.includes(r.id))).reduce((s, r) => s + n(r.v), 0)
  const projCats = await many(sql`
    select kategori, sum(nominal) as v from expenses
    where not adalah_aset and project_id is not null and ${range('tanggal', from, to)} group by kategori order by v desc`)
  const opsCats = await many(sql`
    select kategori, sum(nominal) as v from expenses
    where not adalah_aset and project_id is null and ${range('tanggal', from, to)} group by kategori order by v desc`)
  const directTotal = projCats.reduce((s, r) => s + n(r.v), 0)
  const opsTotal = opsCats.reduce((s, r) => s + n(r.v), 0)
  const gross = p.payments - directTotal
  const net = gross - opsTotal

  const labaRugi: Statement = {
    key: 'labarugi', title: 'Laporan Laba Rugi', subtitle: `Periode ${periodText}`,
    rows: [
      { label: 'Pendapatan', kind: 'section' },
      ...visible.map(r => ({ label: `Jasa pengembangan — ${r.name}`, amount: n(r.v), kind: 'line' as const, indent: 1 })),
      ...(hiddenRevenue ? [{ label: 'Jasa pengembangan — proyek lain', amount: hiddenRevenue, kind: 'line' as const, indent: 1 }] : []),
      ...(!revenueRows.length ? [{ label: 'Belum ada pendapatan', amount: 0, kind: 'line' as const, indent: 1 }] : []),
      { label: 'Total pendapatan', amount: p.payments, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: 'Beban langsung proyek', kind: 'section' },
      ...projCats.map(r => ({ label: r.kategori as string, amount: -n(r.v), kind: 'line' as const, indent: 1 })),
      { label: 'Total beban langsung proyek', amount: -directTotal, kind: 'subtotal' },
      { label: 'Laba kotor', amount: gross, kind: 'total' },
      { label: '', kind: 'spacer' },
      { label: 'Beban operasional', kind: 'section' },
      ...opsCats.map(r => ({ label: r.kategori as string, amount: -n(r.v), kind: 'line' as const, indent: 1 })),
      { label: 'Total beban operasional', amount: -opsTotal, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: net >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH', amount: net, kind: 'grand' },
      { label: '', kind: 'spacer' },
      { label: 'Pembagian laba periode ini (memo)', kind: 'section' },
      { label: 'Bagian modal — investor', amount: p.payoutModal, kind: 'line', indent: 1 },
      { label: 'Bagian pekerja — tim', amount: p.payoutPekerja, kind: 'line', indent: 1 },
      { label: 'Bagian kas OCN (ditahan)', amount: p.distKas, kind: 'line', indent: 1 },
    ],
    notes: [
      'Disusun dengan basis kas: pendapatan diakui saat pembayaran klien diterima.',
      'Pembelian aset tidak dibebankan ke laba; dicatat sebagai aset tetap di Neraca.',
      ...(p.payments ? [`Margin laba bersih ${Math.round(net / p.payments * 100)}%.`] : []),
    ],
  }

  // ── Neraca ──
  const cum = await aggregates(null, asOf)
  const cash = cum.cashNet
  const fixedAssets = cum.kasAsset + cum.pribAsset
  const eq = await equityAsOf(asOf)
  const totalAssets = cash + fixedAssets
  const rec = await receivables(ids)
  const recTotal = rec.reduce((s, r) => s + r.outstanding, 0)
  const neraca: Statement = {
    key: 'neraca', title: 'Neraca', subtitle: `Per ${dateLongId(asOf)}`,
    rows: [
      { label: 'ASET', kind: 'section' },
      { label: 'Aset lancar', kind: 'section', indent: 1 },
      { label: 'Kas OCN', amount: cash, kind: 'line', indent: 2 },
      { label: 'Total aset lancar', amount: cash, kind: 'subtotal', indent: 1 },
      { label: 'Aset tetap', kind: 'section', indent: 1 },
      { label: 'Peralatan & perangkat (harga perolehan)', amount: fixedAssets, kind: 'line', indent: 2 },
      { label: 'Total aset tetap', amount: fixedAssets, kind: 'subtotal', indent: 1 },
      { label: 'TOTAL ASET', amount: totalAssets, kind: 'grand' },
      { label: '', kind: 'spacer' },
      { label: 'KEWAJIBAN', kind: 'section' },
      { label: 'Belum ada kewajiban tercatat', amount: 0, kind: 'line', indent: 1 },
      { label: 'Total kewajiban', amount: 0, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: 'EKUITAS', kind: 'section' },
      { label: 'Modal disetor investor', amount: eq.capital, kind: 'line', indent: 1 },
      ...(eq.opening ? [{ label: 'Saldo awal kas (pindahan Excel)', amount: eq.opening, kind: 'line' as const, indent: 1 }] : []),
      ...(eq.owner ? [{ label: 'Kontribusi pemilik (dibayar pribadi)', amount: eq.owner, kind: 'line' as const, indent: 1 }] : []),
      { label: 'Laba ditahan', amount: eq.retained, kind: 'line', indent: 1 },
      { label: 'Total ekuitas', amount: eq.total, kind: 'subtotal' },
      { label: 'TOTAL KEWAJIBAN & EKUITAS', amount: eq.total, kind: 'grand' },
      { label: '', kind: 'spacer' },
      { label: 'Memo (tidak masuk neraca basis kas)', kind: 'section' },
      { label: 'Piutang klien — termin belum lunas per hari ini', amount: recTotal, kind: 'note', indent: 1 },
    ],
    notes: [
      'Basis kas: piutang klien belum diakui sebagai aset sampai pembayaran diterima.',
      'Aset tetap disajikan sebesar harga perolehan, belum disusutkan.',
    ],
    check: { ok: totalAssets === eq.total, label: totalAssets === eq.total ? 'Seimbang: total aset = total kewajiban & ekuitas' : 'Tidak seimbang', diff: totalAssets - eq.total },
  }

  // ── Arus Kas ──
  const openingCash = from ? (await aggregates(null, dayBefore(from))).cashNet : 0
  const opCash = p.payments - p.kasProj - p.kasOps
  const invCash = -p.kasAsset
  const finCash = p.deposits + p.opening - p.payouts
  const change = opCash + invCash + finCash
  const closing = openingCash + change
  const ledgerClosing = cum.cashNet
  const arusKas: Statement = {
    key: 'aruskas', title: 'Laporan Arus Kas', subtitle: `Periode ${periodText}`,
    rows: [
      { label: 'Arus kas dari aktivitas operasi', kind: 'section' },
      { label: 'Penerimaan dari klien', amount: p.payments, kind: 'line', indent: 1 },
      { label: 'Pembayaran beban proyek', amount: -p.kasProj, kind: 'line', indent: 1 },
      { label: 'Pembayaran beban operasional', amount: -p.kasOps, kind: 'line', indent: 1 },
      { label: 'Kas bersih dari aktivitas operasi', amount: opCash, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: 'Arus kas dari aktivitas investasi', kind: 'section' },
      { label: 'Pembelian aset tetap', amount: -p.kasAsset, kind: 'line', indent: 1 },
      { label: 'Kas bersih dari aktivitas investasi', amount: invCash, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: 'Arus kas dari aktivitas pendanaan', kind: 'section' },
      { label: 'Setoran modal investor', amount: p.deposits, kind: 'line', indent: 1 },
      ...(p.opening ? [{ label: 'Saldo awal kas (pindahan Excel)', amount: p.opening, kind: 'line' as const, indent: 1 }] : []),
      { label: 'Distribusi bagi hasil dibayar', amount: -p.payouts, kind: 'line', indent: 1 },
      { label: 'Kas bersih dari aktivitas pendanaan', amount: finCash, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: change >= 0 ? 'Kenaikan bersih kas' : 'Penurunan bersih kas', amount: change, kind: 'total' },
      { label: 'Saldo kas awal periode', amount: openingCash, kind: 'line' },
      { label: 'SALDO KAS AKHIR PERIODE', amount: closing, kind: 'grand' },
    ],
    notes: ['Pengeluaran yang dibayar dengan uang pribadi tidak melewati kas OCN sehingga tidak tampil di arus kas.'],
    check: { ok: closing === ledgerClosing, label: closing === ledgerClosing ? 'Cocok dengan saldo mutasi kas OCN' : 'Tidak cocok dengan mutasi kas', diff: closing - ledgerClosing },
  }

  // ── Perubahan Modal ──
  const start = from ? await equityAsOf(dayBefore(from)) : { capital: 0, opening: 0, owner: 0, retained: 0, total: 0 }
  const end = await equityAsOf(asOf)
  const owner = p.pribNonAsset + p.pribAsset
  const perubahanModal: Statement = {
    key: 'modal', title: 'Laporan Perubahan Ekuitas', subtitle: `Periode ${periodText}`,
    rows: [
      { label: from ? `Ekuitas awal (${dateLongId(dayBefore(from))})` : 'Ekuitas awal', amount: start.total, kind: 'total' },
      { label: '', kind: 'spacer' },
      { label: 'Penambahan', kind: 'section' },
      { label: 'Setoran modal investor', amount: p.deposits, kind: 'line', indent: 1 },
      ...(p.opening ? [{ label: 'Saldo awal kas (pindahan Excel)', amount: p.opening, kind: 'line' as const, indent: 1 }] : []),
      ...(owner ? [{ label: 'Kontribusi pemilik (dibayar pribadi)', amount: owner, kind: 'line' as const, indent: 1 }] : []),
      { label: net >= 0 ? 'Laba bersih periode berjalan' : 'Rugi bersih periode berjalan', amount: net, kind: 'line', indent: 1 },
      { label: 'Pengurangan', kind: 'section' },
      { label: 'Distribusi bagi hasil — bagian modal', amount: -p.payoutModal, kind: 'line', indent: 1 },
      { label: 'Distribusi bagi hasil — bagian pekerja', amount: -p.payoutPekerja, kind: 'line', indent: 1 },
      { label: 'Perubahan ekuitas periode ini', amount: end.total - start.total, kind: 'subtotal' },
      { label: '', kind: 'spacer' },
      { label: `EKUITAS AKHIR (${dateLongId(asOf)})`, amount: end.total, kind: 'grand' },
      { label: '', kind: 'spacer' },
      { label: 'Komposisi ekuitas akhir', kind: 'section' },
      { label: 'Modal disetor investor', amount: end.capital, kind: 'line', indent: 1 },
      ...(end.opening ? [{ label: 'Saldo awal kas', amount: end.opening, kind: 'line' as const, indent: 1 }] : []),
      ...(end.owner ? [{ label: 'Kontribusi pemilik', amount: end.owner, kind: 'line' as const, indent: 1 }] : []),
      { label: 'Laba ditahan', amount: end.retained, kind: 'line', indent: 1 },
    ],
    notes: ['Bagian kas OCN dari distribusi tetap di laba ditahan.'],
    check: (() => {
      const rolled = start.total + p.deposits + p.opening + owner + net - p.payoutModal - p.payoutPekerja
      const ok = rolled === end.total && end.total === eq.total
      return { ok, label: ok ? 'Ekuitas awal + perubahan = ekuitas akhir di Neraca' : 'Tidak cocok dengan Neraca', diff: rolled - eq.total }
    })(),
  }

  return { period: { ...period, from, to: asOf, text: periodText }, labaRugi, neraca, arusKas, perubahanModal }
}

/** Buku kas: mutasi kas OCN dalam periode dengan saldo awal & saldo berjalan. */
export async function buildCashbook(period: Period) {
  const today = todayISO()
  const from = period.from ?? null
  // Periode yang belum selesai dipotong sampai hari ini.
  const to = period.to && period.to < today ? period.to : today
  const opening = from ? (await aggregates(null, dayBefore(from))).cashNet : 0
  const rows = await many(sql`
    select id, tanggal, jenis, nominal, ref_type, keterangan from cash_ledger
    where ${range('tanggal', from, to)} order by tanggal, id`)
  let bal = opening
  const lines = rows.map((r) => {
    const amt = n(r.nominal)
    bal += r.jenis === 'masuk' ? amt : -amt
    return { id: r.id as number, date: r.tanggal as string, description: (r.keterangan as string) ?? '', refType: r.ref_type as string, debit: r.jenis === 'masuk' ? amt : 0, credit: r.jenis === 'keluar' ? amt : 0, balance: bal }
  })
  return {
    from, to, opening, closing: bal,
    totalDebit: lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
    lines,
  }
}

