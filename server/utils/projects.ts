import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { z } from 'zod'

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, 'nama proyek wajib diisi').max(160),
  description: zOptText(4000),
  stack: zOptText(200),
  status: z.enum(['persiapan', 'berjalan', 'tertunda', 'selesai']),
  clientId: zId.nullish().transform(v => v ?? null),
  newClient: clientSchema.nullish(),
  contractValue: zMoney,
  budget: zMoney.default(0),
  startDate: zDate.nullish().transform(v => v ?? null),
  targetDate: zDate.nullish().transform(v => v ?? null),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  picId: zId.nullish().transform(v => v ?? null),
  schemeId: zId.nullish().transform(v => v ?? null),
  capitalPct: zPct,
  workerPct: zPct,
  cashPct: zPct,
  terms: z.array(z.object({
    id: zId.optional(),
    name: z.string().trim().min(1, 'nama termin wajib diisi').max(120),
    percent: zPct,
    conditions: zOptText(300),
    dueDate: zDate.nullish().transform(v => v ?? null),
  })).min(1, 'minimal satu termin'),
  members: z.array(z.object({
    userId: zId,
    roleInProject: zOptText(80),
    payType: z.enum(['bagi_hasil', 'tetap']),
    fixedFee: zMoney.default(0),
    shareWeight: z.coerce.number().int().min(0).max(100).default(1),
  })).default([]),
  milestones: z.array(z.object({
    id: zId.optional(),
    name: z.string().trim().min(1, 'nama milestone wajib diisi').max(160),
    targetDate: zDate.nullish().transform(v => v ?? null),
    status: z.enum(['belum', 'berjalan', 'selesai']).default('belum'),
  })).default([]),
})

export type ProjectInput = z.infer<typeof projectInputSchema>

export function validateProjectInput(input: ProjectInput) {
  const total = percentTotal(input.terms.map(t => t.percent))
  if (Math.abs(total - 100) > 0.001) {
    throw createError({ statusCode: 422, statusMessage: `Total persen termin harus 100% (sekarang ${percent(total)}).` })
  }
  const schemeTotal = input.capitalPct + input.workerPct + input.cashPct
  if (Math.abs(schemeTotal - 100) > 0.01) {
    throw createError({ statusCode: 422, statusMessage: `Total persentase skema bagi hasil harus 100% (sekarang ${percent(schemeTotal)}).` })
  }
  const ids = input.members.map(m => m.userId)
  if (new Set(ids).size !== ids.length) throw createError({ statusCode: 422, statusMessage: 'Anggota tim tidak boleh ganda.' })
}

/** Simpan proyek baru / perubahan proyek beserta termin, tim, milestone dalam satu transaksi. */
export async function saveProject(me: SessionUser, input: ProjectInput, projectId?: number) {
  validateProjectInput(input)
  const db = useDB()
  return db.transaction(async (tx) => {
    let clientId = input.clientId
    if (input.newClient) {
      const [c] = await tx.insert(schema.clients).values({ ...input.newClient, createdBy: me.id }).returning()
      clientId = c!.id
    }
    const values = {
      name: input.name, description: input.description, stack: input.stack, status: input.status, clientId,
      contractValue: input.contractValue, budget: input.budget, startDate: input.startDate, targetDate: input.targetDate,
      progress: input.status === 'selesai' ? 100 : input.progress, picId: input.picId, schemeId: input.schemeId,
      capitalPct: input.capitalPct, workerPct: input.workerPct, cashPct: input.cashPct,
    }

    let id = projectId
    let beforeProject: unknown = null
    if (id) {
      const [before] = await tx.select().from(schema.projects).where(eq(schema.projects.id, id))
      if (!before) notFound('Proyek')
      beforeProject = before
      await tx.update(schema.projects).set(values).where(eq(schema.projects.id, id))
      if (before.capitalPct !== input.capitalPct || before.workerPct !== input.workerPct || before.cashPct !== input.cashPct) {
        await logAudit(tx, me.id, 'ubah', 'project_scheme', id,
          { capitalPct: before.capitalPct, workerPct: before.workerPct, cashPct: before.cashPct },
          { capitalPct: input.capitalPct, workerPct: input.workerPct, cashPct: input.cashPct })
      }
    } else {
      const [row] = await tx.insert(schema.projects).values({ ...values, createdBy: me.id }).returning()
      id = row!.id
    }

    // ── Termin ──
    const existing = await tx.select().from(schema.terms).where(eq(schema.terms.projectId, id))
    const amounts = termAmounts(input.contractValue, input.terms.map(t => t.percent))
    const keepIds = new Set(input.terms.map(t => t.id).filter(Boolean) as number[])
    for (const old of existing) {
      if (!keepIds.has(old.id)) {
        if (old.status !== 'terjadwal') throw createError({ statusCode: 422, statusMessage: `Termin "${old.name}" sudah ditagih sehingga tidak bisa dihapus.` })
        await tx.delete(schema.terms).where(eq(schema.terms.id, old.id))
        await logAudit(tx, me.id, 'hapus', 'term', old.id, old, null)
      }
    }
    for (const [i, t] of input.terms.entries()) {
      const amount = amounts[i]!
      const old = t.id ? existing.find(e => e.id === t.id) : undefined
      if (t.id && !old) throw createError({ statusCode: 422, statusMessage: 'Termin tidak ditemukan di proyek ini.' })
      if (old) {
        if (old.status !== 'terjadwal' && (old.amount !== amount || Number(old.percent) !== t.percent)) {
          throw createError({ statusCode: 422, statusMessage: `Termin "${old.name}" sudah ditagih sehingga nominalnya tidak bisa diubah.` })
        }
        const patch = { name: t.name, percent: t.percent, amount, conditions: t.conditions, dueDate: t.dueDate, sortOrder: i }
        const changed = old.name !== t.name || Number(old.percent) !== t.percent || old.amount !== amount || old.conditions !== t.conditions || old.dueDate !== t.dueDate || old.sortOrder !== i
        if (changed) {
          await tx.update(schema.terms).set(patch).where(eq(schema.terms.id, old.id))
          await logAudit(tx, me.id, 'ubah', 'term', old.id, old, { ...old, ...patch })
        }
      } else {
        const [row] = await tx.insert(schema.terms).values({ projectId: id, name: t.name, percent: t.percent, amount, conditions: t.conditions, dueDate: t.dueDate, sortOrder: i, createdBy: me.id }).returning()
        await logAudit(tx, me.id, 'buat', 'term', row!.id, null, row)
      }
    }

    // ── Tim ──
    const oldMembers = await tx.select().from(schema.projectMembers).where(eq(schema.projectMembers.projectId, id))
    await tx.delete(schema.projectMembers).where(eq(schema.projectMembers.projectId, id))
    if (input.members.length) {
      await tx.insert(schema.projectMembers).values(input.members.map(m => ({ ...m, projectId: id!, createdBy: me.id })))
    }
    const newMemberIds = input.members.map(m => m.userId).filter(uid => !oldMembers.some(o => o.userId === uid))

    // ── Milestone ──
    const oldMs = await tx.select({ id: schema.milestones.id }).from(schema.milestones).where(eq(schema.milestones.projectId, id))
    const keepMs = new Set(input.milestones.map(m => m.id).filter(Boolean) as number[])
    const dropMs = oldMs.filter(m => !keepMs.has(m.id)).map(m => m.id)
    if (dropMs.length) await tx.delete(schema.milestones).where(inArray(schema.milestones.id, dropMs))
    for (const [i, m] of input.milestones.entries()) {
      if (m.id && oldMs.some(o => o.id === m.id)) {
        await tx.update(schema.milestones).set({ name: m.name, targetDate: m.targetDate, status: m.status, sortOrder: i }).where(eq(schema.milestones.id, m.id))
      } else {
        await tx.insert(schema.milestones).values({ projectId: id, name: m.name, targetDate: m.targetDate, status: m.status, sortOrder: i, createdBy: me.id })
      }
    }

    await logAudit(tx, me.id, projectId ? 'ubah' : 'buat', 'project', id, beforeProject, values)
    return { id: id!, newMemberIds }
  })
}

export async function projectMembersOf(projectIds: number[]) {
  if (!projectIds.length) return []
  return useDB().select({
    projectId: schema.projectMembers.projectId, userId: schema.projectMembers.userId, name: schema.users.name,
    avatarColor: schema.users.avatarColor, roleInProject: schema.projectMembers.roleInProject,
    payType: schema.projectMembers.payType, fixedFee: schema.projectMembers.fixedFee, shareWeight: schema.projectMembers.shareWeight,
    role: schema.users.role,
  }).from(schema.projectMembers).innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(inArray(schema.projectMembers.projectId, projectIds)).orderBy(asc(schema.users.name))
}

/** Termin + invoice terakhir + pembayaran, dengan status tampilan (Terlambat). */
export async function termsWithInvoices(projectIds: number[]) {
  if (!projectIds.length) return []
  const db = useDB()
  const terms = await db.select().from(schema.terms).where(inArray(schema.terms.projectId, projectIds)).orderBy(asc(schema.terms.projectId), asc(schema.terms.sortOrder))
  const termIds = terms.map(t => t.id)
  const invs = termIds.length
    ? await db.select().from(schema.invoices).where(and(inArray(schema.invoices.termId, termIds), ne(schema.invoices.status, 'batal')))
    : []
  const invIds = invs.map(i => i.id)
  const pays = invIds.length ? await db.select().from(schema.payments).where(inArray(schema.payments.invoiceId, invIds)).orderBy(asc(schema.payments.date)) : []
  const today = todayISO()
  return terms.map((t) => {
    const inv = invs.filter(i => i.termId === t.id).sort((a, b) => b.id - a.id)[0] ?? null
    const p = inv ? pays.filter(x => x.invoiceId === inv.id) : []
    const paid = p.reduce((a, x) => a + x.amount, 0)
    const due = inv?.dueDate ?? t.dueDate
    return {
      ...t,
      displayStatus: termDisplayStatus(t.status, due, today),
      invoice: inv ? { id: inv.id, number: inv.number, total: inv.total, status: inv.status, dueDate: inv.dueDate, issueDate: inv.issueDate } : null,
      paid,
      paidOn: p.at(-1)?.date ?? null,
      method: p.at(-1)?.method ?? null,
      payments: p,
    }
  })
}
