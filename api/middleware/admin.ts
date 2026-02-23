import { createMiddleware } from 'hono/factory'
import type { AuthEnv } from '../app'

export const adminMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: '管理者権限が必要です' }, 403)
  }
  await next()
})
