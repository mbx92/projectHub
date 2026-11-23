/** Nilai penanda template ({{kunci}}) dari data sistem. Fungsi murni; kunci mengikuti spek §5.2. */
import type { BusinessProfile, InvoiceSettings } from '../../shared/utils/settings'
import { dateLongId, percent, rupiah, terbilang } from '../../shared/utils/format'
import type { LoadedInvoice } from './invoices'
import type { DocRenderCtx } from './docLayout'

type Biz = Pick<BusinessProfile, 'name' | 'npwp' | 'email' | 'whatsapp' | 'address' | 'signerName' | 'signerTitle'>
type Vals = Record<string, string>

const join = (parts: (string | null | undefined)[], sep = ' · ') => parts.filter(Boolean).join(sep)

function commonValues(b: Biz): Vals {
  return {
    'usaha.nama': b.name,
    'usaha.alamat': (b.address ?? '').split(/\s*\n\s*/).filter(Boolean).join(', '),
    'usaha.kontak': join([b.email, b.whatsapp]),
    'usaha.npwp': b.npwp ? `NPWP ${b.npwp}` : '',
    'penandatangan.nama': b.signerName || b.name,
    'penandatangan.jabatan': b.signerTitle ?? '',
    tanggal_cetak: dateLongId(new Date()),
  }
}

const STATUS: Record<string, string> = { draf: 'DRAF', terkirim: 'TERKIRIM', lunas: 'LUNAS', terlambat: 'TERLAMBAT', batal: 'BATAL' }

export function invoiceValues(d: LoadedInvoice, b: Biz, s: Pick<InvoiceSettings, 'footer'>): { values: Vals, items: Vals[] } {
  const { invoice: inv, client, project, term, bank } = d
  const values: Vals = {
    ...commonValues(b),
    nomor: inv.number,
    status: STATUS[d.displayStatus] ?? String(d.displayStatus).toUpperCase(),
    terbit: dateLongId(inv.issueDate),
    jatuh_tempo: dateLongId(inv.dueDate),
    'klien.nama': client?.name ?? '—',
    'klien.kontak': join([client?.contactName, client?.whatsapp, client?.email]),
    'klien.alamat': (client?.address ?? '').split(/\s*\n\s*/).filter(Boolean).join(', '),
    'proyek.nama': project.name,
    'termin.nama': term?.name ?? '',
    subtotal: rupiah(inv.subtotal),
    diskon: inv.discount ? `− ${rupiah(inv.discount)}` : '',
    pajak: inv.taxAmount ? rupiah(inv.taxAmount) : '',
    pajak_persen: Number(inv.taxPercent) ? percent(inv.taxPercent) : '',
    total: rupiah(inv.total),
    dibayar: d.paid > 0 ? rupiah(d.paid) : '',
    sisa: d.outstanding > 0 ? rupiah(d.outstanding) : '',
    'bank.nama': bank?.bankName ?? '',
    'bank.nomor': bank?.accountNumber ?? '',
    'bank.atas_nama': bank?.accountName ?? '',
    catatan: inv.notes ?? '',
    catatan_kaki: s.footer && s.footer !== inv.notes ? s.footer : '',
  }
  const items = d.items.map((it, i): Vals => ({
    'item.no': String(i + 1),
    'item.deskripsi': it.description,
    'item.qty': Number(it.qty).toLocaleString('id-ID', { maximumFractionDigits: 2 }),
    'item.harga': rupiah(it.price),
    'item.jumlah': rupiah(Math.round(it.qty * it.price)),
  }))
  return { values, items }
}

export function receiptValues(d: LoadedInvoice, paymentId: number, b: Biz): Vals {
  const pay = d.payments.find(p => p.id === paymentId)
  if (!pay) throw new Error(`Pembayaran ${paymentId} bukan milik invoice ${d.invoice.number}`)
  const firstLine = (b.address ?? '').split('\n')[0]?.trim()
  return {
    ...commonValues(b),
    nomor: `KW-${d.invoice.number.replace(/^INV-?/i, '')}-${pay.id}`,
    'invoice.nomor': d.invoice.number,
    'klien.nama': d.client?.name ?? '—',
    nominal: rupiah(pay.amount),
    terbilang: `${terbilang(pay.amount)} rupiah`,
    untuk: `${d.term?.name ?? 'Tagihan'} · ${d.project.name} (${d.invoice.number})`,
    tanggal: dateLongId(pay.date),
    metode: pay.method,
    status_invoice: d.outstanding > 0 ? `Sisa tagihan ${rupiah(d.outstanding)}` : 'Lunas',
    tempat_tanggal: `${firstLine ? `${firstLine}, ` : ''}${dateLongId(pay.date)}`,
  }
}

export function docFrameValues(ctx: Pick<DocRenderCtx, 'business' | 'footer' | 'docNumber' | 'title' | 'clientName'>, projectName: string): Vals {
  return {
    ...commonValues(ctx.business),
    judul: ctx.title,
    nomor: ctx.docNumber ?? '',
    'proyek.nama': projectName,
    'klien.nama': ctx.clientName ?? '',
    tanggal: dateLongId(new Date()),
    footer: ctx.footer,
  }
}
