import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'

const admin = new Hono<AuthEnv>()

admin.use('*', authMiddleware)
admin.use('*', adminMiddleware)

// =============================================
// GET /users - List all users (admin only)
// =============================================

admin.get('/users', async (c) => {
  const db = c.env.FLOWLINE_DB
  const result = await db
    .prepare('SELECT id, email, name, role, ai_enabled, created_at, updated_at FROM users')
    .all<{
      id: string
      email: string
      name: string
      role: string
      ai_enabled: number
      created_at: string
      updated_at: string
    }>()

  const users = (result.results ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    aiEnabled: u.ai_enabled === 1,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }))

  return c.json({ users })
})

// =============================================
// PUT /users/:id - Update user (admin only)
// =============================================

admin.put('/users/:id', async (c) => {
  const db = c.env.FLOWLINE_DB
  const targetUserId = c.req.param('id')

  let body: { role?: string; aiEnabled?: boolean }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (body.role === undefined && body.aiEnabled === undefined) {
    return c.json({ error: '更新するフィールドを指定してください' }, 400)
  }

  // Check user exists
  const existing = await db
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(targetUserId)
    .first<{ id: string }>()

  if (!existing) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  const updateParts: string[] = []
  const updateParams: unknown[] = []

  if (body.role !== undefined) {
    updateParts.push('role = ?')
    updateParams.push(body.role)
  }
  if (body.aiEnabled !== undefined) {
    updateParts.push('ai_enabled = ?')
    updateParams.push(body.aiEnabled ? 1 : 0)
  }

  updateParams.push(targetUserId)

  await db
    .prepare(`UPDATE users SET ${updateParts.join(', ')} WHERE id = ?`)
    .bind(...updateParams)
    .run()

  const updated = await db
    .prepare('SELECT id, email, name, role, ai_enabled FROM users WHERE id = ?')
    .bind(targetUserId)
    .first<{
      id: string
      email: string
      name: string
      role: string
      ai_enabled: number
    }>()

  return c.json({
    user: {
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      role: updated!.role,
      aiEnabled: updated!.ai_enabled === 1,
    },
  })
})

export { admin }
