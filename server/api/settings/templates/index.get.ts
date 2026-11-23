import { TEMPLATE_KINDS } from '../../../../shared/utils/settings'

/** Status template dokumen: aktif, draf, dan hasil validasi draf (atau aktif bila tidak ada draf). */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'pengaturan', 'kelola')
  const t = await getTemplates()
  const kinds = await Promise.all(TEMPLATE_KINDS.map(async (kind) => {
    const target = t.draft[kind] ?? t.active[kind] ?? null
    const validation = target ? await validateRef(kind, target).catch(() => ({ errors: ['Berkas template tidak bisa dibaca dari penyimpanan.'], warnings: [] })) : null
    return { kind, active: t.active[kind] ?? null, draft: t.draft[kind] ?? null, validation }
  }))
  return { kinds }
})
