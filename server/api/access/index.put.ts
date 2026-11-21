/** Simpan matriks hak akses (khusus admin). Berlaku untuk semua pengguna peran tersebut dalam ±30 detik. */
const levelOf = <M extends AccessModule>(m: M) => z.enum(ACCESS_MODULES[m].levels.map(l => l.value) as [AccessLevel<M>, ...AccessLevel<M>[]])

const roleAccessSchema = z.object({
  proyek: levelOf('proyek'),
  dokumen: levelOf('dokumen'),
  keuangan: levelOf('keuangan'),
  bug: levelOf('bug'),
  investor: levelOf('investor'),
  laporan: levelOf('laporan'),
  pengaturan: levelOf('pengaturan'),
  scope: z.enum(['semua', 'ditugaskan', 'didanai']),
})

export default defineEventHandler(async (event) => {
  const me = requireAdmin(event)
  const body = await readBodyWith(event, z.object({ investor: roleAccessSchema, developer: roleAccessSchema }))
  const before = await getAccessMatrix()
  await saveAccessMatrix(body as AccessMatrix, me.id)
  await logAudit(useDB(), me.id, 'ubah', 'access_matrix', null, before, body)
  return { ok: true, matrix: body }
})
