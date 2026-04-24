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

describe('Projects API - join endpoint', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let userCookie: string
  const USER_ID = 'user-1'
  const USER_EMAIL = 'user@example.com'
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(async () => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, USER_ID, USER_EMAIL)
    registerUser(db, OTHER_USER_ID, OTHER_EMAIL)
    userCookie = await authCookie(USER_ID, USER_EMAIL)
    db.prepare(
      `INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'tok-abc')`,
    ).bind(OTHER_USER_ID).run()
  })

  afterEach(() => db.close())

  it('adds the current user as an editor and returns 200', async () => {
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { projectId: string; role: string; alreadyMember?: boolean }
    expect(body.projectId).toBe('p-1')
    expect(body.role).toBe('editor')
    expect(body.alreadyMember).toBeFalsy()
    const member = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get('p-1', USER_ID) as { role: string } | undefined
    expect(member?.role).toBe('editor')
  })

  it('returns alreadyMember for owner visiting own invite', async () => {
    const ownerCookie = await authCookie(OTHER_USER_ID, OTHER_EMAIL)
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { role: string; alreadyMember?: boolean }
    expect(body.role).toBe('owner')
    expect(body.alreadyMember).toBe(true)
  })

  it('returns alreadyMember when an existing editor joins again', async () => {
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    ).bind(USER_ID).run()
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { role: string; alreadyMember?: boolean }
    expect(body.role).toBe('editor')
    expect(body.alreadyMember).toBe(true)
  })

  it('returns 404 INVITE_TOKEN_INVALID for unknown token', async () => {
    const res = await app.request(
      '/api/projects/join/nonexistent',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('INVITE_TOKEN_INVALID')
  })

  it('returns 401 when not authenticated', async () => {
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST' },
      env,
    )
    expect(res.status).toBe(401)
  })

  it('does not match NULL invite_token rows (security)', async () => {
    // Create another project with NULL invite_token and ensure you can't join it by passing something weird
    db.prepare(
      `INSERT INTO projects (id, user_id, name) VALUES ('p-2', ?, 'P2')`,
    ).bind(OTHER_USER_ID).run()
    // NULL + NULL binding would be a concern without the explicit IS NOT NULL check
    const res = await app.request(
      '/api/projects/join/null',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(404)
  })
})

describe('Projects API - members endpoints', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let userCookie: string
  const USER_ID = 'user-1'
  const USER_EMAIL = 'user@example.com'
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(async () => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, USER_ID, USER_EMAIL)
    registerUser(db, OTHER_USER_ID, OTHER_EMAIL)
    userCookie = await authCookie(USER_ID, USER_EMAIL)
  })

  afterEach(() => db.close())

  describe('GET /api/projects/:id/members', () => {
    it('returns owner + editors for a member', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(OTHER_USER_ID).run()
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`).bind(USER_ID).run()
      const res = await app.request(
        '/api/projects/p-1/members',
        { headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        owner: { id: string; email: string; name: string }
        editors: Array<{ id: string; email: string; name: string; joinedAt: string }>
      }
      expect(body.owner.id).toBe(OTHER_USER_ID)
      expect(body.editors).toHaveLength(1)
      expect(body.editors[0].id).toBe(USER_ID)
      expect(body.editors[0].joinedAt).toBeTruthy()
    })

    it('returns owner + editors for the owner', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(USER_ID).run()
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`).bind(OTHER_USER_ID).run()
      const res = await app.request(
        '/api/projects/p-1/members',
        { headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        owner: { id: string }
        editors: Array<{ id: string }>
      }
      expect(body.owner.id).toBe(USER_ID)
      expect(body.editors[0].id).toBe(OTHER_USER_ID)
    })

    it('returns 403 for non-members', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(OTHER_USER_ID).run()
      const res = await app.request(
        '/api/projects/p-1/members',
        { headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(
        '/api/projects/nope/members',
        { headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/projects/:id/members/:userId', () => {
    it('allows owner to kick an editor', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(USER_ID).run()
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`).bind(OTHER_USER_ID).run()
      const res = await app.request(
        `/api/projects/p-1/members/${OTHER_USER_ID}`,
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(204)
      const row = db.prepare(`SELECT * FROM project_members WHERE project_id = 'p-1' AND user_id = ?`).get(OTHER_USER_ID)
      expect(row).toBeUndefined()
    })

    it('allows editor to leave voluntarily (remove self)', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(OTHER_USER_ID).run()
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`).bind(USER_ID).run()
      const res = await app.request(
        `/api/projects/p-1/members/${USER_ID}`,
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(204)
    })

    it('returns 403 when non-owner tries to kick someone else', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(OTHER_USER_ID).run()
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`).bind(USER_ID).run()
      registerUser(db, 'third', 'third@x.com')
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', 'third', 'editor')`).run()
      const res = await app.request(
        '/api/projects/p-1/members/third',
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(403)
    })

    it('returns 400 OWNER_CANNOT_LEAVE when owner tries to remove self', async () => {
      db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`).bind(USER_ID).run()
      const res = await app.request(
        `/api/projects/p-1/members/${USER_ID}`,
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code?: string }
      expect(body.code).toBe('OWNER_CANNOT_LEAVE')
    })

    it('returns 404 for non-existent project', async () => {
      const res = await app.request(
        `/api/projects/nope/members/${USER_ID}`,
        { method: 'DELETE', headers: { Cookie: userCookie } },
        env,
      )
      expect(res.status).toBe(404)
    })
  })
})
