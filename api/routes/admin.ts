import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import { generateInvitationCode } from '../lib/invitation'

const ALLOWED_ROLES = ['user', 'admin']

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

  // Validate role
  if (body.role !== undefined && !ALLOWED_ROLES.includes(body.role)) {
    return c.json({ error: '無効なroleです' }, 400)
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
  updateParts.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")

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

  if (!updated) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  return c.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      aiEnabled: updated.ai_enabled === 1,
    },
  })
})

// =============================================
// POST /invitations - Create invitation code (admin only)
// =============================================

admin.post('/invitations', async (c) => {
  const db = c.env.FLOWLINE_DB
  const adminId = c.get('userId')
  if (!adminId) return c.json({ error: '認証が必要です' }, 401)

  let body: { expiresInDays?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }
  const days = body.expiresInDays
  if (days === undefined || !Number.isInteger(days) || days < 1 || days > 365) {
    return c.json({ error: 'expiresInDays は 1〜365 の整数で指定してください' }, 400)
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  let code = ''
  let inserted = false
  for (let attempt = 0; attempt < 3; attempt++) {
    code = generateInvitationCode()
    try {
      await db
        .prepare(
          `INSERT INTO invitation_codes (code, expires_at, created_by)
           VALUES (?, ?, ?)`,
        )
        .bind(code, expiresAt, adminId)
        .run()
      inserted = true
      break
    } catch {
      // UNIQUE collision — retry
    }
  }
  if (!inserted) {
    return c.json({ error: '招待コードの生成に失敗しました' }, 500)
  }

  const row = await db
    .prepare(
      `SELECT id, code, expires_at, revoked_at, created_at, created_by
       FROM invitation_codes WHERE code = ?`,
    )
    .bind(code)
    .first<{
      id: number
      code: string
      expires_at: string
      revoked_at: string | null
      created_at: string
      created_by: string
    }>()
  if (!row) return c.json({ error: '招待コードの取得に失敗しました' }, 500)

  return c.json(
    {
      id: row.id,
      code: row.code,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
    },
    201,
  )
})

export { admin }
