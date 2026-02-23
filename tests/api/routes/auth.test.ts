import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

const JWT_SECRET = 'test-secret-key-for-auth-tests'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return { FLOWLINE_DB: createMockD1(sqliteDb), JWT_SECRET, RESEND_API_KEY: '' }
}

function postJson(path: string, body: object, env: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  return app.request(
    path,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    env,
  )
}

function getWithCookie(path: string, env: object, cookie: string) {
  return app.request(
    path,
    {
      headers: { Cookie: cookie },
    },
    env,
  )
}

function extractCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/auth_token=([^;]+)/)
  return match ? `auth_token=${match[1]}` : ''
}

describe('Auth API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
  })

  afterEach(() => {
    db.close()
  })

  // === Registration ===
  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201 with message', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
        env,
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.message).toContain('確認メール')
      expect(body.user).toBeUndefined()
    })

    it('should NOT set auth_token cookie on registration', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      const cookie = res.headers.get('set-cookie')
      expect(cookie).toBeNull()
    })

    it('should store hashed password in DB, not plain text', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      const user = db
        .prepare('SELECT password_hash FROM users WHERE email = ?')
        .get('test@example.com') as { password_hash: string }
      expect(user.password_hash).not.toBe('password123')
      expect(user.password_hash).toMatch(/^\$2[aby]?\$/)
    })

    it('should store email_verified=0 in DB after registration', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'test@example.com', password: 'password123', name: 'Test' },
        env,
      )
      const user = db
        .prepare('SELECT email_verified FROM users WHERE email = ?')
        .get('test@example.com') as { email_verified: number }
      expect(user.email_verified).toBe(0)
    })

    it('should store verification_token in DB after registration', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'test@example.com', password: 'password123', name: 'Test' },
        env,
      )
      const user = db
        .prepare('SELECT verification_token FROM users WHERE email = ?')
        .get('test@example.com') as { verification_token: string }
      expect(user.verification_token).toBeTruthy()
    })

    it('should return 400 for invalid email', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'invalid',
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for empty email', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: '',
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing email field', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for short password', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: '1234567',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('8文字以上')
    })

    it('should return 400 for password exceeding 72 characters', async () => {
      const longPassword = 'a'.repeat(73)
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: longPassword,
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('72文字以内')
    })

    it('should accept password with exactly 72 characters', async () => {
      const maxPassword = 'a'.repeat(72)
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: maxPassword,
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(201)
    })

    it('should return 400 for empty password', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: '',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing password field', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for empty name', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: '',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for whitespace-only name', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: '   ',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing name field', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for duplicate email', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'dup@example.com',
          password: 'password123',
          name: 'First',
        },
        env,
      )
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'dup@example.com',
          password: 'password456',
          name: 'Second',
        },
        env,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('既に登録')
    })

    it('should trim name whitespace in DB', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: '  Test User  ',
        },
        env,
      )
      const user = db.prepare('SELECT name FROM users WHERE email = ?').get('test@example.com') as {
        name: string
      }
      expect(user.name).toBe('Test User')
    })

    it('should not include password_hash in response', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        },
        env,
      )
      const body = await res.json()
      expect(body.password_hash).toBeUndefined()
    })

    it('should accept exactly 8 character password', async () => {
      const res = await postJson(
        '/api/auth/register',
        {
          email: 'test@example.com',
          password: '12345678',
          name: 'Test',
        },
        env,
      )
      expect(res.status).toBe(201)
    })

    it('should return 400 for malformed JSON body', async () => {
      const res = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })
  })

  // === Login ===
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing',
        },
        env,
      )
      // メール認証済みに設定
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('existing@example.com')
    })

    it('should login with correct credentials', async () => {
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'existing@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('existing@example.com')
    })

    it('should set auth_token cookie on login', async () => {
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'existing@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.headers.get('set-cookie')).toContain('auth_token=')
    })

    it('should return 401 for wrong password', async () => {
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'existing@example.com',
          password: 'wrongpassword',
        },
        env,
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toContain('正しくありません')
    })

    it('should return 401 for non-existent email', async () => {
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.status).toBe(401)
    })

    it('should return same error for wrong email and wrong password', async () => {
      const res1 = await postJson(
        '/api/auth/login',
        {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
        env,
      )
      const res2 = await postJson(
        '/api/auth/login',
        {
          email: 'existing@example.com',
          password: 'wrongpassword',
        },
        env,
      )
      const body1 = await res1.json()
      const body2 = await res2.json()
      expect(body1.error).toBe(body2.error)
    })

    it('should return 401 for missing password', async () => {
      const res = await postJson('/api/auth/login', { email: 'test@example.com' }, env)
      expect(res.status).toBe(401)
    })

    it('should return 401 for missing email', async () => {
      const res = await postJson('/api/auth/login', { password: 'password123' }, env)
      expect(res.status).toBe(401)
    })

    it('should return 401 for empty body', async () => {
      const res = await postJson('/api/auth/login', {}, env)
      expect(res.status).toBe(401)
    })

    it('should not include password_hash in response', async () => {
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'existing@example.com',
          password: 'password123',
        },
        env,
      )
      const body = await res.json()
      expect(body.user.password_hash).toBeUndefined()
    })

    it('should return 400 for malformed JSON body', async () => {
      const res = await app.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 403 for unverified user', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'unverified@example.com',
          password: 'password123',
          name: 'Unverified',
        },
        env,
      )
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'unverified@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('メール認証')
    })
  })

  // === Logout ===
  describe('POST /api/auth/logout', () => {
    it('should clear auth_token cookie', async () => {
      const res = await postJson('/api/auth/logout', {}, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('ログアウトしました')
      const cookie = res.headers.get('set-cookie')
      expect(cookie).toContain('auth_token=')
    })

    it('should return 200 even without existing session', async () => {
      const res = await postJson('/api/auth/logout', {}, env)
      expect(res.status).toBe(200)
    })
  })

  // === Me ===
  describe('GET /api/auth/me', () => {
    it('should return 401 without auth cookie', async () => {
      const res = await app.request('/api/auth/me', {}, env)
      expect(res.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const res = await getWithCookie('/api/auth/me', env, 'auth_token=invalid.token.here')
      expect(res.status).toBe(401)
    })

    it('should return user info with valid auth cookie', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'me@example.com',
          password: 'password123',
          name: 'Me User',
        },
        env,
      )
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('me@example.com')
      const loginRes = await postJson(
        '/api/auth/login',
        {
          email: 'me@example.com',
          password: 'password123',
        },
        env,
      )
      const cookie = extractCookie(loginRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('me@example.com')
      expect(body.user.name).toBe('Me User')
      expect(body.user.role).toBe('user')
      expect(body.user.aiEnabled).toBe(false)
    })

    it('should return role and aiEnabled for admin user with AI enabled', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'admin-me@example.com',
          password: 'password123',
          name: 'Admin User',
        },
        env,
      )
      db.prepare('UPDATE users SET email_verified = 1, role = ?, ai_enabled = ? WHERE email = ?').run(
        'admin',
        1,
        'admin-me@example.com',
      )
      const loginRes = await postJson(
        '/api/auth/login',
        {
          email: 'admin-me@example.com',
          password: 'password123',
        },
        env,
      )
      const cookie = extractCookie(loginRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.role).toBe('admin')
      expect(body.user.aiEnabled).toBe(true)
    })

    it('should not include password_hash in me response', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'me@example.com',
          password: 'password123',
          name: 'Me',
        },
        env,
      )
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('me@example.com')
      const loginRes = await postJson(
        '/api/auth/login',
        {
          email: 'me@example.com',
          password: 'password123',
        },
        env,
      )
      const cookie = extractCookie(loginRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      const body = await res.json()
      expect(body.user.password_hash).toBeUndefined()
    })

    it('should return 401 with expired or tampered token', async () => {
      // A structurally valid but wrong-secret JWT
      const res = await getWithCookie(
        '/api/auth/me',
        env,
        'auth_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0Iiwic3ViIjoiZmFrZSJ9.fakesignature',
      )
      expect(res.status).toBe(401)
    })

    it('should work with login-generated token too', async () => {
      // Register first
      await postJson(
        '/api/auth/register',
        {
          email: 'login-me@example.com',
          password: 'password123',
          name: 'Login User',
        },
        env,
      )
      // Mark as verified
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('login-me@example.com')
      // Login to get a new token
      const loginRes = await postJson(
        '/api/auth/login',
        {
          email: 'login-me@example.com',
          password: 'password123',
        },
        env,
      )
      const cookie = extractCookie(loginRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('login-me@example.com')
    })
  })

  // === Verify ===
  describe('GET /api/auth/verify', () => {
    it('should verify email with valid token and set auth cookie', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'verify@example.com', password: 'password123', name: 'Verify' },
        env,
      )
      const user = db
        .prepare('SELECT verification_token FROM users WHERE email = ?')
        .get('verify@example.com') as { verification_token: string }

      const res = await app.request(`/api/auth/verify?token=${user.verification_token}`, {}, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.verified).toBe(true)
      expect(body.user.email).toBe('verify@example.com')
      expect(body.user.name).toBe('Verify')

      const updated = db
        .prepare('SELECT email_verified, verification_token FROM users WHERE email = ?')
        .get('verify@example.com') as { email_verified: number; verification_token: string | null }
      expect(updated.email_verified).toBe(1)
      expect(updated.verification_token).toBeNull()

      expect(res.headers.get('set-cookie')).toContain('auth_token=')
    })

    it('should return 400 for invalid token', async () => {
      const res = await app.request('/api/auth/verify?token=invalid-token', {}, env)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('無効')
    })

    it('should return 400 when token is missing', async () => {
      const res = await app.request('/api/auth/verify', {}, env)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('トークン')
    })

    it('should return 400 for empty token query parameter', async () => {
      const res = await app.request('/api/auth/verify?token=', {}, env)
      expect(res.status).toBe(400)
    })

    it('should allow login after verification', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'postverify@example.com', password: 'password123', name: 'PostVerify' },
        env,
      )
      const user = db
        .prepare('SELECT verification_token FROM users WHERE email = ?')
        .get('postverify@example.com') as { verification_token: string }

      await app.request(`/api/auth/verify?token=${user.verification_token}`, {}, env)

      const loginRes = await postJson(
        '/api/auth/login',
        { email: 'postverify@example.com', password: 'password123' },
        env,
      )
      expect(loginRes.status).toBe(200)
      const body = await loginRes.json()
      expect(body.user.email).toBe('postverify@example.com')
    })

    it('should return 400 for token with non-existent user', async () => {
      // Create a verification token for a non-existent user
      const { createVerificationToken } = await import('../../../api/lib/jwt')
      const fakeToken = await createVerificationToken('non-existent-id', JWT_SECRET)
      const res = await app.request(`/api/auth/verify?token=${fakeToken}`, {}, env)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('無効')
    })

    it('should return 400 when token does not match DB', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'mismatch@example.com', password: 'password123', name: 'Mismatch' },
        env,
      )
      const user1 = db
        .prepare('SELECT verification_token FROM users WHERE email = ?')
        .get('mismatch@example.com') as { verification_token: string }

      // DBのトークンを別の値に変更（resend相当）
      db.prepare('UPDATE users SET verification_token = ? WHERE email = ?').run(
        'different-token-value',
        'mismatch@example.com',
      )

      // 古いトークンはDB照合で弾かれる
      const res = await app.request(`/api/auth/verify?token=${user1.verification_token}`, {}, env)
      expect(res.status).toBe(400)
    })
  })

  // === Resend Verification ===
  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email for unverified user', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'resend@example.com', password: 'password123', name: 'Resend' },
        env,
      )
      // verification_sent_at を過去に設定（レート制限回避）
      db.prepare('UPDATE users SET verification_sent_at = ? WHERE email = ?').run(
        new Date(Date.now() - 120000).toISOString(),
        'resend@example.com',
      )
      const res = await postJson(
        '/api/auth/resend-verification',
        { email: 'resend@example.com' },
        env,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('再送')
    })

    it('should return 200 for non-existent email (prevent info leak)', async () => {
      const res = await postJson(
        '/api/auth/resend-verification',
        { email: 'nonexistent@example.com' },
        env,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('再送')
    })

    it('should return 200 for already verified user (prevent info leak)', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'verified@example.com', password: 'password123', name: 'Verified' },
        env,
      )
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('verified@example.com')
      const res = await postJson(
        '/api/auth/resend-verification',
        { email: 'verified@example.com' },
        env,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('再送')
    })

    it('should return 429 for rate-limited resend within 60 seconds', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'rate@example.com', password: 'password123', name: 'Rate' },
        env,
      )
      const res = await postJson(
        '/api/auth/resend-verification',
        { email: 'rate@example.com' },
        env,
      )
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toContain('60秒')
    })

    it('should update verification_token and verification_sent_at on resend', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'newtoken@example.com', password: 'password123', name: 'NewToken' },
        env,
      )

      const pastTime = new Date(Date.now() - 120000).toISOString()
      // レート制限回避 + 古いsent_atを設定
      db.prepare('UPDATE users SET verification_sent_at = ? WHERE email = ?').run(
        pastTime,
        'newtoken@example.com',
      )

      await postJson('/api/auth/resend-verification', { email: 'newtoken@example.com' }, env)
      const after = db
        .prepare('SELECT verification_sent_at FROM users WHERE email = ?')
        .get('newtoken@example.com') as { verification_sent_at: string }

      // verification_sent_at が更新されていることを確認
      expect(after.verification_sent_at).not.toBe(pastTime)
    })

    it('should return 200 for missing email field', async () => {
      const res = await postJson('/api/auth/resend-verification', {}, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toContain('再送')
    })

    it('should return 400 for malformed JSON body', async () => {
      const res = await app.request(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })
  })
})
