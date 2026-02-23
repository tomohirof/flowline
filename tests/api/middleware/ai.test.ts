import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { createToken } from '../../../api/lib/jwt'
import { authMiddleware } from '../../../api/middleware/auth'
import { aiMiddleware } from '../../../api/middleware/ai'
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
  aiEnabled: number = 0,
) {
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, ai_enabled) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, 'hash', 'Test User', aiEnabled)
}

describe('aiMiddleware', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let testApp: Hono<AuthEnv>

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
    testApp = new Hono<AuthEnv>()
    testApp.use('*', authMiddleware)
    testApp.use('*', aiMiddleware)
    testApp.get('/test', (c) => c.json({ ok: true }))
  })

  afterEach(() => {
    db.close()
  })

  it('should allow user with ai_enabled=1 to access the endpoint', async () => {
    registerUser(db, 'ai-user-1', 'ai@example.com', 1)
    const cookie = await authCookie('ai-user-1', 'ai@example.com')

    const res = await testApp.request('/test', { headers: { Cookie: cookie } }, env)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('should return 403 for user with ai_enabled=0', async () => {
    registerUser(db, 'user-1', 'user@example.com', 0)
    const cookie = await authCookie('user-1', 'user@example.com')

    const res = await testApp.request('/test', { headers: { Cookie: cookie } }, env)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('AI機能')
  })

  it('should return 403 for user with default ai_enabled (not set)', async () => {
    // Insert user without specifying ai_enabled (defaults to 0)
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      'default-1',
      'default@example.com',
      'hash',
      'Default User',
    )
    const cookie = await authCookie('default-1', 'default@example.com')

    const res = await testApp.request('/test', { headers: { Cookie: cookie } }, env)
    expect(res.status).toBe(403)
  })

  it('should return 401 without authentication', async () => {
    const res = await testApp.request('/test', {}, env)
    expect(res.status).toBe(401)
  })

  it('should return 403 for non-existent user', async () => {
    const cookie = await authCookie('nonexistent-1', 'ghost@example.com')

    const res = await testApp.request('/test', { headers: { Cookie: cookie } }, env)
    expect(res.status).toBe(403)
  })
})
