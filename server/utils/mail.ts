import nodemailer, { type Transporter } from 'nodemailer'

let transporter: Transporter | null | undefined

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter
  const c = useRuntimeConfig()
  if (!c.smtpHost) {
    transporter = null
    return null
  }
  transporter = nodemailer.createTransport({
    host: c.smtpHost,
    port: Number(c.smtpPort || 587),
    secure: Number(c.smtpPort) === 465,
    auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass } : undefined,
  })
  return transporter
}

export interface MailInput {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: { filename: string, content: Buffer, contentType?: string }[]
}

/** Kirim email lewat SMTP. Bila SMTP belum diatur (dev), isi email dicetak ke log server. */
export async function sendMail(input: MailInput): Promise<{ sent: boolean }> {
  const t = getTransport()
  if (!t) {
    console.info(`\n[email:dev] Ke: ${input.to}\nSubjek: ${input.subject}\n${input.text}\n${input.attachments?.length ? `(lampiran: ${input.attachments.map(a => a.filename).join(', ')})\n` : ''}`)
    return { sent: false }
  }
  await t.sendMail({ from: useRuntimeConfig().smtpFrom, ...input })
  return { sent: true }
}

export function mailLayout(title: string, bodyHtml: string, cta?: { label: string, url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F5F6F8;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#101828">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="display:inline-block;background:#0B6E63;color:#fff;font-weight:700;font-size:12px;border-radius:8px;padding:8px 10px">OCN</div>
<div style="background:#fff;border:1px solid #E4E7EC;border-radius:12px;padding:24px;margin-top:16px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<div style="font-size:14px;line-height:1.6;color:#344054">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="background:#0B6E63;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px;display:inline-block">${cta.label}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#475467;margin-top:16px">OCN Project Hub · email otomatis, mohon tidak dibalas.</p>
</div></body></html>`
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}
