/** Buat dokumen proyek otomatis (BAST, Laporan UAT) dari data sistem; tersimpan sebagai Draf yang bisa diedit di aplikasi. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'kelola')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const body = await readBodyWith(event, z.object({ type: z.enum(GENERATABLE_DOCS) }))
  const { row, projectName } = await generateProjectDoc(id, body.type, me.id)
  await notifyUsers(await projectTeamIds(id), { type: 'dokumen_baru', title: `Dokumen baru di ${projectName}`, body: `${row.name} (${body.type})`, link: `/projects/${id}`, email: false }, me.id)
  return { id: row.id, name: row.name }
})
