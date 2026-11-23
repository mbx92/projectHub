/** Penyimpanan template dokumen (SVG Penpot): draf, aktif, validasi, aktivasi. Lihat spek §5.5 / §5.7. */
import type { H3Event } from 'h3'
import type { DocTemplatesSetting, TemplateKind, TemplatePageKey, TemplateRef } from '../../shared/utils/settings'
import { TEMPLATE_KINDS } from '../../shared/utils/settings'
import { sanitizeSvg } from './svgTemplate/sanitize'
import { TemplateError } from './svgTemplate/types'
import { validateTemplate } from './svgTemplate/validate'
import type { Validation } from './svgTemplate/validate'

export const PAGE_KEYS: TemplatePageKey[] = ['halaman-1', 'halaman-lanjutan']

export function kindParam(event: H3Event): TemplateKind {
  const k = getRouterParam(event, 'kind') as TemplateKind
  if (!TEMPLATE_KINDS.includes(k)) throw createError({ statusCode: 404, statusMessage: 'Jenis template tidak dikenal.' })
  return k
}

export async function getTemplates(): Promise<DocTemplatesSetting> {
  const s = await getSetting('docTemplates')
  return { active: s.active ?? {}, draft: s.draft ?? {} }
}

export async function activeTemplate(kind: TemplateKind): Promise<TemplateRef | null> {
  return (await getTemplates()).active[kind] ?? null
}

async function readPages(ref: TemplateRef): Promise<Partial<Record<TemplatePageKey, string>>> {
  const out: Partial<Record<TemplatePageKey, string>> = {}
  for (const p of PAGE_KEYS) {
    const key = ref.pages[p]
    if (key) out[p] = (await readStoredFile(key)).toString('utf8')
  }
  return out
}

/** SVG tiap halaman siap render: `first` = halaman-1, `next` = halaman-lanjutan (bila ada). */
export async function loadTemplatePages(ref: TemplateRef): Promise<{ first: string, next?: string }> {
  const p = await readPages(ref)
  if (!p['halaman-1']) throw new TemplateError('invalid_svg', 'Template tidak memiliki halaman-1.')
  return { first: p['halaman-1'], next: p['halaman-lanjutan'] }
}

export async function validateRef(kind: TemplateKind, ref: TemplateRef): Promise<Validation> {
  return validateTemplate(kind, await readPages(ref))
}

/** Simpan satu artboard ke draf (draf baru dimulai dari salinan template aktif). */
export async function uploadDraftPage(kind: TemplateKind, page: TemplatePageKey, svgText: string, userId: number): Promise<{ ref: TemplateRef, validation: Validation }> {
  const clean = sanitizeSvg(svgText)
  const key = await saveFile('templates', `${kind}-${page}.svg`, Buffer.from(clean, 'utf8'), 'image/svg+xml')
  const cur = await getTemplates()
  const base: TemplateRef = cur.draft[kind] ?? { version: (cur.active[kind]?.version ?? 0) + 1, pages: { ...(cur.active[kind]?.pages ?? {}) }, uploadedAt: '', uploadedBy: userId }
  const ref: TemplateRef = { ...base, pages: { ...base.pages, [page]: key }, uploadedAt: new Date().toISOString(), uploadedBy: userId }
  await setSetting('docTemplates', { ...cur, draft: { ...cur.draft, [kind]: ref } }, userId)
  return { ref, validation: await validateRef(kind, ref) }
}

/** Jadikan draf sebagai template aktif; ditolak bila validasi masih punya error. */
export async function activateDraft(kind: TemplateKind, userId: number): Promise<TemplateRef> {
  const cur = await getTemplates()
  const draft = cur.draft[kind]
  if (!draft) throw createError({ statusCode: 422, statusMessage: 'Belum ada draf template untuk diaktifkan.' })
  const v = await validateRef(kind, draft)
  if (v.errors.length) throw createError({ statusCode: 422, statusMessage: `Template belum bisa diaktifkan: ${v.errors.join(' ')}` })
  const { [kind]: _drop, ...restDraft } = cur.draft
  await setSetting('docTemplates', { active: { ...cur.active, [kind]: draft }, draft: restDraft }, userId)
  return draft
}

/** Kembali ke layout bawaan: hapus template aktif dan draf. File lama tidak dihapus (dokumen beku merujuknya). */
export async function resetKind(kind: TemplateKind, userId: number) {
  const cur = await getTemplates()
  const { [kind]: _a, ...active } = cur.active
  const { [kind]: _d, ...draft } = cur.draft
  await setSetting('docTemplates', { active, draft }, userId)
}
