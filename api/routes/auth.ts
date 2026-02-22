import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { hashPassword, verifyPassword } from '../lib/password'
import { createToken, createVerificationToken, verifyVerificationToken } from '../lib/jwt'
import type { VerificationPayload } from '../lib/jwt'
import { sendVerificationEmail } from '../lib/email'
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
  const verificationToken = await createVerificationToken(id, c.env.JWT_SECRET)

  await c.env.FLOWLINE_DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, email_verified, verification_token, verification_sent_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
  )
    .bind(id, body.email, passwordHash, body.name.trim(), verificationToken, new Date().toISOString())
    .run()

  // メール送信（失敗してもユーザー作成は成功させる）
  const baseUrl = new URL(c.req.url).origin
  try {
    if (c.env.RESEND_API_KEY) {
      await sendVerificationEmail(body.email, verificationToken, c.env.RESEND_API_KEY, baseUrl)
    }
  } catch {
    // メール送信失敗はログのみ
  }

  return c.json({ message: '確認メールを送信しました。メールを確認してください。' }, 201)
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
    'SELECT id, email, password_hash, name, email_verified FROM users WHERE email = ?',
  )
    .bind(body.email)
    .first<{ id: string; email: string; password_hash: string; name: string; email_verified: number }>()

  if (!user) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  const valid = await verifyPassword(body.password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  if (user.email_verified === 0) {
    return c.json({ error: 'メール認証が完了していません。メールを確認してください。' }, 403)
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

  const user = await c.env.FLOWLINE_DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; name: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  return c.json({ user })
})

// GET /verify - メール認証
auth.get('/verify', async (c) => {
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: '認証トークンが必要です' }, 400)
  }

  let payload: VerificationPayload
  try {
    payload = await verifyVerificationToken(token, c.env.JWT_SECRET)
  } catch {
    return c.json({ error: '認証トークンが無効または期限切れです' }, 400)
  }

  const user = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?',
  )
    .bind(payload.sub)
    .first<{ id: string; email: string; name: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 400)
  }

  await c.env.FLOWLINE_DB.prepare(
    'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?',
  )
    .bind(user.id)
    .run()

  const authToken = await createToken(user.id, user.email, c.env.JWT_SECRET)
  setCookie(c, 'auth_token', authToken, getCookieOptions(c))

  return c.json({ verified: true, user: { id: user.id, email: user.email, name: user.name } })
})

// POST /resend-verification - 認証メール再送
auth.post('/resend-verification', async (c) => {
  let body: { email?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.email) {
    return c.json({ message: '確認メールを再送しました' })
  }

  const user = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, email_verified, verification_sent_at FROM users WHERE email = ?',
  )
    .bind(body.email.toLowerCase())
    .first<{ id: string; email_verified: number; verification_sent_at: string | null }>()

  if (!user || user.email_verified === 1) {
    return c.json({ message: '確認メールを再送しました' })
  }

  if (user.verification_sent_at) {
    const sentAt = new Date(user.verification_sent_at).getTime()
    if (Date.now() - sentAt < 60_000) {
      return c.json({ error: '再送は60秒後に可能です' }, 429)
    }
  }

  const verificationToken = await createVerificationToken(user.id, c.env.JWT_SECRET)
  await c.env.FLOWLINE_DB.prepare(
    'UPDATE users SET verification_token = ?, verification_sent_at = ? WHERE id = ?',
  )
    .bind(verificationToken, new Date().toISOString(), user.id)
    .run()

  const baseUrl = new URL(c.req.url).origin
  try {
    if (c.env.RESEND_API_KEY) {
      await sendVerificationEmail(body.email.toLowerCase(), verificationToken, c.env.RESEND_API_KEY, baseUrl)
    }
  } catch {
    // メール送信失敗はログのみ
  }

  return c.json({ message: '確認メールを再送しました' })
})

export { auth }
