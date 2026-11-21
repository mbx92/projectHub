/** Proyek baru wajib punya termin & nilai kontrak, jadi butuh akses kelola Proyek dan Keuangan. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  if (!can(me, 'keuangan', 'kelola')) throw createError({ statusCode: 403, statusMessage: 'Membuat proyek butuh akses kelola Keuangan (nilai kontrak & termin).' })
  const input = await readBodyWith(event, projectInputSchema)
  const { id, newMemberIds } = await saveProject(me, input)
  await notifyUsers(newMemberIds, { type: 'bug_ditugaskan', title: `Anda ditambahkan ke proyek ${input.name}`, body: 'Anda sekarang bisa melihat proyek dan bug yang ditugaskan.', link: `/projects/${id}`, email: false }, me.id)
  return { id }
})
