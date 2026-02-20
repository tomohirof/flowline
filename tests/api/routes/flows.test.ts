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
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
    id,
    email,
    'hash',
    'Test User',
  )
}

function insertFlow(db: ReturnType<typeof Database>, id: string, userId: string, title: string) {
  db.prepare('INSERT INTO flows (id, user_id, title, theme_id) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    title,
    'cloud',
  )
}

function insertLane(
  db: ReturnType<typeof Database>,
  id: string,
  flowId: string,
  name: string,
  colorIndex: number,
  position: number,
) {
  db.prepare(
    'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
  ).run(id, flowId, name, colorIndex, position)
}

function insertNode(
  db: ReturnType<typeof Database>,
  id: string,
  flowId: string,
  laneId: string,
  rowIndex: number,
  label: string,
  note: string | null,
  orderIndex: number,
) {
  db.prepare(
    'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, flowId, laneId, rowIndex, label, note, orderIndex)
}

function insertArrow(
  db: ReturnType<typeof Database>,
  id: string,
  flowId: string,
  fromNodeId: string,
  toNodeId: string,
  comment: string | null,
) {
  db.prepare(
    'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)',
  ).run(id, flowId, fromNodeId, toNodeId, comment)
}

function postJson(path: string, body: unknown, env: object, cookie?: string) {
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

function getWithCookie(path: string, env: object, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, { headers }, env)
}

function deleteWithCookie(path: string, env: object, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie
  return app.request(path, { method: 'DELETE', headers }, env)
}

describe('Flows API', () => {
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
  // GET /api/flows (list)
  // ========================================
  describe('GET /api/flows', () => {
    it('should return empty array when user has no flows', async () => {
      const res = await getWithCookie('/api/flows', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toEqual([])
    })

    it('should return only current user flows, not other users flows', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'My Flow')
      insertFlow(db, 'flow-2', OTHER_USER_ID, 'Other Flow')
      insertFlow(db, 'flow-3', USER_ID, 'My Flow 2')

      const res = await getWithCookie('/api/flows', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(2)
      const titles = body.flows.map((f: { title: string }) => f.title)
      expect(titles).toContain('My Flow')
      expect(titles).toContain('My Flow 2')
      expect(titles).not.toContain('Other Flow')
    })

    it('should return flows ordered by updatedAt desc', async () => {
      // Insert with explicit timestamps
      db.prepare(
        'INSERT INTO flows (id, user_id, title, theme_id, updated_at) VALUES (?, ?, ?, ?, ?)',
      ).run('flow-old', USER_ID, 'Old Flow', 'cloud', '2024-01-01T00:00:00Z')
      db.prepare(
        'INSERT INTO flows (id, user_id, title, theme_id, updated_at) VALUES (?, ?, ?, ?, ?)',
      ).run('flow-new', USER_ID, 'New Flow', 'cloud', '2025-01-01T00:00:00Z')

      const res = await getWithCookie('/api/flows', env, cookie)
      const body = await res.json()
      expect(body.flows[0].title).toBe('New Flow')
      expect(body.flows[1].title).toBe('Old Flow')
    })

    it('should return camelCase field names', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Test Flow')

      const res = await getWithCookie('/api/flows', env, cookie)
      const body = await res.json()
      const flow = body.flows[0]
      expect(flow.id).toBeDefined()
      expect(flow.title).toBeDefined()
      expect(flow.themeId).toBeDefined()
      expect(flow.createdAt).toBeDefined()
      expect(flow.updatedAt).toBeDefined()
      // snake_case should NOT be present
      expect(flow.theme_id).toBeUndefined()
      expect(flow.user_id).toBeUndefined()
      expect(flow.created_at).toBeUndefined()
      expect(flow.updated_at).toBeUndefined()
    })

    it('should return 401 without auth', async () => {
      const res = await getWithCookie('/api/flows', env)
      expect(res.status).toBe(401)
    })
  })

  // ========================================
  // POST /api/flows (create)
  // ========================================
  describe('POST /api/flows', () => {
    it('should create flow with title only and return 201', async () => {
      const res = await postJson('/api/flows', { title: 'My New Flow' }, env, cookie)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.flow.title).toBe('My New Flow')
      expect(body.flow.id).toBeDefined()
      expect(body.flow.themeId).toBe('cloud')
      expect(body.flow.lanes).toEqual([])
      expect(body.flow.nodes).toEqual([])
      expect(body.flow.arrows).toEqual([])
    })

    it('should create flow with lanes, nodes, arrows and return 201', async () => {
      const payload = {
        title: 'Full Flow',
        themeId: 'sunset',
        lanes: [
          { id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 },
          { id: 'lane-2', name: 'Lane 2', colorIndex: 1, position: 1 },
        ],
        nodes: [
          {
            id: 'node-1',
            laneId: 'lane-1',
            rowIndex: 0,
            label: 'Task 1',
            note: 'Note 1',
            orderIndex: 0,
          },
          {
            id: 'node-2',
            laneId: 'lane-2',
            rowIndex: 0,
            label: 'Task 2',
            note: null,
            orderIndex: 0,
          },
        ],
        arrows: [{ id: 'arrow-1', fromNodeId: 'node-1', toNodeId: 'node-2', comment: 'Next step' }],
      }

      const res = await postJson('/api/flows', payload, env, cookie)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.flow.title).toBe('Full Flow')
      expect(body.flow.themeId).toBe('sunset')
      expect(body.flow.lanes).toHaveLength(2)
      expect(body.flow.nodes).toHaveLength(2)
      expect(body.flow.arrows).toHaveLength(1)
      expect(body.flow.arrows[0].comment).toBe('Next step')
    })

    it('should use default title and theme when not provided', async () => {
      const res = await postJson('/api/flows', {}, env, cookie)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.flow.title).toBe('無題のフロー')
      expect(body.flow.themeId).toBe('cloud')
    })

    it('should return 400 for empty title string', async () => {
      const res = await postJson('/api/flows', { title: '' }, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON', async () => {
      const res = await app.request(
        '/api/flows',
        {
          method: 'POST',
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

    it('should return 401 without auth', async () => {
      const res = await postJson('/api/flows', { title: 'Test' }, env)
      expect(res.status).toBe(401)
    })

    it('should persist flow in database', async () => {
      await postJson('/api/flows', { title: 'Persisted Flow' }, env, cookie)
      const row = db.prepare('SELECT * FROM flows WHERE title = ?').get('Persisted Flow') as {
        id: string
        user_id: string
      }
      expect(row).toBeDefined()
      expect(row.user_id).toBe(USER_ID)
    })

    it('should persist lanes, nodes, arrows in database', async () => {
      const payload = {
        title: 'DB Flow',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
        nodes: [
          { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task', note: null, orderIndex: 0 },
        ],
        arrows: [],
      }

      const res = await postJson('/api/flows', payload, env, cookie)
      const body = await res.json()
      const flowId = body.flow.id

      const lanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all(flowId)
      expect(lanes).toHaveLength(1)

      const nodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all(flowId)
      expect(nodes).toHaveLength(1)
    })

    it('should return 400 when title exceeds 200 characters', async () => {
      const longTitle = 'a'.repeat(201)
      const res = await postJson('/api/flows', { title: longTitle }, env, cookie)
      expect(res.status).toBe(400)
    })
  })

  // ========================================
  // GET /api/flows/:id (detail)
  // ========================================
  describe('GET /api/flows/:id', () => {
    it('should return flow with lanes, nodes, arrows', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Detail Flow')
      insertLane(db, 'lane-1', 'flow-1', 'Lane 1', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task 1', 'Note', 0)
      insertNode(db, 'node-2', 'flow-1', 'lane-1', 1, 'Task 2', null, 1)
      insertArrow(db, 'arrow-1', 'flow-1', 'node-1', 'node-2', 'Connection')

      const res = await getWithCookie('/api/flows/flow-1', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.title).toBe('Detail Flow')
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.nodes).toHaveLength(2)
      expect(body.flow.arrows).toHaveLength(1)

      // camelCase check
      const lane = body.flow.lanes[0]
      expect(lane.colorIndex).toBe(0)
      expect(lane.color_index).toBeUndefined()

      const node = body.flow.nodes[0]
      expect(node.laneId).toBeDefined()
      expect(node.rowIndex).toBeDefined()
      expect(node.orderIndex).toBeDefined()
      expect(node.lane_id).toBeUndefined()

      const arrow = body.flow.arrows[0]
      expect(arrow.fromNodeId).toBeDefined()
      expect(arrow.toNodeId).toBeDefined()
      expect(arrow.from_node_id).toBeUndefined()
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await getWithCookie('/api/flows/nonexistent', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')

      const res = await getWithCookie('/api/flows/flow-other', env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Test')
      const res = await getWithCookie('/api/flows/flow-1', env)
      expect(res.status).toBe(401)
    })

    it('should return flow with empty children when no lanes, nodes, arrows exist', async () => {
      insertFlow(db, 'flow-empty', USER_ID, 'Empty Flow')

      const res = await getWithCookie('/api/flows/flow-empty', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.lanes).toEqual([])
      expect(body.flow.nodes).toEqual([])
      expect(body.flow.arrows).toEqual([])
    })
  })

  // ========================================
  // PUT /api/flows/:id (update)
  // ========================================
  describe('PUT /api/flows/:id', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'Original Title')
      insertLane(db, 'lane-old', 'flow-1', 'Old Lane', 0, 0)
      insertNode(db, 'node-old', 'flow-1', 'lane-old', 0, 'Old Task', null, 0)
    })

    it('should update title and theme', async () => {
      const res = await putJson(
        '/api/flows/flow-1',
        {
          title: 'Updated Title',
          themeId: 'sunset',
        },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.title).toBe('Updated Title')
      expect(body.flow.themeId).toBe('sunset')
    })

    it('should replace lanes, nodes, arrows (old ones deleted, new ones inserted)', async () => {
      const payload = {
        title: 'Updated Flow',
        lanes: [
          { id: 'lane-new-1', name: 'New Lane 1', colorIndex: 0, position: 0 },
          { id: 'lane-new-2', name: 'New Lane 2', colorIndex: 1, position: 1 },
        ],
        nodes: [
          {
            id: 'node-new-1',
            laneId: 'lane-new-1',
            rowIndex: 0,
            label: 'New Task 1',
            note: null,
            orderIndex: 0,
          },
        ],
        arrows: [],
      }

      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.lanes).toHaveLength(2)
      expect(body.flow.nodes).toHaveLength(1)
      expect(body.flow.arrows).toEqual([])

      // Verify old data was deleted
      const oldLanes = db.prepare('SELECT * FROM lanes WHERE id = ?').all('lane-old')
      expect(oldLanes).toHaveLength(0)

      const oldNodes = db.prepare('SELECT * FROM nodes WHERE id = ?').all('node-old')
      expect(oldNodes).toHaveLength(0)

      // Verify new data was inserted
      const newLanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')
      expect(newLanes).toHaveLength(2)
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await putJson('/api/flows/nonexistent', { title: 'Updated' }, env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')

      const res = await putJson('/api/flows/flow-other', { title: 'Hacked' }, env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 400 for invalid body (empty title)', async () => {
      const res = await putJson('/api/flows/flow-1', { title: '' }, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 for malformed JSON', async () => {
      const res = await app.request(
        '/api/flows/flow-1',
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

    it('should return 401 without auth', async () => {
      const res = await putJson('/api/flows/flow-1', { title: 'Updated' }, env)
      expect(res.status).toBe(401)
    })

    it('should update updated_at timestamp', async () => {
      // Set a known old timestamp
      const oldTimestamp = '2020-01-01T00:00:00Z'
      db.prepare('UPDATE flows SET updated_at = ? WHERE id = ?').run(oldTimestamp, 'flow-1')

      await putJson('/api/flows/flow-1', { title: 'Updated' }, env, cookie)

      const after = db.prepare('SELECT updated_at FROM flows WHERE id = ?').get('flow-1') as {
        updated_at: string
      }
      expect(after.updated_at).toBeDefined()
      expect(after.updated_at).not.toBe(oldTimestamp)
    })
  })

  // ========================================
  // DELETE /api/flows/:id (delete)
  // ========================================
  describe('DELETE /api/flows/:id', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'To Delete')
      insertLane(db, 'lane-1', 'flow-1', 'Lane', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task', null, 0)
      insertNode(db, 'node-2', 'flow-1', 'lane-1', 1, 'Task 2', null, 1)
      insertArrow(db, 'arrow-1', 'flow-1', 'node-1', 'node-2', null)
    })

    it('should delete flow and return success message', async () => {
      const res = await deleteWithCookie('/api/flows/flow-1', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('フローを削除しました')
    })

    it('should cascade delete lanes, nodes, arrows', async () => {
      await deleteWithCookie('/api/flows/flow-1', env, cookie)

      const flows = db.prepare('SELECT * FROM flows WHERE id = ?').all('flow-1')
      expect(flows).toHaveLength(0)

      const lanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')
      expect(lanes).toHaveLength(0)

      const nodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')
      expect(nodes).toHaveLength(0)

      const arrows = db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')
      expect(arrows).toHaveLength(0)
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await deleteWithCookie('/api/flows/nonexistent', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')

      const res = await deleteWithCookie('/api/flows/flow-other', env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      const res = await deleteWithCookie('/api/flows/flow-1', env)
      expect(res.status).toBe(401)
    })

    it('should not delete other users flows', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')

      await deleteWithCookie('/api/flows/flow-other', env, cookie)

      // Other user's flow should still exist
      const others = db.prepare('SELECT * FROM flows WHERE id = ?').all('flow-other')
      expect(others).toHaveLength(1)
    })
  })
})
