/** Kop & footer dokumen proyek: memakai Pengaturan terkini untuk Draf, dan salinan beku untuk dokumen Final. */
export type DocRow = typeof schema.documents.$inferSelect

export interface DocRenderCtx {
  business: DocLayoutSnapshot['business']
  /** Footer dengan variabel sudah terisi. */
  footer: string
  docNumber: string | null
  title: string
  /** Nama pihak klien untuk kolom tanda tangan. */
  clientName: string | null
  /** Nama proyek (penanda {{proyek.nama}} pada bingkai). */
  projectName: string
  /** Template bingkai (draf: template aktif; final: yang dibekukan). Null = layout bawaan. */
  template: TemplateRef | null
}

export async function liveLayout(): Promise<DocLayoutSnapshot> {
  const b = await getSetting('business')
  return {
    business: { name: b.name, npwp: b.npwp, email: b.email, whatsapp: b.whatsapp, address: b.address, logoKey: b.logoKey, signatureKey: b.signatureKey, signerName: b.signerName, signerTitle: b.signerTitle },
    footer: b.docFooter?.trim() || DEFAULT_DOC_FOOTER,
    template: await activeTemplate('dokumen'),
  }
}

function fillFooter(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(nama|nomor|proyek|tanggal)\}/g, (_, k: string) => vars[k] ?? '')
}

export async function docRenderCtx(row: DocRow, projectName: string, clientName: string | null): Promise<DocRenderCtx> {
  const layout = row.status === 'final' && row.layoutSnapshot ? row.layoutSnapshot : await liveLayout()
  return {
    business: layout.business,
    footer: fillFooter(layout.footer, { nama: layout.business.name, nomor: row.docNumber ?? '', proyek: projectName, tanggal: dateLongId(row.createdAt) }),
    docNumber: row.docNumber,
    title: row.name,
    clientName,
    projectName,
    template: layout.template ?? null,
  }
}

export const businessForPdf = (b: DocLayoutSnapshot['business']) => ({ ...b, legalForm: '', timezone: '', docFooter: '' }) as BusinessProfile
