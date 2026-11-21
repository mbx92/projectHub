const ROLE_TEXT: Record<Role, string> = {
  admin: 'Admin — mengelola semua proyek, keuangan, bug, dan investor.',
  investor: 'Investor — melihat Dashboard Investor, modal, dan laporan bulanan.',
  developer: 'Developer — melihat proyek dan bug yang ditugaskan.',
}

export async function sendInvite(user: { id: number, name: string, email: string, role: Role }, invitedBy: SessionUser) {
  const token = await issueUserToken(user.id, 'undangan', invitedBy.id)
  const url = `${useRuntimeConfig().appUrl}/invite?token=${token}`
  await sendMail({
    to: user.email,
    subject: `${invitedBy.name} mengundang Anda ke OCN Project Hub`,
    text: `Halo ${user.name},\n\n${invitedBy.name} mengundang Anda sebagai ${ROLE_TEXT[user.role]}\n\nBuat kata sandi lewat tautan berikut (berlaku 7 hari):\n${url}`,
    html: mailLayout('Undangan OCN Project Hub', `Halo ${escapeHtml(user.name)},<br>${escapeHtml(invitedBy.name)} mengundang Anda sebagai <b>${escapeHtml(ROLE_TEXT[user.role])}</b><br>Undangan berlaku 7 hari.`, { label: 'Terima undangan', url }),
  })
  return url
}
