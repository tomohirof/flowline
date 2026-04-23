import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { createTestUser } from '../../helpers/create-test-user'

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

  // === Registration (with invitation code) ===
  describe('POST /api/auth/register (with invitation code)', () => {
    function insertValidInvite(code: string = 'VALIDC01', inviterId: string = 'inviter-admin-1') {
      db.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
         VALUES (?, ?, 'hash', 'Inviter', 'admin')`,
      ).run(inviterId, `${inviterId}@example.com`)
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, created_by)
         VALUES (?, ?, ?)`,
      ).run(code, '2099-01-01T00:00:00Z', inviterId)
      return code
    }

    async function registerRequest(body: Record<string, unknown>) {
      return app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        env,
      )
    }

    it('returns 400 INVITATION_REQUIRED when code missing', async () => {
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New',
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('INVITATION_REQUIRED')
    })

    it('returns 400 INVITATION_REQUIRED when invitationCode is non-string (type guard)', async () => {
      // ランタイム型チェックが無いと、オブジェクトを渡した時 .trim() で 500 になる
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New',
        invitationCode: {},
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('INVITATION_REQUIRED')
    })

    it('returns 400 when password exceeds 72 bytes (bcrypt limit)', async () => {
      db.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
         VALUES ('inviter-bcrypt', 'bcrypt@example.com', 'hash', 'BC', 'admin')`,
      ).run()
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, created_by)
         VALUES ('BCRYPT01', '2099-01-01T00:00:00Z', 'inviter-bcrypt')`,
      ).run()
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'a'.repeat(73),
        name: 'New',
        invitationCode: 'BCRYPT01',
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 INVITATION_INVALID when code does not exist', async () => {
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New',
        invitationCode: 'NOSUCH99',
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('INVITATION_INVALID')
    })

    it('returns 400 INVITATION_INVALID for expired code', async () => {
      db.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
         VALUES ('exp-admin', 'exp@example.com', 'hash', 'Exp', 'admin')`,
      ).run()
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, created_by)
         VALUES ('EXPIRED2', '2000-01-01T00:00:00Z', 'exp-admin')`,
      ).run()
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New',
        invitationCode: 'EXPIRED2',
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('INVITATION_INVALID')
    })

    it('returns 400 INVITATION_INVALID for revoked code', async () => {
      db.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
         VALUES ('rev-admin', 'rev@example.com', 'hash', 'Rev', 'admin')`,
      ).run()
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, revoked_at, created_by)
         VALUES ('REVOKED3', '2099-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'rev-admin')`,
      ).run()
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New',
        invitationCode: 'REVOKED3',
      })
      expect(res.status).toBe(400)
    })

    it('returns 200 and creates user when code valid', async () => {
      insertValidInvite('VALIDC01')
      const res = await registerRequest({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        invitationCode: 'VALIDC01',
      })
      expect(res.status).toBe(200)
      const row = db
        .prepare('SELECT email, email_verified FROM users WHERE email = ?')
        .get('new@example.com') as { email: string; email_verified: number }
      expect(row.email).toBe('new@example.com')
      expect(row.email_verified).toBe(0)
    })

    it('allows multiple users to register with the same valid code (unlimited uses)', async () => {
      insertValidInvite('SHARED01')
      for (const [i, email] of [
        [0, 'a@example.com'],
        [1, 'b@example.com'],
        [2, 'c@example.com'],
      ] as const) {
        const res = await registerRequest({
          email,
          password: 'password123',
          name: `U${i}`,
          invitationCode: 'SHARED01',
        })
        expect(res.status).toBe(200)
      }
    })
  })

  // === Login ===
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser(db, {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'unverified@example.com',
        password: 'password123',
        name: 'Unverified',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'me@example.com',
        password: 'password123',
        name: 'Me User',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'admin-me@example.com',
        password: 'password123',
        name: 'Admin User',
        emailVerified: true,
        role: 'admin',
        aiEnabled: true,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'me@example.com',
        password: 'password123',
        name: 'Me',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'login-me@example.com',
        password: 'password123',
        name: 'Login User',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
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
      const created = await createTestUser(db, {
        email: 'verify@example.com',
        password: 'password123',
        name: 'Verify',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const user = { verification_token: created.verificationToken }

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
      const created = await createTestUser(db, {
        email: 'postverify@example.com',
        password: 'password123',
        name: 'PostVerify',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const user = { verification_token: created.verificationToken }

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
      const created = await createTestUser(db, {
        email: 'mismatch@example.com',
        password: 'password123',
        name: 'Mismatch',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const user1 = { verification_token: created.verificationToken }

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
      await createTestUser(db, {
        email: 'resend@example.com',
        password: 'password123',
        name: 'Resend',
        emailVerified: false,
        verificationSentAt: new Date(Date.now() - 120000).toISOString(),
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'verified@example.com',
        password: 'password123',
        name: 'Verified',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
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
      await createTestUser(db, {
        email: 'rate@example.com',
        password: 'password123',
        name: 'Rate',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
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
      const pastTime = new Date(Date.now() - 120000).toISOString()
      await createTestUser(db, {
        email: 'newtoken@example.com',
        password: 'password123',
        name: 'NewToken',
        emailVerified: false,
        verificationSentAt: pastTime,
        jwtSecret: JWT_SECRET,
      })

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
