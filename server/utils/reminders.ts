/**
 * Pengingat termin (in-app + email): H-7 dan hari H untuk invoice terkirim, serta termin terjadwal
 * yang jatuh tempo tanpa invoice. Laporan investor bulanan dikirim tiap tanggal 1.
 * Status terkirim dicatat di tabel settings agar tidak terkirim dua kali.
 */
import { eq, sql } from 'drizzle-orm'

const key = (invoiceId: number) => `reminders:${invoiceId}`

export async function setReminderFlag(invoiceId: number, enabled: boolean) {
  const db = useDB()
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key(invoiceId)))
  const value = { sent: [], ...((row?.value as object) || {}), enabled }
  await db.insert(schema.settings).values({ key: key(invoiceId), value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } })
}

async function markOnce(k: string): Promise<boolean> {
  const r = await useDB().execute(sql`insert into settings (kunci, nilai) values (${k}, ${JSON.stringify({ at: new Date().toISOString() })}::jsonb) on conflict do nothing returning kunci`)
  return r.rows.length > 0
}

export async function runReminders() {
  const db = useDB()
  const today = todayISO()
  const in7 = addDays(today, 7)
  const admins = await adminIds()
  const business = await getSetting('business')

  // Invoice terkirim: H-7, hari H, dan terlambat (sekali per tahap).
  const rows = (await db.execute(sql`
    select i.id, i.nomor, i.jatuh_tempo, i.total, i.project_id, p.name as project_name, c.email as client_email, c.name as client_name,
      t.name as term_name, s.nilai as flags,
      coalesce((select sum(nominal) from payments where invoice_id = i.id), 0) as paid
    from invoices i join projects p on p.id = i.project_id left join clients c on c.id = p.client_id
    left join terms t on t.id = i.term_id left join settings s on s.kunci = 'reminders:' || i.id
    where i.status = 'terkirim' and i.jatuh_tempo <= ${in7}`)).rows as any[]

  for (const r of rows) {
    const enabled = r.flags?.enabled !== false
    const stage = r.jatuh_tempo === in7 ? 'h7' : r.jatuh_tempo === today ? 'h0' : r.jatuh_tempo < today ? 'late' : null
    if (!stage) continue
    if (!(await markOnce(`reminder-sent:${r.id}:${stage}`))) continue
    const outstanding = Number(r.total) - Number(r.paid)
    const when = stage === 'h7' ? '7 hari lagi' : stage === 'h0' ? 'hari ini' : `sudah lewat (${dateId(r.jatuh_tempo)})`
    await notifyUsers(admins, {
      type: 'termin_jatuh_tempo',
      title: `${r.term_name ?? r.nomor} ${r.project_name} jatuh tempo ${when}`,
      body: `${r.nomor} · sisa ${rupiah(outstanding)} · jatuh tempo ${dateId(r.jatuh_tempo)}`,
      link: `/invoices/${r.id}`,
    })
    if (enabled && r.client_email && stage !== 'late') {
      await sendMail({
        to: r.client_email,
        subject: `Pengingat pembayaran ${r.nomor}`,
        text: `Yth. ${r.client_name},\n\nIni pengingat bahwa invoice ${r.nomor} sebesar ${rupiah(outstanding)} untuk ${r.project_name} jatuh tempo ${dateId(r.jatuh_tempo)}.\n\nAbaikan bila sudah membayar. Terima kasih,\n${business.name}`,
      }).catch(err => console.error('[reminder] gagal email klien', err))
    }
  }

  // Termin terjadwal tanpa invoice yang jatuh tempo ≤ 7 hari: ingatkan admin untuk menerbitkan invoice.
  const terms = (await db.execute(sql`
    select t.id, t.name, t.jatuh_tempo, t.nominal, p.name as project_name, p.id as project_id
    from terms t join projects p on p.id = t.project_id
    where t.status = 'terjadwal' and not p.diarsipkan and t.jatuh_tempo is not null and t.jatuh_tempo <= ${in7}`)).rows as any[]
  for (const t of terms) {
    const stage = t.jatuh_tempo < today ? 'late' : t.jatuh_tempo === today ? 'h0' : 'h7'
    if (!(await markOnce(`term-reminder:${t.id}:${stage}`))) continue
    await notifyUsers(admins, {
      type: 'termin_jatuh_tempo',
      title: `Termin ${t.name} ${t.project_name} belum ditagih`,
      body: `Jatuh tempo ${dateId(t.jatuh_tempo)} · ${rupiah(Number(t.nominal))}. Terbitkan invoice sekarang.`,
      link: `/invoices/new?term=${t.id}`,
    })
  }

  // Laporan investor bulanan setiap tanggal 1.
  if (today.endsWith('-01') && await markOnce(`monthly-report:${today.slice(0, 7)}`)) {
    const prev = addDays(today, -1).slice(0, 7)
    const investors = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'investor'))
    await notifyUsers([...investors.map(i => i.id), ...admins], {
      type: 'laporan_bulanan',
      title: `Laporan investor ${monthLabel(prev, true)} sudah tersedia`,
      body: 'Unduh laporan modal, arus kas, dan bagi hasil dari halaman Laporan.',
      link: `/reports?period=month:${prev}`,
    })
  }
}
