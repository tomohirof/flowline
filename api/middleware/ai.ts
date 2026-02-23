import { createMiddleware } from 'hono/factory'
import type { AuthEnv } from '../app'

export const aiMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const userId = c.get('userId')
  const user = await c.env.FLOWLINE_DB.prepare(
    'SELECT ai_enabled FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ ai_enabled: number }>()
  if (!user || user.ai_enabled !== 1) {
    return c.json({ error: 'AI機能が有効化されていません' }, 403)
  }
  await next()
})
