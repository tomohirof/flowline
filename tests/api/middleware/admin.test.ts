import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { createToken } from '../../../api/lib/jwt'
import { authMiddleware } from '../../../api/middleware/auth'
import { adminMiddleware } from '../../../api/middleware/admin'
import type { AuthEnv } from '../../../api/app'

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
) {
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, 'hash', 'Test User', role)
}

describe('adminMiddleware', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let testApp: Hono<AuthEnv>

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
    testApp = new Hono<AuthEnv>()
    testApp.use('*', authMiddleware)
    testApp.use('*', adminMiddleware)
    testApp.get('/test', (c) => c.json({ ok: true }))
  })

  afterEach(() => {
    db.close()
  })

  it('should allow admin user to access the endpoint', async () => {
    registerUser(db, 'admin-1', 'admin@example.com', 'admin')
    const cookie = await authCookie('admin-1', 'admin@example.com')

    const res = await testApp.request(
      '/test',
      { headers: { Cookie: cookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('should return 403 for non-admin user', async () => {
    registerUser(db, 'user-1', 'user@example.com', 'user')
    const cookie = await authCookie('user-1', 'user@example.com')

    const res = await testApp.request(
      '/test',
      { headers: { Cookie: cookie } },
      env,
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('管理者権限')
  })

  it('should return 403 for user with default role (no explicit role set)', async () => {
    // Insert user without specifying role (defaults to "user")
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    ).run('default-1', 'default@example.com', 'hash', 'Default User')
    const cookie = await authCookie('default-1', 'default@example.com')

    const res = await testApp.request(
      '/test',
      { headers: { Cookie: cookie } },
      env,
    )
    expect(res.status).toBe(403)
  })

  it('should return 401 without authentication', async () => {
    const res = await testApp.request('/test', {}, env)
    expect(res.status).toBe(401)
  })

  it('should return 403 for user with null role in DB', async () => {
    // Simulate a case where user row is not found (deleted user)
    // createToken generates a valid JWT but the user doesn't exist in DB
    const cookie = await authCookie('nonexistent-1', 'ghost@example.com')

    const res = await testApp.request(
      '/test',
      { headers: { Cookie: cookie } },
      env,
    )
    // userRole defaults to 'user' when user not found
    expect(res.status).toBe(403)
  })
})
