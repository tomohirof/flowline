import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { createToken } from '../../../api/lib/jwt'

const JWT_SECRET = 'test-secret-key'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return { FLOWLINE_DB: createMockD1(sqliteDb), JWT_SECRET }
}

async function authCookie(userId: string, email: string): Promise<string> {
  const token = await createToken(userId, email, JWT_SECRET)
  return `auth_token=${token}`
}

function registerUser(
  db: ReturnType<typeof Database>,
  id: string,
  email: string,
  role: string = 'user',
  aiEnabled: number = 0,
) {
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role, ai_enabled) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, email, 'hash', 'Test User', role, aiEnabled)
}

function getWithCookie(path: string, env: object, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, { headers }, env)
}

function putJson(path: string, body: unknown, env: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  return app.request(
    path,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    },
    env,
  )
}

describe('Admin API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let adminCookie: string
  let userCookie: string

  const ADMIN_ID = 'admin-1'
  const ADMIN_EMAIL = 'admin@example.com'
  const USER_ID = 'user-1'
  const USER_EMAIL = 'user@example.com'
  const USER2_ID = 'user-2'
  const USER2_EMAIL = 'user2@example.com'

  beforeEach(async () => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, ADMIN_ID, ADMIN_EMAIL, 'admin', 1)
    registerUser(db, USER_ID, USER_EMAIL, 'user', 0)
    registerUser(db, USER2_ID, USER2_EMAIL, 'user', 1)
    adminCookie = await authCookie(ADMIN_ID, ADMIN_EMAIL)
    userCookie = await authCookie(USER_ID, USER_EMAIL)
  })

  afterEach(() => {
    db.close()
  })

  // ========================================
  // GET /api/admin/users
  // ========================================
  describe('GET /api/admin/users', () => {
    it('should return all users for admin', async () => {
      const res = await getWithCookie('/api/admin/users', env, adminCookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.users).toHaveLength(3)
      // Should contain id, email, name, role, aiEnabled
      const user = body.users.find((u: { id: string }) => u.id === USER_ID)
      expect(user).toBeDefined()
      expect(user.email).toBe(USER_EMAIL)
      expect(user.role).toBe('user')
      expect(user.aiEnabled).toBe(false)
    })

    it('should return 403 for non-admin user', async () => {
      const res = await getWithCookie('/api/admin/users', env, userCookie)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('管理者権限')
    })

    it('should return 401 without auth', async () => {
      const res = await getWithCookie('/api/admin/users', env)
      expect(res.status).toBe(401)
    })

    it('should not include password_hash in response', async () => {
      const res = await getWithCookie('/api/admin/users', env, adminCookie)
      const body = await res.json()
      for (const user of body.users) {
        expect(user.password_hash).toBeUndefined()
        expect(user.passwordHash).toBeUndefined()
      }
    })

    it('should return aiEnabled as boolean true for ai_enabled=1', async () => {
      const res = await getWithCookie('/api/admin/users', env, adminCookie)
      const body = await res.json()
      const aiUser = body.users.find((u: { id: string }) => u.id === USER2_ID)
      expect(aiUser.aiEnabled).toBe(true)
    })
  })

  // ========================================
  // PUT /api/admin/users/:id
  // ========================================
  describe('PUT /api/admin/users/:id', () => {
    it('should allow admin to enable AI for a user', async () => {
      const res = await putJson(
        `/api/admin/users/${USER_ID}`,
        { aiEnabled: true },
        env,
        adminCookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.aiEnabled).toBe(true)

      // Verify in DB
      const row = db.prepare('SELECT ai_enabled FROM users WHERE id = ?').get(USER_ID) as {
        ai_enabled: number
      }
      expect(row.ai_enabled).toBe(1)
    })

    it('should allow admin to disable AI for a user', async () => {
      const res = await putJson(
        `/api/admin/users/${USER2_ID}`,
        { aiEnabled: false },
        env,
        adminCookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.aiEnabled).toBe(false)

      const row = db.prepare('SELECT ai_enabled FROM users WHERE id = ?').get(USER2_ID) as {
        ai_enabled: number
      }
      expect(row.ai_enabled).toBe(0)
    })

    it('should allow admin to change user role', async () => {
      const res = await putJson(`/api/admin/users/${USER_ID}`, { role: 'admin' }, env, adminCookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.role).toBe('admin')

      const row = db.prepare('SELECT role FROM users WHERE id = ?').get(USER_ID) as { role: string }
      expect(row.role).toBe('admin')
    })

    it('should allow updating both role and aiEnabled at once', async () => {
      const res = await putJson(
        `/api/admin/users/${USER_ID}`,
        { role: 'admin', aiEnabled: true },
        env,
        adminCookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.user.role).toBe('admin')
      expect(body.user.aiEnabled).toBe(true)
    })

    it('should return 403 for non-admin user', async () => {
      const res = await putJson(
        `/api/admin/users/${USER2_ID}`,
        { aiEnabled: true },
        env,
        userCookie,
      )
      expect(res.status).toBe(403)
    })

    it('should return 404 for non-existent user', async () => {
      const res = await putJson(
        '/api/admin/users/nonexistent',
        { aiEnabled: true },
        env,
        adminCookie,
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('ユーザー')
    })

    it('should return 401 without auth', async () => {
      const res = await putJson(`/api/admin/users/${USER_ID}`, { aiEnabled: true }, env)
      expect(res.status).toBe(401)
    })

    it('should return 400 for empty body', async () => {
      const res = await putJson(`/api/admin/users/${USER_ID}`, {}, env, adminCookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON', async () => {
      const res = await app.request(
        `/api/admin/users/${USER_ID}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for invalid role value', async () => {
      const res = await putJson(
        `/api/admin/users/${USER_ID}`,
        { role: 'superadmin' },
        env,
        adminCookie,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('無効なrole')
    })

    it('should return 400 for empty string role', async () => {
      const res = await putJson(`/api/admin/users/${USER_ID}`, { role: '' }, env, adminCookie)
      expect(res.status).toBe(400)
    })

    it('should accept valid role values: user and admin', async () => {
      const res1 = await putJson(`/api/admin/users/${USER_ID}`, { role: 'admin' }, env, adminCookie)
      expect(res1.status).toBe(200)

      const res2 = await putJson(`/api/admin/users/${USER_ID}`, { role: 'user' }, env, adminCookie)
      expect(res2.status).toBe(200)
    })
  })

  // ========================================
  // POST /api/admin/invitations
  // ========================================
  describe('POST /api/admin/invitations', () => {
    function postJson(path: string, body: unknown, env: object, cookie?: string) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (cookie) headers['Cookie'] = cookie
      return app.request(
        path,
        { method: 'POST', headers, body: JSON.stringify(body) },
        env,
      )
    }

    it('returns 401 when no auth cookie', async () => {
      const res = await postJson('/api/admin/invitations', { expiresInDays: 7 }, env)
      expect(res.status).toBe(401)
    })
    it('returns 403 when non-admin', async () => {
      const res = await postJson(
        '/api/admin/invitations',
        { expiresInDays: 7 },
        env,
        userCookie,
      )
      expect(res.status).toBe(403)
    })
    it('returns 400 when expiresInDays missing', async () => {
      const res = await postJson('/api/admin/invitations', {}, env, adminCookie)
      expect(res.status).toBe(400)
    })
    it('returns 400 when expiresInDays is 0', async () => {
      const res = await postJson(
        '/api/admin/invitations',
        { expiresInDays: 0 },
        env,
        adminCookie,
      )
      expect(res.status).toBe(400)
    })
    it('returns 400 when expiresInDays > 365', async () => {
      const res = await postJson(
        '/api/admin/invitations',
        { expiresInDays: 366 },
        env,
        adminCookie,
      )
      expect(res.status).toBe(400)
    })
    it('creates a code and returns 201 with code data', async () => {
      const res = await postJson(
        '/api/admin/invitations',
        { expiresInDays: 30 },
        env,
        adminCookie,
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        id: number
        code: string
        expiresAt: string
        revokedAt: string | null
        createdAt: string
        createdBy: string
      }
      expect(body.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/)
      expect(body.revokedAt).toBeNull()
      expect(body.createdBy).toBe(ADMIN_ID)
      const row = db
        .prepare('SELECT code FROM invitation_codes WHERE id = ?')
        .get(body.id) as { code: string }
      expect(row.code).toBe(body.code)
    })
  })

  // ========================================
  // GET /api/admin/invitations
  // ========================================
  describe('GET /api/admin/invitations', () => {
    it('returns 403 for non-admin', async () => {
      const res = await getWithCookie('/api/admin/invitations', env, userCookie)
      expect(res.status).toBe(403)
    })
    it('returns empty list when no codes', async () => {
      const res = await getWithCookie('/api/admin/invitations', env, adminCookie)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { invitations: unknown[] }
      expect(body.invitations).toEqual([])
    })
    it('returns codes with computed status (active/expired/revoked)', async () => {
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, revoked_at, created_by)
         VALUES (?, ?, ?, ?)`,
      ).run('ACTIVE01', '2099-01-01T00:00:00Z', null, ADMIN_ID)
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, revoked_at, created_by)
         VALUES (?, ?, ?, ?)`,
      ).run('EXPIRED1', '2000-01-01T00:00:00Z', null, ADMIN_ID)
      db.prepare(
        `INSERT INTO invitation_codes (code, expires_at, revoked_at, created_by)
         VALUES (?, ?, ?, ?)`,
      ).run('REVOKED1', '2099-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ADMIN_ID)

      const res = await getWithCookie('/api/admin/invitations', env, adminCookie)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        invitations: Array<{ code: string; status: string }>
      }
      const byCode = Object.fromEntries(body.invitations.map((i) => [i.code, i.status]))
      expect(byCode.ACTIVE01).toBe('active')
      expect(byCode.EXPIRED1).toBe('expired')
      expect(byCode.REVOKED1).toBe('revoked')
    })
  })
})
