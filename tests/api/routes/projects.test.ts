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

function registerUser(db: ReturnType<typeof Database>, id: string, email: string) {
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, ai_enabled) VALUES (?, ?, 'hash', 'Test', 'user', 0)",
  ).run(id, email)
}

describe('Projects API - invite links', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let userCookie: string
  const USER_ID = 'user-1'
  const USER_EMAIL = 'user@example.com'

  beforeEach(async () => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, USER_ID, USER_EMAIL)
    userCookie = await authCookie(USER_ID, USER_EMAIL)
  })

  afterEach(() => {
    db.close()
  })

  describe('POST /api/projects/:id/invite-link', () => {
    it('generates and returns a new invite token for the owner', async () => {
      db.prepare("INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'My Project')").run(
        USER_ID,
      )

      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'POST', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { inviteToken: string; inviteUrl: string }
      expect(body.inviteToken).toMatch(/^[0-9a-f-]{36}$/)
      expect(body.inviteUrl).toContain('/join/')
      const row = db
        .prepare('SELECT invite_token FROM projects WHERE id = ?')
        .get('p-1') as { invite_token: string }
      expect(row.invite_token).toBe(body.inviteToken)
    })

    it('is idempotent — second call returns the same token', async () => {
      db.prepare(
        "INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'existing-token')",
      ).run(USER_ID)
      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'POST', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { inviteToken: string }
      expect(body.inviteToken).toBe('existing-token')
    })

    it('returns 403 when non-owner tries to generate', async () => {
      registerUser(db, 'other-user', 'other@example.com')
      db.prepare(
        "INSERT INTO projects (id, user_id, name) VALUES ('p-1', 'other-user', 'P')",
      ).run()
      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'POST', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(
        '/api/projects/nope/invite-link',
        { method: 'POST', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'POST' },
        env,
      )
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/projects/:id/invite-link', () => {
    it('clears the invite token for the owner', async () => {
      db.prepare(
        "INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'tok')",
      ).run(USER_ID)
      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(204)
      const row = db
        .prepare('SELECT invite_token FROM projects WHERE id = ?')
        .get('p-1') as { invite_token: string | null }
      expect(row.invite_token).toBeNull()
    })

    it('returns 403 when non-owner tries to delete', async () => {
      registerUser(db, 'other-user', 'other@example.com')
      db.prepare(
        "INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', 'other-user', 'P', 'tok')",
      ).run()
      const res = await app.request(
        '/api/projects/p-1/invite-link',
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(
        '/api/projects/nope/invite-link',
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(404)
    })
  })
})
