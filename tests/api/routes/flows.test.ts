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

function softDeleteFlow(db: ReturnType<typeof Database>, flowId: string) {
  db.prepare(
    "UPDATE flows SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
  ).run(flowId)
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
  // GET /api/flows?q= (search)
  // ========================================
  describe('GET /api/flows?q= (search)', () => {
    // Setup: create flows with various searchable content
    beforeEach(() => {
      // Flow A: has node label "受注処理", lane "営業部", node note "重要な手順", arrow comment "承認後"
      insertFlow(db, 'flow-a', USER_ID, 'プロジェクト管理')
      insertLane(db, 'lane-a1', 'flow-a', '営業部', 0, 0)
      insertNode(db, 'node-a1', 'flow-a', 'lane-a1', 0, '受注処理', '重要な手順', 0)
      insertNode(db, 'node-a2', 'flow-a', 'lane-a1', 1, '出荷準備', null, 1)
      insertArrow(db, 'arrow-a1', 'flow-a', 'node-a1', 'node-a2', '承認後')

      // Flow B: has node label "Invoice Review", lane "Finance", node note "Check amounts"
      insertFlow(db, 'flow-b', USER_ID, 'Billing Workflow')
      insertLane(db, 'lane-b1', 'flow-b', 'Finance', 0, 0)
      insertNode(db, 'node-b1', 'flow-b', 'lane-b1', 0, 'Invoice Review', 'Check amounts', 0)
      insertNode(db, 'node-b2', 'flow-b', 'lane-b1', 1, 'Payment', null, 1)
      insertArrow(db, 'arrow-b1', 'flow-b', 'node-b1', 'node-b2', 'approved')

      // Flow C: belongs to OTHER user (should never appear in results)
      insertFlow(db, 'flow-c', OTHER_USER_ID, '受注処理フロー')
      insertLane(db, 'lane-c1', 'flow-c', '営業部', 0, 0)
      insertNode(db, 'node-c1', 'flow-c', 'lane-c1', 0, '受注処理', '重要な手順', 0)
    })

    it('should filter flows by node label', async () => {
      const res = await getWithCookie('/api/flows?q=受注処理', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
    })

    it('should filter flows by lane name', async () => {
      const res = await getWithCookie('/api/flows?q=営業部', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
    })

    it('should filter flows by node note', async () => {
      const res = await getWithCookie('/api/flows?q=重要な手順', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
    })

    it('should filter flows by arrow comment', async () => {
      const res = await getWithCookie('/api/flows?q=承認後', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
    })

    it('should filter flows by title', async () => {
      const res = await getWithCookie('/api/flows?q=Billing', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-b')
    })

    it('should return all flows when query is empty', async () => {
      const res = await getWithCookie('/api/flows?q=', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      // user owns flow-a and flow-b (flow-c belongs to OTHER_USER)
      expect(body.flows).toHaveLength(2)
    })

    it('should deduplicate when query matches multiple fields in same flow', async () => {
      // "受注" matches node label "受注処理" in flow-a
      // flow-a also has lane "営業部" but that doesn't match
      // Insert another node with "受注" in note to create potential duplicate
      insertNode(db, 'node-a3', 'flow-a', 'lane-a1', 2, '確認', '受注データの確認', 2)

      const res = await getWithCookie('/api/flows?q=受注', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      // flow-a matches via node label AND node note, but should appear only once
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
    })

    it('should ignore ASCII case when searching', async () => {
      const res = await getWithCookie('/api/flows?q=billing', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      // "billing" should match "Billing Workflow" (title of flow-b)
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-b')
    })

    it('should not return other users flows even when query matches', async () => {
      // flow-c has title "受注処理フロー" and node label "受注処理", owned by OTHER_USER
      const res = await getWithCookie('/api/flows?q=受注処理', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      // Only flow-a (owned by USER) should be returned
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-a')
      const ids = body.flows.map((f: { id: string }) => f.id)
      expect(ids).not.toContain('flow-c')
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

    it('should persist node styles (bg, strokeColor, dash) and arrow styles (color, dash)', async () => {
      const payload = {
        title: 'Styled Flow',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
        nodes: [
          {
            id: 'node-1',
            laneId: 'lane-1',
            rowIndex: 0,
            label: 'Styled',
            note: null,
            orderIndex: 0,
            bg: '#EEF5FF',
            strokeColor: '#5080D0',
            dash: '8,4',
          },
          {
            id: 'node-2',
            laneId: 'lane-1',
            rowIndex: 1,
            label: 'Default',
            note: null,
            orderIndex: 1,
          },
        ],
        arrows: [
          {
            id: 'arrow-1',
            fromNodeId: 'node-1',
            toNodeId: 'node-2',
            comment: null,
            color: '#E06060',
            dash: '3,3',
          },
        ],
      }

      const res = await postJson('/api/flows', payload, env, cookie)
      expect(res.status).toBe(201)
      const body = await res.json()

      // Check API response includes styles
      expect(body.flow.nodes[0].bg).toBe('#EEF5FF')
      expect(body.flow.nodes[0].strokeColor).toBe('#5080D0')
      expect(body.flow.nodes[0].dash).toBe('8,4')
      expect(body.flow.nodes[1].bg).toBeNull()
      expect(body.flow.nodes[1].strokeColor).toBeNull()
      expect(body.flow.nodes[1].dash).toBeNull()
      expect(body.flow.arrows[0].color).toBe('#E06060')
      expect(body.flow.arrows[0].dash).toBe('3,3')

      // Verify DB persistence
      const dbNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get('node-1') as {
        bg: string | null
        stroke_color: string | null
        dash: string | null
      }
      expect(dbNode.bg).toBe('#EEF5FF')
      expect(dbNode.stroke_color).toBe('#5080D0')
      expect(dbNode.dash).toBe('8,4')

      const dbArrow = db.prepare('SELECT * FROM arrows WHERE id = ?').get('arrow-1') as {
        color: string | null
        dash: string | null
      }
      expect(dbArrow.color).toBe('#E06060')
      expect(dbArrow.dash).toBe('3,3')

      // Verify GET returns styles
      const flowId = body.flow.id
      const getRes = await getWithCookie(`/api/flows/${flowId}`, env, cookie)
      const getBody = await getRes.json()
      expect(getBody.flow.nodes[0].bg).toBe('#EEF5FF')
      expect(getBody.flow.arrows[0].color).toBe('#E06060')
    })

    it('should round-trip bidirectional arrow flag', async () => {
      const payload = {
        title: 'Bidir Flow',
        themeId: 'cloud',
        lanes: [{ id: 'lane-1', name: 'L', colorIndex: 0, position: 0 }],
        nodes: [
          { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
          { id: 'node-2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
        ],
        arrows: [
          {
            id: 'arrow-1',
            fromNodeId: 'node-1',
            toNodeId: 'node-2',
            comment: null,
            bidirectional: true,
          },
          { id: 'arrow-2', fromNodeId: 'node-2', toNodeId: 'node-1', comment: null },
        ],
      }
      const createRes = await postJson('/api/flows', payload, env, cookie)
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()) as {
        flow: { id: string; arrows: Array<{ id: string; bidirectional?: boolean | null }> }
      }
      const a1 = created.flow.arrows.find((a) => a.id === 'arrow-1')
      const a2 = created.flow.arrows.find((a) => a.id === 'arrow-2')
      expect(a1?.bidirectional).toBe(true)
      expect(a2?.bidirectional ?? false).toBe(false)

      // GET should return the same value
      const getRes = await getWithCookie(`/api/flows/${created.flow.id}`, env, cookie)
      expect(getRes.status).toBe(200)
      const got = (await getRes.json()) as typeof created
      expect(got.flow.arrows.find((a) => a.id === 'arrow-1')?.bidirectional).toBe(true)
      expect(got.flow.arrows.find((a) => a.id === 'arrow-2')?.bidirectional ?? false).toBe(false)
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

    it('should persist updated node and arrow styles', async () => {
      const payload = {
        title: 'Styled Update',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
        nodes: [
          {
            id: 'node-new',
            laneId: 'lane-1',
            rowIndex: 0,
            label: 'Updated',
            note: null,
            orderIndex: 0,
            bg: '#FFF0EB',
            strokeColor: '#C06088',
            dash: '3,3',
          },
        ],
        arrows: [],
      }

      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.nodes[0].bg).toBe('#FFF0EB')
      expect(body.flow.nodes[0].strokeColor).toBe('#C06088')
      expect(body.flow.nodes[0].dash).toBe('3,3')
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

    it('should preserve existing lanes, nodes, arrows when only title is changed', async () => {
      // Add arrow to existing setup (beforeEach already inserts flow-1, lane-old, node-old)
      insertNode(db, 'node-old-2', 'flow-1', 'lane-old', 1, 'Old Task 2', null, 1)
      insertArrow(db, 'arrow-old', 'flow-1', 'node-old', 'node-old-2', 'Old connection')

      // Send only title update (no lanes/nodes/arrows in body)
      const res = await putJson('/api/flows/flow-1', { title: '新しいタイトル' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()

      // Verify title updated in response
      expect(body.flow.title).toBe('新しいタイトル')

      // Verify lanes/nodes/arrows are preserved in response
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.lanes[0].name).toBe('Old Lane')
      expect(body.flow.nodes).toHaveLength(2)
      expect(body.flow.nodes[0].label).toBe('Old Task')
      expect(body.flow.arrows).toHaveLength(1)
      expect(body.flow.arrows[0].comment).toBe('Old connection')

      // Verify DB-level preservation
      const dbLanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')
      expect(dbLanes).toHaveLength(1)

      const dbNodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')
      expect(dbNodes).toHaveLength(2)

      const dbArrows = db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')
      expect(dbArrows).toHaveLength(1)
    })

    it('should preserve existing lanes, nodes, arrows when only themeId is changed', async () => {
      // Add arrow to existing setup
      insertNode(db, 'node-old-2', 'flow-1', 'lane-old', 1, 'Old Task 2', null, 1)
      insertArrow(db, 'arrow-old', 'flow-1', 'node-old', 'node-old-2', 'Old connection')

      const res = await putJson('/api/flows/flow-1', { themeId: 'sunset' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()

      // Verify themeId updated
      expect(body.flow.themeId).toBe('sunset')

      // Verify original title preserved
      expect(body.flow.title).toBe('Original Title')

      // Verify lanes/nodes/arrows preserved
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.nodes).toHaveLength(2)
      expect(body.flow.arrows).toHaveLength(1)

      // DB-level check
      const dbLanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')
      expect(dbLanes).toHaveLength(1)

      const dbNodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')
      expect(dbNodes).toHaveLength(2)

      const dbArrows = db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')
      expect(dbArrows).toHaveLength(1)
    })

    it('should return 500 with error message when database save fails', async () => {
      // Drop lanes table to cause batch INSERT to fail when structural changes are sent
      // (checkFlowOwnership only uses flows table, so it passes)
      db.exec('DROP TABLE arrows; DROP TABLE nodes; DROP TABLE lanes;')

      const payload = {
        title: 'Will Fail',
        lanes: [{ id: 'lane-1', name: 'New Lane', colorIndex: 0, position: 0 }],
        nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'Task', orderIndex: 0 }],
        arrows: [],
      }

      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('フローの保存に失敗しました')
    })

    // ========================================
    // Partial structural data rejection
    // ========================================

    it('should return 400 when only lanes are provided without nodes and arrows', async () => {
      insertNode(db, 'node-old-2', 'flow-1', 'lane-old', 1, 'Task 2', null, 1)
      insertArrow(db, 'arrow-old', 'flow-1', 'node-old', 'node-old-2', 'Connection')

      const payload = {
        title: 'Partial Update',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
      }
      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('構造データ')

      // Verify existing data is preserved (not deleted)
      const dbNodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')
      expect(dbNodes).toHaveLength(2)
      const dbArrows = db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')
      expect(dbArrows).toHaveLength(1)
    })

    it('should return 400 when only nodes are provided without lanes', async () => {
      const payload = {
        title: 'Partial Update',
        nodes: [{ id: 'n1', laneId: 'lane-old', rowIndex: 0, label: 'Task', orderIndex: 0 }],
      }
      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 400 when lanes and nodes provided but arrows missing', async () => {
      const payload = {
        title: 'Partial Update',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
        nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'Task', orderIndex: 0 }],
      }
      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should accept full structural update with all three arrays', async () => {
      const payload = {
        title: 'Full Update',
        lanes: [{ id: 'lane-1', name: 'Lane', colorIndex: 0, position: 0 }],
        nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'Task', orderIndex: 0 }],
        arrows: [],
      }
      const res = await putJson('/api/flows/flow-1', payload, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.nodes).toHaveLength(1)
    })
  })

  // ========================================
  // DELETE /api/flows/:id (soft delete)
  // ========================================
  describe('DELETE /api/flows/:id (soft delete)', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'To Delete')
      insertLane(db, 'lane-1', 'flow-1', 'Lane', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task', null, 0)
      insertNode(db, 'node-2', 'flow-1', 'lane-1', 1, 'Task 2', null, 1)
      insertArrow(db, 'arrow-1', 'flow-1', 'node-1', 'node-2', null)
    })

    it('should soft-delete flow and return success message', async () => {
      const res = await deleteWithCookie('/api/flows/flow-1', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('フローをゴミ箱に移動しました')
    })

    it('should set deleted_at and clear share_token but keep related data', async () => {
      db.prepare('UPDATE flows SET share_token = ? WHERE id = ?').run('token-1', 'flow-1')

      await deleteWithCookie('/api/flows/flow-1', env, cookie)

      const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get('flow-1') as {
        deleted_at: string | null
        share_token: string | null
      }
      expect(flow.deleted_at).not.toBeNull()
      expect(flow.share_token).toBeNull()

      const lanes = db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')
      expect(lanes).toHaveLength(1)
      const nodes = db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')
      expect(nodes).toHaveLength(2)
      const arrows = db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')
      expect(arrows).toHaveLength(1)
    })

    it('should exclude soft-deleted flows from GET /api/flows', async () => {
      insertFlow(db, 'flow-2', USER_ID, 'Active Flow')
      await deleteWithCookie('/api/flows/flow-1', env, cookie)

      const res = await getWithCookie('/api/flows', env, cookie)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-2')
    })

    it('should return 404 for soft-deleted flow on GET /api/flows/:id', async () => {
      await deleteWithCookie('/api/flows/flow-1', env, cookie)
      const res = await getWithCookie('/api/flows/flow-1', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 404 for soft-deleted flow on PUT /api/flows/:id', async () => {
      await deleteWithCookie('/api/flows/flow-1', env, cookie)
      const res = await putJson('/api/flows/flow-1', { title: 'Updated' }, env, cookie)
      expect(res.status).toBe(404)
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

    it('should return 404 when re-deleting an already trashed flow', async () => {
      // First delete
      const res1 = await deleteWithCookie('/api/flows/flow-1', env, cookie)
      expect(res1.status).toBe(200)

      // Second delete should return 404
      const res2 = await deleteWithCookie('/api/flows/flow-1', env, cookie)
      expect(res2.status).toBe(404)
    })
  })

  // ========================================
  // GET /api/flows/trash (trash list)
  // ========================================
  describe('GET /api/flows/trash', () => {
    it('should return only soft-deleted flows', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Active')
      insertFlow(db, 'flow-2', USER_ID, 'Deleted')
      softDeleteFlow(db, 'flow-2')

      const res = await getWithCookie('/api/flows/trash', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-2')
      expect(body.flows[0].deletedAt).not.toBeNull()
    })

    it('should return empty array when no deleted flows', async () => {
      insertFlow(db, 'flow-1', USER_ID, 'Active')

      const res = await getWithCookie('/api/flows/trash', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(0)
    })

    it('should not return other users deleted flows', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Deleted')
      softDeleteFlow(db, 'flow-other')

      const res = await getWithCookie('/api/flows/trash', env, cookie)
      const body = await res.json()
      expect(body.flows).toHaveLength(0)
    })

    it('should return 401 without auth', async () => {
      const res = await getWithCookie('/api/flows/trash', env)
      expect(res.status).toBe(401)
    })
  })

  // ========================================
  // POST /api/flows/:id/restore
  // ========================================
  describe('POST /api/flows/:id/restore', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'Deleted Flow')
      softDeleteFlow(db, 'flow-1')
    })

    it('should restore soft-deleted flow', async () => {
      const res = await postJson('/api/flows/flow-1/restore', {}, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('フローを復元しました')

      const flow = db.prepare('SELECT deleted_at FROM flows WHERE id = ?').get('flow-1') as {
        deleted_at: string | null
      }
      expect(flow.deleted_at).toBeNull()
    })

    it('should make restored flow appear in GET /api/flows', async () => {
      await postJson('/api/flows/flow-1/restore', {}, env, cookie)

      const res = await getWithCookie('/api/flows', env, cookie)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].id).toBe('flow-1')
    })

    it('should return 404 with appropriate message for non-deleted (active) flow', async () => {
      insertFlow(db, 'flow-2', USER_ID, 'Active Flow')
      const res = await postJson('/api/flows/flow-2/restore', {}, env, cookie)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('このフローはゴミ箱にありません')
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await postJson('/api/flows/nonexistent/restore', {}, env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other')
      softDeleteFlow(db, 'flow-other')
      const res = await postJson('/api/flows/flow-other/restore', {}, env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      const res = await postJson('/api/flows/flow-1/restore', {}, env)
      expect(res.status).toBe(401)
    })
  })

  // ========================================
  // DELETE /api/flows/:id/permanent
  // ========================================
  describe('DELETE /api/flows/:id/permanent', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'To Permanently Delete')
      insertLane(db, 'lane-1', 'flow-1', 'Lane', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task', null, 0)
      insertArrow(db, 'arrow-1', 'flow-1', 'node-1', 'node-1', null)
      softDeleteFlow(db, 'flow-1')
    })

    it('should permanently delete flow and related data', async () => {
      const res = await deleteWithCookie('/api/flows/flow-1/permanent', env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('フローを完全に削除しました')

      expect(db.prepare('SELECT * FROM flows WHERE id = ?').all('flow-1')).toHaveLength(0)
      expect(db.prepare('SELECT * FROM lanes WHERE flow_id = ?').all('flow-1')).toHaveLength(0)
      expect(db.prepare('SELECT * FROM nodes WHERE flow_id = ?').all('flow-1')).toHaveLength(0)
      expect(db.prepare('SELECT * FROM arrows WHERE flow_id = ?').all('flow-1')).toHaveLength(0)
    })

    it('should return 404 for non-deleted flow (not in trash)', async () => {
      insertFlow(db, 'flow-2', USER_ID, 'Active Flow')
      const res = await deleteWithCookie('/api/flows/flow-2/permanent', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 404 for non-existent flow', async () => {
      const res = await deleteWithCookie('/api/flows/nonexistent/permanent', env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for another users flow', async () => {
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other')
      softDeleteFlow(db, 'flow-other')
      const res = await deleteWithCookie('/api/flows/flow-other/permanent', env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 401 without auth', async () => {
      const res = await deleteWithCookie('/api/flows/flow-1/permanent', env)
      expect(res.status).toBe(401)
    })
  })

  // ========================================
  // PUT /api/flows/:id/move
  // ========================================
  describe('PUT /:id/move', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', USER_ID, 'Movable Flow')
    })

    it('should return 400 when projectId is empty string', async () => {
      const res = await putJson('/api/flows/flow-1/move', { projectId: '' }, env, cookie)
      expect(res.status).toBe(400)
    })
  })

  // ========================================
  // Flow access via project membership (#306)
  // ========================================
  describe('Flow access via project membership', () => {
    const OWNER_ID = 'other-owner'
    const OWNER_EMAIL = 'other-owner@example.com'
    const FLOW_ID = 'shared-flow-1'
    const PROJECT_ID = 'shared-proj-1'
    let ownerCookie: string

    beforeEach(async () => {
      // OWNER_ID is a different user from OTHER_USER_ID registered in outer beforeEach
      db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
        OWNER_ID,
        OWNER_EMAIL,
        'hash',
        'Other Owner',
      )
      db.prepare("INSERT INTO projects (id, user_id, name) VALUES (?, ?, 'Shared P')").run(
        PROJECT_ID,
        OWNER_ID,
      )
      db.prepare(
        "INSERT INTO flows (id, user_id, title, project_id, theme_id) VALUES (?, ?, 'Shared Flow', ?, 'cloud')",
      ).run(FLOW_ID, OWNER_ID, PROJECT_ID)
      db.prepare(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'editor')",
      ).run(PROJECT_ID, USER_ID)
      ownerCookie = await authCookie(OWNER_ID, OWNER_EMAIL)
    })

    it('GET /flows/:id — editor can view shared flow', async () => {
      const res = await getWithCookie(`/api/flows/${FLOW_ID}`, env, cookie)
      expect(res.status).toBe(200)
    })

    it('PUT /flows/:id — editor can update shared flow', async () => {
      const res = await putJson(
        `/api/flows/${FLOW_ID}`,
        { title: 'Updated by Editor' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const row = db.prepare('SELECT title FROM flows WHERE id = ?').get(FLOW_ID) as {
        title: string
      }
      expect(row.title).toBe('Updated by Editor')
    })

    it('DELETE /flows/:id — editor CANNOT delete shared flow', async () => {
      const res = await deleteWithCookie(`/api/flows/${FLOW_ID}`, env, cookie)
      expect(res.status).toBe(403)
    })

    it('DELETE /flows/:id — owner CAN delete', async () => {
      const res = await deleteWithCookie(`/api/flows/${FLOW_ID}`, env, ownerCookie)
      expect(res.status).toBe(200)
    })

    it('GET /flows — editor sees shared flows alongside own flows', async () => {
      insertFlow(db, 'own-flow', USER_ID, 'Mine')
      const res = await getWithCookie('/api/flows', env, cookie)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { flows: Array<{ id: string }> }
      const ids = body.flows.map((f) => f.id)
      expect(ids).toContain('own-flow')
      expect(ids).toContain(FLOW_ID)
    })

    it('POST /flows with projectId — editor can create flow in shared project', async () => {
      const res = await postJson(
        '/api/flows',
        { title: 'New by Editor', projectId: PROJECT_ID },
        env,
        cookie,
      )
      expect(res.status).toBe(201)
    })

    it('POST /flows with projectId — non-member is rejected 403', async () => {
      db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(
        PROJECT_ID,
        USER_ID,
      )
      const res = await postJson('/api/flows', { title: 'New', projectId: PROJECT_ID }, env, cookie)
      expect(res.status).toBe(403)
    })

    it('POST /flows/:id/share — editor CANNOT create share token (owner only)', async () => {
      const res = await postJson(`/api/flows/${FLOW_ID}/share`, {}, env, cookie)
      expect(res.status).toBe(403)
    })

    it('GET /flows — owner sees editor-created flows in their project', async () => {
      // Editor (USER_ID) creates a flow inside OWNER_ID's project
      db.prepare(
        "INSERT INTO flows (id, user_id, title, project_id, theme_id) VALUES (?, ?, 'Editor-Created', ?, 'cloud')",
      ).run('editor-created', USER_ID, PROJECT_ID)

      const res = await getWithCookie('/api/flows', env, ownerCookie)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { flows: Array<{ id: string }> }
      const ids = body.flows.map((f) => f.id)
      expect(ids).toContain('editor-created')
      expect(ids).toContain(FLOW_ID)
    })

    it('GET /flows?q= — owner sees editor-created flows in their project via search', async () => {
      db.prepare(
        "INSERT INTO flows (id, user_id, title, project_id, theme_id) VALUES (?, ?, 'Editor-Searchable', ?, 'cloud')",
      ).run('editor-created-2', USER_ID, PROJECT_ID)

      const res = await getWithCookie('/api/flows?q=Searchable', env, ownerCookie)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { flows: Array<{ id: string }> }
      const ids = body.flows.map((f) => f.id)
      expect(ids).toContain('editor-created-2')
    })
  })
})
