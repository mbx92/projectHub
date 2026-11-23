import { describe, expect, it } from 'vitest'
import { docFrameValues, invoiceValues, receiptValues } from '../../server/utils/templateData'
import { terbilang } from '../../shared/utils/format'

const business = { name: 'OCN Development', npwp: '01.234', email: 'hello@ocn.dev', whatsapp: '+62 811', address: 'Jl. Raya 1\nDenpasar', signerName: 'Pande', signerTitle: 'Direktur', logoKey: null, signatureKey: null } as any
const settings = { footer: 'Terima kasih.', qrisKey: null } as any

const data = (over: Record<string, unknown> = {}) => ({
  invoice: { id: 3, number: 'INV-2026-003', status: 'terkirim', issueDate: '2026-11-17', dueDate: '2026-12-10', subtotal: 7200000, discount: 0, taxPercent: 0, taxAmount: 0, total: 7200000, notes: null, ...over },
  project: { name: 'POS Resto' },
  client: { name: 'CV Maju & Jaya', contactName: 'Dewi', whatsapp: '+62 812', email: 'd@x.id', address: 'Denpasar' },
  term: { name: 'DP' },
  items: [{ description: 'Termin 1', qty: 1.5, price: 1000, sortOrder: 0 }, { description: 'Modul', qty: 2, price: 3600000, sortOrder: 1 }],
  payments: [{ id: 12, amount: 6000000, date: '2026-11-17', method: 'Transfer bank' }],
  bank: { bankName: 'BCA', accountNumber: '123', accountName: 'OCN Development' },
  paid: 0, outstanding: 7200000, displayStatus: 'terkirim',
}) as any

describe('invoiceValues', () => {
  it('formats money, dates and contact lines', () => {
    const { values } = invoiceValues(data(), business, settings)
    expect(values).toMatchObject({
      nomor: 'INV-2026-003', total: 'Rp 7.200.000', subtotal: 'Rp 7.200.000', status: 'TERKIRIM',
      'klien.nama': 'CV Maju & Jaya', 'klien.kontak': 'Dewi · +62 812 · d@x.id', 'proyek.nama': 'POS Resto', 'termin.nama': 'DP',
      'usaha.kontak': 'hello@ocn.dev · +62 811', 'usaha.alamat': 'Jl. Raya 1, Denpasar', 'penandatangan.nama': 'Pande',
      'bank.nama': 'BCA', 'bank.nomor': '123', 'bank.atas_nama': 'OCN Development', terbit: '17 November 2026',
    })
    expect(values).not.toHaveProperty('halaman')
  })
  it('leaves diskon, pajak, dibayar empty when zero so {{?…}} hides them', () => {
    const { values } = invoiceValues(data(), business, settings)
    expect(values.diskon).toBe('')
    expect(values.pajak).toBe('')
    expect(values.dibayar).toBe('')
    const v2 = invoiceValues(data({ discount: 500000, taxPercent: 11, taxAmount: 700000 }), business, settings).values
    expect(v2.diskon).toBe('− Rp 500.000')
    expect(v2.pajak).toBe('Rp 700.000')
    expect(v2.pajak_persen).toBe('11%')
  })
  it('builds item rows with number, qty and rounded amount', () => {
    const { items } = invoiceValues(data(), business, settings)
    expect(items[0]).toEqual({ 'item.no': '1', 'item.deskripsi': 'Termin 1', 'item.qty': '1,5', 'item.harga': 'Rp 1.000', 'item.jumlah': 'Rp 1.500' })
    expect(items[1]!['item.jumlah']).toBe('Rp 7.200.000')
  })
  it('shows partial payments and outstanding', () => {
    const v = invoiceValues(data({}), business, settings).values
    expect(v.sisa).toBe('Rp 7.200.000')
    const d = data(); d.paid = 3000000; d.outstanding = 4200000
    const v2 = invoiceValues(d, business, settings).values
    expect(v2.dibayar).toBe('Rp 3.000.000')
    expect(v2.sisa).toBe('Rp 4.200.000')
  })
})

describe('receiptValues', () => {
  it('matches the built-in receipt wording', () => {
    const v = receiptValues(data(), 12, business)
    expect(v).toMatchObject({
      nomor: 'KW-2026-003-12', 'invoice.nomor': 'INV-2026-003', 'klien.nama': 'CV Maju & Jaya', nominal: 'Rp 6.000.000',
      terbilang: 'Enam juta rupiah', untuk: 'DP · POS Resto (INV-2026-003)', tanggal: '17 November 2026', metode: 'Transfer bank',
      status_invoice: 'Sisa tagihan Rp 7.200.000', tempat_tanggal: 'Jl. Raya 1, 17 November 2026',
    })
  })
  it('throws when the payment does not belong to the invoice', () => {
    expect(() => receiptValues(data(), 999, business)).toThrow()
  })
})

describe('docFrameValues', () => {
  it('maps the render context', () => {
    const v = docFrameValues({ business, footer: 'OCN · DOC-1', docNumber: 'DOC-1', title: 'Kontrak Kerja', clientName: 'CV Maju & Jaya' } as any, 'POS Resto')
    expect(v).toMatchObject({ judul: 'Kontrak Kerja', nomor: 'DOC-1', 'proyek.nama': 'POS Resto', 'klien.nama': 'CV Maju & Jaya', footer: 'OCN · DOC-1', 'usaha.nama': 'OCN Development' })
  })
})

describe('terbilang (shared)', () => {
  it('spells amounts in Indonesian', () => {
    expect(terbilang(6000000)).toBe('Enam juta')
    expect(terbilang(0)).toBe('nol')
  })
})
