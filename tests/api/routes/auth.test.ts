import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

const JWT_SECRET = 'test-secret-key-for-auth-tests'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return { FLOWLINE_DB: createMockD1(sqliteDb), JWT_SECRET }
}

function postJson(path: string, body: object, env: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, env)
}

function getWithCookie(path: string, env: object, cookie: string) {
  return app.request(path, {
    headers: { Cookie: cookie },
  }, env)
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
    it('should register a new user and return 201', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: 'Test User',
      }, env)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.user.email).toBe('test@example.com')
      expect(body.user.name).toBe('Test User')
      expect(body.user.id).toBeDefined()
    })

    it('should set auth_token cookie on registration', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: 'Test',
      }, env)
      const cookie = res.headers.get('set-cookie')
      expect(cookie).toContain('auth_token=')
      expect(cookie).toContain('HttpOnly')
    })

    it('should store hashed password in DB, not plain text', async () => {
      await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: 'Test',
      }, env)
      const user = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('test@example.com') as { password_hash: string }
      expect(user.password_hash).not.toBe('password123')
      expect(user.password_hash).toMatch(/^\$2[aby]?\$/)
    })

    it('should return 400 for invalid email', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'invalid', password: 'password123', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for empty email', async () => {
      const res = await postJson('/api/auth/register', {
        email: '', password: 'password123', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing email field', async () => {
      const res = await postJson('/api/auth/register', {
        password: 'password123', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for short password', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: '1234567', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('8文字以上')
    })

    it('should return 400 for empty password', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: '', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing password field', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', name: 'Test',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for empty name', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: '',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for whitespace-only name', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: '   ',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing name field', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123',
      }, env)
      expect(res.status).toBe(400)
    })

    it('should return 400 for duplicate email', async () => {
      await postJson('/api/auth/register', {
        email: 'dup@example.com', password: 'password123', name: 'First',
      }, env)
      const res = await postJson('/api/auth/register', {
        email: 'dup@example.com', password: 'password456', name: 'Second',
      }, env)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('既に登録')
    })

    it('should trim name whitespace', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: '  Test User  ',
      }, env)
      const body = await res.json()
      expect(body.user.name).toBe('Test User')
    })

    it('should not include password_hash in response', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: 'password123', name: 'Test',
      }, env)
      const body = await res.json()
      expect(body.user.password_hash).toBeUndefined()
    })

    it('should accept exactly 8 character password', async () => {
      const res = await postJson('/api/auth/register', {
        email: 'test@example.com', password: '12345678', name: 'Test',
      }, env)
      expect(res.status).toBe(201)
    })

    it('should return 400 for malformed JSON body', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }, env)
      expect(res.status).toBe(400)
    })
  })

  // === Login ===
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await postJson('/api/auth/register', {
        email: 'existing@example.com', password: 'password123', name: 'Existing',
      }, env)
    })

    it('should login with correct credentials', async () => {
      const res = await postJson('/api/auth/login', {
        email: 'existing@example.com', password: 'password123',
      }, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('existing@example.com')
    })

    it('should set auth_token cookie on login', async () => {
      const res = await postJson('/api/auth/login', {
        email: 'existing@example.com', password: 'password123',
      }, env)
      expect(res.headers.get('set-cookie')).toContain('auth_token=')
    })

    it('should return 401 for wrong password', async () => {
      const res = await postJson('/api/auth/login', {
        email: 'existing@example.com', password: 'wrongpassword',
      }, env)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toContain('正しくありません')
    })

    it('should return 401 for non-existent email', async () => {
      const res = await postJson('/api/auth/login', {
        email: 'nonexistent@example.com', password: 'password123',
      }, env)
      expect(res.status).toBe(401)
    })

    it('should return same error for wrong email and wrong password', async () => {
      const res1 = await postJson('/api/auth/login', {
        email: 'nonexistent@example.com', password: 'password123',
      }, env)
      const res2 = await postJson('/api/auth/login', {
        email: 'existing@example.com', password: 'wrongpassword',
      }, env)
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
      const res = await postJson('/api/auth/login', {
        email: 'existing@example.com', password: 'password123',
      }, env)
      const body = await res.json()
      expect(body.user.password_hash).toBeUndefined()
    })

    it('should return 400 for malformed JSON body', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }, env)
      expect(res.status).toBe(400)
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
      const registerRes = await postJson('/api/auth/register', {
        email: 'me@example.com', password: 'password123', name: 'Me User',
      }, env)
      const cookie = extractCookie(registerRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('me@example.com')
      expect(body.user.name).toBe('Me User')
    })

    it('should not include password_hash in me response', async () => {
      const registerRes = await postJson('/api/auth/register', {
        email: 'me@example.com', password: 'password123', name: 'Me',
      }, env)
      const cookie = extractCookie(registerRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      const body = await res.json()
      expect(body.user.password_hash).toBeUndefined()
    })

    it('should return 401 with expired or tampered token', async () => {
      // A structurally valid but wrong-secret JWT
      const res = await getWithCookie('/api/auth/me', env, 'auth_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0Iiwic3ViIjoiZmFrZSJ9.fakesignature')
      expect(res.status).toBe(401)
    })

    it('should work with login-generated token too', async () => {
      // Register first
      await postJson('/api/auth/register', {
        email: 'login-me@example.com', password: 'password123', name: 'Login User',
      }, env)
      // Login to get a new token
      const loginRes = await postJson('/api/auth/login', {
        email: 'login-me@example.com', password: 'password123',
      }, env)
      const cookie = extractCookie(loginRes)

      const res = await getWithCookie('/api/auth/me', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.email).toBe('login-me@example.com')
    })
  })
})
