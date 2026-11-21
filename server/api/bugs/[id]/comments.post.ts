export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'ditugaskan')
  const bug = await loadBugForUser(me, idParam(event))
  const { body } = await readBodyWith(event, z.object({ body: z.string().trim().min(1, 'komentar kosong').max(5000) }))
  const [row] = await useDB().insert(schema.bugComments).values({ bugId: bug.id, userId: me.id, body, kind: 'comment', createdBy: me.id }).returning()
  await notifyUsers([bug.assigneeId, bug.reporterUserId], { type: 'komentar_bug', title: `${me.name} mengomentari ${bug.code}`, body: body.slice(0, 200), link: `/bugs/${bug.id}` }, me.id)
  return row
})
