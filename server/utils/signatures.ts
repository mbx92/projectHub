import { eq } from 'drizzle-orm'
import type { Content } from 'pdfmake/interfaces'

export type SignatureRow = typeof schema.signatureRequests.$inferSelect
export type SignatureStatus = 'menunggu' | 'ditandatangani' | 'dibatalkan' | 'kedaluwarsa'

/** Status tampilan: permintaan yang menunggu tetapi sudah lewat batas waktu dianggap kedaluwarsa. */
export function signatureStatus(r: Pick<SignatureRow, 'status' | 'expiresAt'>): SignatureStatus {
  if (r.status === 'menunggu' && r.expiresAt.getTime() < Date.now()) return 'kedaluwarsa'
  return r.status as SignatureStatus
}

export const signatureLink = (token: string) => `${useRuntimeConfig().appUrl.replace(/\/$/, '')}/tanda-tangan/${token}`

export const signatureContentHash = (title: string, body: string) => sha256(`${title}\n${body}`)

export async function sendSignatureMail(r: SignatureRow, projectName: string, to: string, senderName: string) {
  const url = signatureLink(r.token)
  const business = await getSetting('business')
  return sendMail({
    to,
    subject: `${r.title} — ${projectName}`,
    text: `${senderName} dari ${business.name} meminta persetujuan Anda: ${r.title}.\n\nBuka tautan berikut untuk membaca dan menandatangani:\n${url}\n\nTautan berlaku sampai ${dateLongId(r.expiresAt)}.`,
    html: mailLayout(escapeHtml(r.title), `${escapeHtml(senderName)} dari <b>${escapeHtml(business.name)}</b> meminta persetujuan Anda untuk proyek <b>${escapeHtml(projectName)}</b>.<br>Tautan berlaku sampai ${escapeHtml(dateLongId(r.expiresAt))}.`, { label: 'Baca & tandatangani', url }),
  })
}

/** PDF bukti persetujuan: isi dokumen, tanda tangan klien, tanda tangan usaha, dan jejak (waktu, IP, hash). */
export async function signatureEvidencePdf(r: SignatureRow): Promise<Buffer> {
  const db = useDB()
  const [project] = await db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, r.projectId))
  const business = await getSetting('business')
  const clientSig = await storedImage(r.signatureKey)
  const place = business.address ? `${business.address.split('\n')[0]}, ${dateLongId(r.signedAt)}` : dateLongId(r.signedAt)
  const content: Content[] = [
    await letterhead(business, 'BUKTI PERSETUJUAN', `#${r.id}`),
    { text: r.title, bold: true, fontSize: 14, margin: [0, 0, 0, 4] },
    { text: `Proyek: ${project?.name ?? '—'}`, color: C.muted, margin: [0, 0, 0, 12] },
    { text: r.body, lineHeight: 1.35, margin: [0, 0, 0, 20] },
    {
      columns: [
        { width: '*', stack: [
          { text: 'Disetujui oleh klien,', alignment: 'center', color: C.muted, fontSize: 9 },
          clientSig?.image ? { image: clientSig.image, height: 70, alignment: 'center', margin: [0, 4, 0, 2] } : { text: ' ', margin: [0, 30, 0, 30] },
          { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 230, y2: 0, lineWidth: 0.6, lineColor: C.line }] },
          { text: r.signerName ?? '—', bold: true, alignment: 'center', margin: [0, 3, 0, 0] },
          { text: dateLongId(r.signedAt), alignment: 'center', color: C.muted, fontSize: 9 },
        ] },
        await signatureBlock(business, place),
      ],
      unbreakable: true,
    },
    { text: 'Jejak persetujuan', bold: true, margin: [0, 28, 0, 4], color: C.muted, fontSize: 9 },
    { table: { widths: [110, '*'], body: [
      [{ text: 'Waktu', color: C.muted }, dateTimeId(r.signedAt)],
      [{ text: 'Alamat IP', color: C.muted }, r.signerIp ?? '—'],
      [{ text: 'Perangkat', color: C.muted }, { text: r.signerAgent ?? '—', fontSize: 8 }],
      [{ text: 'Hash isi (SHA-256)', color: C.muted }, { text: r.contentHash ?? '—', fontSize: 7.5 }],
    ] }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => C.line, paddingTop: () => 4, paddingBottom: () => 4 }, fontSize: 9 },
    { text: 'Tanda tangan elektronik ini dibuat melalui tautan pribadi yang dikirim kepada klien dan berfungsi sebagai bukti persetujuan.', color: C.muted, fontSize: 8, margin: [0, 10, 0, 0] },
  ]
  return renderPdf({ content, footer: footer(`${business.name} · Persetujuan #${r.id}`), info: { title: `Persetujuan-${r.id}` } })
}
