import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

const JWT_SECRET = 'test-secret-key-for-settings-tests'

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

function putJson(path: string, body: object, env: object, cookie?: string) {
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

function getWithCookie(path: string, env: object, cookie: string) {
  return app.request(
    path,
    {
      headers: { Cookie: cookie },
    },
    env,
  )
}

function deleteWithCookie(path: string, env: object, cookie: string) {
  return app.request(
    path,
    {
      method: 'DELETE',
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

async function registerAndGetCookie(
  env: object,
  sqliteDb: ReturnType<typeof Database>,
): Promise<string> {
  await postJson(
    '/api/auth/register',
    {
      email: 'settings-user@example.com',
      password: 'password123',
      name: 'Settings User',
    },
    env,
  )
  // Email verification flow: register no longer sets cookie.
  // Manually verify email, then login to get cookie.
  sqliteDb
    .prepare('UPDATE users SET email_verified = 1 WHERE email = ?')
    .run('settings-user@example.com')
  const loginRes = await postJson(
    '/api/auth/login',
    { email: 'settings-user@example.com', password: 'password123' },
    env,
  )
  return extractCookie(loginRes)
}

describe('Settings API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
  })

  afterEach(() => {
    db.close()
  })

  // ===========================================
  // Auth guard: all endpoints return 401 without auth
  // ===========================================
  describe('Auth guard', () => {
    it('should return 401 for GET /api/settings without auth', async () => {
      const res = await app.request('/api/settings', {}, env)
      expect(res.status).toBe(401)
    })

    it('should return 401 for PUT /api/settings without auth', async () => {
      const res = await app.request(
        '/api/settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        env,
      )
      expect(res.status).toBe(401)
    })

    it('should return 401 for PUT /api/settings/profile without auth', async () => {
      const res = await app.request(
        '/api/settings/profile',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name' }),
        },
        env,
      )
      expect(res.status).toBe(401)
    })

    it('should return 401 for PUT /api/settings/password without auth', async () => {
      const res = await app.request(
        '/api/settings/password',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'old',
            newPassword: 'newpassword123',
          }),
        },
        env,
      )
      expect(res.status).toBe(401)
    })

    it('should return 401 for DELETE /api/settings/account without auth', async () => {
      const res = await app.request('/api/settings/account', { method: 'DELETE' }, env)
      expect(res.status).toBe(401)
    })
  })

  // ===========================================
  // GET /api/settings - Get settings
  // ===========================================
  describe('GET /api/settings', () => {
    it('should return default settings for new user', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await getWithCookie('/api/settings', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.settings).toBeDefined()
      expect(body.settings.autoConnect).toBe(true)
      expect(body.settings.copyLabelOnSameRow).toBe(false)
      expect(body.settings.language).toBe('ja')
      expect(body.settings.defaultTheme).toBe('cloud')
    })

    it('should return profile info along with settings', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await getWithCookie('/api/settings', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.profile).toBeDefined()
      expect(body.profile.name).toBe('Settings User')
      expect(body.profile.email).toBe('settings-user@example.com')
    })

    it('should not include password_hash in profile', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await getWithCookie('/api/settings', env, cookie)
      const body = await res.json()
      expect(body.profile.password_hash).toBeUndefined()
    })

    it('should return merged settings after partial update', async () => {
      const cookie = await registerAndGetCookie(env, db)
      // Update one setting
      await putJson('/api/settings', { autoConnect: false }, env, cookie)
      // GET should show updated + defaults
      const res = await getWithCookie('/api/settings', env, cookie)
      const body = await res.json()
      expect(body.settings.autoConnect).toBe(false)
      expect(body.settings.copyLabelOnSameRow).toBe(false) // default preserved
      expect(body.settings.language).toBe('ja') // default preserved
    })
  })

  // ===========================================
  // PUT /api/settings - Update settings
  // ===========================================
  describe('PUT /api/settings', () => {
    it('should update allowed settings', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings',
        { autoConnect: false, language: 'en' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.settings.autoConnect).toBe(false)
      expect(body.settings.language).toBe('en')
    })

    it('should ignore unknown keys', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings',
        { autoConnect: false, unknownKey: 'value' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.settings.unknownKey).toBeUndefined()
    })

    it('should merge with existing settings', async () => {
      const cookie = await registerAndGetCookie(env, db)
      // First update
      await putJson('/api/settings', { autoConnect: false }, env, cookie)
      // Second update - should merge, not replace
      const res = await putJson('/api/settings', { language: 'en' }, env, cookie)
      const body = await res.json()
      expect(body.settings.autoConnect).toBe(false) // preserved from first update
      expect(body.settings.language).toBe('en') // new value
    })

    it('should return 400 for empty body', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings', {}, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON body', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await app.request(
        '/api/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })
  })

  // ===========================================
  // PUT /api/settings/profile - Update name
  // ===========================================
  describe('PUT /api/settings/profile', () => {
    it('should update user name', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings/profile', { name: 'New Name' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.profile.name).toBe('New Name')
    })

    it('should trim whitespace from name', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings/profile', { name: '  Trimmed Name  ' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.profile.name).toBe('Trimmed Name')
    })

    it('should return 400 for empty name', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings/profile', { name: '' }, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for whitespace-only name', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings/profile', { name: '   ' }, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing name field', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson('/api/settings/profile', {}, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON body', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await app.request(
        '/api/settings/profile',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })
  })

  // ===========================================
  // PUT /api/settings/password - Change password
  // ===========================================
  describe('PUT /api/settings/password', () => {
    it('should change password with correct current password', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { currentPassword: 'password123', newPassword: 'newpassword123' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
    })

    it('should allow login with new password after change', async () => {
      const cookie = await registerAndGetCookie(env, db)
      await putJson(
        '/api/settings/password',
        { currentPassword: 'password123', newPassword: 'newpassword123' },
        env,
        cookie,
      )
      // Try login with new password
      const loginRes = await postJson(
        '/api/auth/login',
        { email: 'settings-user@example.com', password: 'newpassword123' },
        env,
      )
      expect(loginRes.status).toBe(200)
    })

    it('should reject login with old password after change', async () => {
      const cookie = await registerAndGetCookie(env, db)
      await putJson(
        '/api/settings/password',
        { currentPassword: 'password123', newPassword: 'newpassword123' },
        env,
        cookie,
      )
      // Try login with old password
      const loginRes = await postJson(
        '/api/auth/login',
        { email: 'settings-user@example.com', password: 'password123' },
        env,
      )
      expect(loginRes.status).toBe(401)
    })

    it('should return 400 for wrong current password', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { currentPassword: 'wrongpassword', newPassword: 'newpassword123' },
        env,
        cookie,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for new password shorter than 8 characters', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { currentPassword: 'password123', newPassword: '1234567' },
        env,
        cookie,
      )
      expect(res.status).toBe(400)
    })

    it('should accept new password with exactly 8 characters', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { currentPassword: 'password123', newPassword: '12345678' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
    })

    it('should return 400 for missing currentPassword', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { newPassword: 'newpassword123' },
        env,
        cookie,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for missing newPassword', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await putJson(
        '/api/settings/password',
        { currentPassword: 'password123' },
        env,
        cookie,
      )
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON body', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await app.request(
        '/api/settings/password',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(400)
    })
  })

  // ===========================================
  // DELETE /api/settings/account - Delete account
  // ===========================================
  describe('DELETE /api/settings/account', () => {
    it('should delete user and all their data', async () => {
      const cookie = await registerAndGetCookie(env, db)
      const res = await deleteWithCookie('/api/settings/account', env, cookie)
      expect(res.status).toBe(200)
    })

    it('should prevent login after account deletion', async () => {
      const cookie = await registerAndGetCookie(env, db)
      await deleteWithCookie('/api/settings/account', env, cookie)
      // Try logging in
      const loginRes = await postJson(
        '/api/auth/login',
        { email: 'settings-user@example.com', password: 'password123' },
        env,
      )
      expect(loginRes.status).toBe(401)
    })

    it('should delete user flows when account is deleted', async () => {
      const cookie = await registerAndGetCookie(env, db)
      // Create a flow first
      await app.request(
        '/api/flows',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({
            title: 'Test Flow',
            lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
            nodes: [],
            arrows: [],
          }),
        },
        env,
      )
      // Delete account
      await deleteWithCookie('/api/settings/account', env, cookie)
      // Verify flows are deleted
      const flowCount = db.prepare('SELECT COUNT(*) as cnt FROM flows').get() as { cnt: number }
      expect(flowCount.cnt).toBe(0)
    })

    it('should return 404 if user not found', async () => {
      const cookie = await registerAndGetCookie(env, db)
      // Delete user manually from DB first
      db.prepare('DELETE FROM users WHERE email = ?').run('settings-user@example.com')
      const res = await deleteWithCookie('/api/settings/account', env, cookie)
      expect(res.status).toBe(404)
    })
  })
})
