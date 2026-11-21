import { eq } from 'drizzle-orm'

/** Selalu menjawab sukses agar tidak membocorkan email mana yang terdaftar. */
export default defineEventHandler(async (event) => {
  const { email } = await readBodyWith(event, z.object({ email: z.string().trim().toLowerCase().email('email tidak valid') }))
  rateLimit(`forgot:${getRequestIP(event, { xForwardedFor: true })}`, 5, 15 * 60_000)
  const [user] = await useDB().select().from(schema.users).where(eq(schema.users.email, email))
  if (user && user.status === 'aktif') {
    const token = await issueUserToken(user.id, 'reset')
    const url = `${useRuntimeConfig().appUrl}/reset-password?token=${token}`
    await sendMail({
      to: user.email,
      subject: 'Atur ulang kata sandi OCN Project Hub',
      text: `Halo ${user.name},\n\nBuka tautan berikut untuk membuat kata sandi baru (berlaku 2 jam):\n${url}\n\nAbaikan email ini bila Anda tidak memintanya.`,
      html: mailLayout('Atur ulang kata sandi', `Halo ${escapeHtml(user.name)},<br>Klik tombol di bawah untuk membuat kata sandi baru. Tautan berlaku 2 jam.<br>Abaikan email ini bila Anda tidak memintanya.`, { label: 'Buat kata sandi baru', url }),
    })
  }
  return { ok: true }
})
