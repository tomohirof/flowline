import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verifyToken } from '../lib/jwt'
import type { Bindings } from '../app'

type AuthEnv = {
  Bindings: Bindings
  Variables: { userId: string }
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, 'auth_token')
  if (!token) {
    return c.json({ error: '認証が必要です' }, 401)
  }
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET)
    c.set('userId', payload.sub)
    await next()
  } catch {
    return c.json({ error: '認証が必要です' }, 401)
  }
})
