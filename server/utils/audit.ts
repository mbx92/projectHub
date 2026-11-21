/** Jejak audit untuk termin, pembayaran, pengeluaran, skema, dan distribusi. */
export async function logAudit(
  db: DB | Tx,
  userId: number | null,
  action: 'buat' | 'ubah' | 'hapus' | 'arsip' | string,
  entity: string,
  entityId: number | null,
  before: unknown,
  after: unknown,
) {
  await db.insert(schema.auditLogs).values({
    userId, action, entity, entityId,
    before: before === undefined ? null : JSON.parse(JSON.stringify(before)),
    after: after === undefined ? null : JSON.parse(JSON.stringify(after)),
    createdBy: userId,
  })
}
