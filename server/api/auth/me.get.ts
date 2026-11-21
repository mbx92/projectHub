export default defineEventHandler(event => ({ user: (event.context.user as SessionUser | null) ?? null }))
