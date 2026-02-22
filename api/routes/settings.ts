import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../lib/password'
import type { AuthEnv } from '../app'

const DEFAULT_SETTINGS = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  doubleClickToEdit: true,
  defaultArrowStyle: 'solid',
  defaultArrowColor: 'default',
  showDotGrid: true,
  showOrderBadge: true,
  showLaneColorBar: true,
  defaultTheme: 'cloud',
  language: 'ja',
  notifications: true,
}

const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_SETTINGS))

const settings = new Hono<AuthEnv>()

settings.use('*', authMiddleware)

// =============================================
// GET / - Get settings + profile
// =============================================

settings.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  const user = await db
    .prepare('SELECT id, email, name, settings FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string; settings: string | null }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  let userSettings: Record<string, unknown> = {}
  try {
    userSettings = user.settings ? JSON.parse(user.settings) : {}
  } catch {
    userSettings = {}
  }

  const mergedSettings = { ...DEFAULT_SETTINGS, ...userSettings }

  return c.json({
    settings: mergedSettings,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  })
})

// =============================================
// PUT / - Update settings
// =============================================

settings.put('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  // Filter to allowed keys only
  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (ALLOWED_KEYS.has(key)) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: '更新する設定がありません' }, 400)
  }

  // Get current settings
  const user = await db
    .prepare('SELECT settings FROM users WHERE id = ?')
    .bind(userId)
    .first<{ settings: string | null }>()

  let currentSettings: Record<string, unknown> = {}
  try {
    currentSettings = user?.settings ? JSON.parse(user.settings) : {}
  } catch {
    currentSettings = {}
  }

  // Merge
  const newSettings = { ...currentSettings, ...updates }

  await db
    .prepare('UPDATE users SET settings = ? WHERE id = ?')
    .bind(JSON.stringify(newSettings), userId)
    .run()

  const mergedSettings = { ...DEFAULT_SETTINGS, ...newSettings }

  return c.json({ settings: mergedSettings })
})

// =============================================
// PUT /profile - Update user name
// =============================================

settings.put('/profile', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  let body: { name?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: '名前を入力してください' }, 400)
  }

  const trimmedName = body.name.trim()

  await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(trimmedName, userId).run()

  return c.json({
    profile: {
      name: trimmedName,
    },
  })
})

// =============================================
// PUT /password - Change password
// =============================================

settings.put('/password', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.currentPassword) {
    return c.json({ error: '現在のパスワードを入力してください' }, 400)
  }

  if (!body.newPassword || body.newPassword.length < 8) {
    return c.json({ error: '新しいパスワードは8文字以上で入力してください' }, 400)
  }

  const user = await db
    .prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; password_hash: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  const valid = await verifyPassword(body.currentPassword, user.password_hash)
  if (!valid) {
    return c.json({ error: '現在のパスワードが正しくありません' }, 400)
  }

  const newHash = await hashPassword(body.newPassword)
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, userId).run()

  return c.json({ message: 'パスワードを変更しました' })
})

// =============================================
// DELETE /account - Delete user and all their data
// =============================================

settings.delete('/account', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  const user = await db
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  // Get all flow IDs for the user
  const flowsResult = await db
    .prepare('SELECT id FROM flows WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string }>()

  const flowIds = (flowsResult.results ?? []).map((f) => f.id)

  // Delete all related data
  const statements: Array<ReturnType<typeof db.prepare>> = []

  for (const flowId of flowIds) {
    statements.push(db.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId))
    statements.push(db.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId))
    statements.push(db.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId))
  }

  statements.push(db.prepare('DELETE FROM flows WHERE user_id = ?').bind(userId))
  statements.push(db.prepare('DELETE FROM users WHERE id = ?').bind(userId))

  await db.batch(statements)

  return c.json({ message: 'アカウントを削除しました' })
})

export { settings }
