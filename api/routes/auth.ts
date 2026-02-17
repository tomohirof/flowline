import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { hashPassword, verifyPassword } from '../lib/password'
import { createToken } from '../lib/jwt'
import { generateId } from '../lib/id'
import { authMiddleware } from '../middleware/auth'
import type { AuthEnv } from '../app'

const auth = new Hono<AuthEnv>()

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getCookieOptions(c: { req: { url: string } }) {
  const isSecure = new URL(c.req.url).protocol === 'https:'
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }
}

auth.post('/register', async (c) => {
  let body: { email?: string; password?: string; name?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.email || !isValidEmail(body.email)) {
    return c.json({ error: 'メールアドレスの形式が正しくありません' }, 400)
  }
  body.email = body.email.toLowerCase()

  if (!body.password || body.password.length < 8) {
    return c.json({ error: 'パスワードは8文字以上で入力してください' }, 400)
  }
  if (body.password.length > 72) {
    return c.json({ error: 'パスワードは72文字以内で入力してください' }, 400)
  }
  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: '名前を入力してください' }, 400)
  }

  const existing = await c.env.FLOWLINE_DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email)
    .first()

  if (existing) {
    return c.json({ error: 'メールアドレスは既に登録されています' }, 400)
  }

  const id = generateId()
  const passwordHash = await hashPassword(body.password)

  await c.env.FLOWLINE_DB.prepare(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
  )
    .bind(id, body.email, passwordHash, body.name.trim())
    .run()

  const token = await createToken(id, body.email, c.env.JWT_SECRET)
  setCookie(c, 'auth_token', token, getCookieOptions(c))

  return c.json({ user: { id, email: body.email, name: body.name.trim() } }, 201)
})

auth.post('/login', async (c) => {
  let body: { email?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.email || !body.password) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }
  body.email = body.email.toLowerCase()

  const user = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?',
  )
    .bind(body.email)
    .first<{ id: string; email: string; password_hash: string; name: string }>()

  if (!user) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  const valid = await verifyPassword(body.password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  const token = await createToken(user.id, user.email, c.env.JWT_SECRET)
  setCookie(c, 'auth_token', token, getCookieOptions(c))

  return c.json({ user: { id: user.id, email: user.email, name: user.name } })
})

auth.post('/logout', (c) => {
  const opts = getCookieOptions(c)
  deleteCookie(c, 'auth_token', { path: opts.path, secure: opts.secure, sameSite: opts.sameSite })
  return c.json({ message: 'ログアウトしました' })
})

auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const user = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ id: string; email: string; name: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  return c.json({ user })
})

export { auth }
