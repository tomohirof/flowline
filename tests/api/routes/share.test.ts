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
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, 'hash', 'Test User')
}

function insertFlow(db: ReturnType<typeof Database>, id: string, userId: string, title: string) {
  db.prepare('INSERT INTO flows (id, user_id, title, theme_id) VALUES (?, ?, ?, ?)').run(id, userId, title, 'cloud')
}

function insertFlowWithShareToken(db: ReturnType<typeof Database>, id: string, userId: string, title: string, shareToken: string) {
  db.prepare('INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)').run(id, userId, title, 'cloud', shareToken)
}

function insertLane(db: ReturnType<typeof Database>, id: string, flowId: string, name: string, colorIndex: number, position: number) {
  db.prepare('INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)').run(id, flowId, name, colorIndex, position)
}

function insertNode(db: ReturnType<typeof Database>, id: string, flowId: string, laneId: string, rowIndex: number, label: string, note: string | null, orderIndex: number) {
  db.prepare('INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, flowId, laneId, rowIndex, label, note, orderIndex)
}

function insertArrow(db: ReturnType<typeof Database>, id: string, flowId: string, fromNodeId: string, toNodeId: string, comment: string | null) {
  db.prepare('INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)').run(id, flowId, fromNodeId, toNodeId, comment)
}

function postWithCookie(path: string, env: object, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, {
    method: 'POST',
    headers,
  }, env)
}

function deleteWithCookie(path: string, env: object, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, { method: 'DELETE', headers }, env)
}

function getRequest(path: string, env: object) {
  return app.request(path, {}, env)
}

describe('Share API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>
  let cookie: string

  const USER_ID = 'user-1'
  const USER_EMAIL = 'test@example.com'
  const OTHER_USER_ID = 'user-2'
  const OTHER_USER_EMAIL = 'other@example.com'

  beforeEach(async () => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, USER_ID, USER_EMAIL)
    registerUser(db, OTHER_USER_ID, OTHER_USER_EMAIL)
    cookie = await authCookie(USER_ID, USER_EMAIL)
  })

  afterEach(() => {
    db.close()
  })

  // ========================================
  // POST /api/flows/:id/share (share)
  // ========================================
  describe('POST /api/flows/:id/share', () => {
    it('should generate share token and return shareUrl', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'My Flow')

      const res = await postWithCookie('/api/flows/flow-1/share', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.shareToken).toBeDefined()
      expect(typeof body.shareToken).toBe('string')
      expect(body.shareToken.length).toBeGreaterThan(0)
      expect(body.shareUrl).toBe(`/shared/${body.shareToken}`)
    })

    it('should persist share_token in database', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'My Flow')

      const res = await postWithCookie('/api/flows/flow-1/share', env, cookie)
      const body = await res.json()

      const row = db.prepare('SELECT share_token FROM flows WHERE id = ?').get('flow-1') as { share_token: string }
      expect(row.share_token).toBe(body.shareToken)
    })

    it('should return existing token if flow is already shared', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'existing-token')

      const res = await postWithCookie('/api/flows/flow-1/share', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.shareToken).toBe('existing-token')
      expect(body.shareUrl).toBe('/shared/existing-token')
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await postWithCookie('/api/flows/nonexistent/share', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')

      const res = await postWithCookie('/api/flows/flow-other/share', env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'My Flow')

      const res = await postWithCookie('/api/flows/flow-1/share', env)
      expect(res.status).toBe(401)
    })

    it('should generate unique tokens for different flows', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Flow 1')
      insertFlow(db, 'flow-2', USER_ID, 'Flow 2')

      const res1 = await postWithCookie('/api/flows/flow-1/share', env, cookie)
      const body1 = await res1.json()

      const res2 = await postWithCookie('/api/flows/flow-2/share', env, cookie)
      const body2 = await res2.json()

      expect(body1.shareToken).not.toBe(body2.shareToken)
    })
  })

  // ========================================
  // DELETE /api/flows/:id/share (unshare)
  // ========================================
  describe('DELETE /api/flows/:id/share', () => {
    it('should remove share token and return success message', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'some-token')

      const res = await deleteWithCookie('/api/flows/flow-1/share', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('共有を解除しました')
    })

    it('should set share_token to NULL in database', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'some-token')

      await deleteWithCookie('/api/flows/flow-1/share', env, cookie)

      const row = db.prepare('SELECT share_token FROM flows WHERE id = ?').get('flow-1') as { share_token: string | null }
      expect(row.share_token).toBeNull()
    })

    it('should succeed even when flow has no share token (idempotent)', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'My Flow')

      const res = await deleteWithCookie('/api/flows/flow-1/share', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('共有を解除しました')
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await deleteWithCookie('/api/flows/nonexistent/share', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlowWithShareToken(db, 'flow-other', OTHER_USER_ID, 'Other Flow', 'token')

      const res = await deleteWithCookie('/api/flows/flow-other/share', env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'token')

      const res = await deleteWithCookie('/api/flows/flow-1/share', env)
      expect(res.status).toBe(401)
    })

    it('should make shared flow no longer accessible via token', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'test-token')

      // First verify the shared flow is accessible
      const before = await getRequest('/api/shared/test-token', env)
      expect(before.status).toBe(200)

      // Delete the share
      await deleteWithCookie('/api/flows/flow-1/share', env, cookie)

      // Now it should be 404
      const after = await getRequest('/api/shared/test-token', env)
      expect(after.status).toBe(404)
    })
  })

  // ========================================
  // GET /api/shared/:token (public view)
  // ========================================
  describe('GET /api/shared/:token', () => {
    it('should return flow detail without authentication', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Shared Flow', 'public-token')
      insertLane(db, 'lane-1', 'flow-1', 'Lane 1', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task 1', 'Note', 0)
      insertNode(db, 'node-2', 'flow-1', 'lane-1', 1, 'Task 2', null, 1)
      insertArrow(db, 'arrow-1', 'flow-1', 'node-1', 'node-2', 'Connection')

      const res = await getRequest('/api/shared/public-token', env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.title).toBe('Shared Flow')
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.nodes).toHaveLength(2)
      expect(body.flow.arrows).toHaveLength(1)
    })

    it('should return camelCase field names', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Shared Flow', 'camel-token')
      insertLane(db, 'lane-1', 'flow-1', 'Lane 1', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task 1', null, 0)

      const res = await getRequest('/api/shared/camel-token', env)
      const body = await res.json()

      // Check flow fields
      expect(body.flow.themeId).toBeDefined()
      expect(body.flow.createdAt).toBeDefined()
      expect(body.flow.updatedAt).toBeDefined()
      expect(body.flow.theme_id).toBeUndefined()
      expect(body.flow.user_id).toBeUndefined()

      // Check lane fields
      const lane = body.flow.lanes[0]
      expect(lane.colorIndex).toBe(0)
      expect(lane.color_index).toBeUndefined()

      // Check node fields
      const node = body.flow.nodes[0]
      expect(node.laneId).toBeDefined()
      expect(node.rowIndex).toBeDefined()
      expect(node.lane_id).toBeUndefined()
    })

    it('should not include user info in response', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Shared Flow', 'no-user-token')

      const res = await getRequest('/api/shared/no-user-token', env)
      const body = await res.json()
      expect(body.flow.userId).toBeUndefined()
      expect(body.flow.user_id).toBeUndefined()
    })

    it('should return 404 for non-existent token', async () => {
      const res = await getRequest('/api/shared/nonexistent-token', env)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBeDefined()
    })

    it('should return 404 for empty token', async () => {
      // This tests the route with an empty-ish token
      const res = await getRequest('/api/shared/', env)
      // Should be 404 (no matching route or empty param)
      expect(res.status).toBe(404)
    })

    it('should return flow with empty children when no lanes/nodes/arrows exist', async () => {
      insertFlowWithShareToken(db, 'flow-empty', USER_ID, 'Empty Flow', 'empty-token')

      const res = await getRequest('/api/shared/empty-token', env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.lanes).toEqual([])
      expect(body.flow.nodes).toEqual([])
      expect(body.flow.arrows).toEqual([])
    })

    it('should work without any auth cookie', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Public Flow', 'open-token')

      // No cookie at all
      const res = await app.request('/api/shared/open-token', {}, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.title).toBe('Public Flow')
    })
  })
})
