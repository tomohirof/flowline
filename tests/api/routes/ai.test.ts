import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { createToken } from '../../../api/lib/jwt'

vi.mock('../../../api/lib/anthropic-client', () => ({
  createMessage: vi.fn().mockResolvedValue({
    content: [
      {
        type: 'tool_use',
        id: 'call_1',
        name: 'generate_flow',
        input: {
          title: 'テストフロー',
          lanes: [{ tempId: 'lane_0', name: '営業部', colorIndex: 0, position: 0 }],
          nodes: [
            {
              tempId: 'node_0',
              laneId: 'lane_0',
              rowIndex: 0,
              label: '開始',
              orderIndex: 0,
            },
          ],
          arrows: [],
        },
      },
    ],
  }),
}))

// Must import app AFTER vi.mock
const { app } = await import('../../../api/app')

const JWT_SECRET = 'test-secret-key'
const ANTHROPIC_API_KEY = 'test-anthropic-key'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return {
    FLOWLINE_DB: createMockD1(sqliteDb),
    JWT_SECRET,
    ANTHROPIC_API_KEY,
  }
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
  orderIndex: number,
) {
  db.prepare(
    'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, flowId, laneId, rowIndex, label, null, orderIndex)
}

function postJson(path: string, body: unknown, env: object, cookie?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
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

describe('AI API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  const AI_USER_ID = 'ai-user-1'
  const AI_USER_EMAIL = 'ai@example.com'
  const NORMAL_USER_ID = 'normal-user-1'
  const NORMAL_USER_EMAIL = 'normal@example.com'
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_USER_EMAIL = 'other@example.com'

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, AI_USER_ID, AI_USER_EMAIL, 1)
    registerUser(db, NORMAL_USER_ID, NORMAL_USER_EMAIL, 0)
    registerUser(db, OTHER_USER_ID, OTHER_USER_EMAIL, 1)
  })

  afterEach(() => {
    db.close()
  })

  // ========================================
  // POST /api/ai/generate
  // ========================================
  describe('POST /api/ai/generate', () => {
    it('should generate flow for ai_enabled=1 user', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson(
        '/api/ai/generate',
        { prompt: '営業プロセスを作って' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow).toBeDefined()
      expect(body.flow.title).toBe('テストフロー')
      expect(body.flow.lanes).toHaveLength(1)
      expect(body.flow.nodes).toHaveLength(1)
      // IDs should be real UUIDs, not temp IDs
      expect(body.flow.lanes[0].id).toBeDefined()
      expect(body.flow.lanes[0].id).not.toBe('lane_0')
      expect(body.flow.nodes[0].id).toBeDefined()
      expect(body.flow.nodes[0].id).not.toBe('node_0')
      // Node's laneId should reference the real lane UUID
      expect(body.flow.nodes[0].laneId).toBe(body.flow.lanes[0].id)
    })

    it('should return 403 for ai_enabled=0 user', async () => {
      const cookie = await authCookie(NORMAL_USER_ID, NORMAL_USER_EMAIL)
      const res = await postJson('/api/ai/generate', { prompt: 'テスト' }, env, cookie)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('AI機能')
    })

    it('should return 400 for empty prompt', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/generate', { prompt: '' }, env, cookie)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('プロンプト')
    })

    it('should return 400 for missing prompt', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/generate', {}, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 401 without auth', async () => {
      const res = await postJson('/api/ai/generate', { prompt: 'テスト' }, env)
      expect(res.status).toBe(401)
    })

    it('should return 400 for malformed JSON', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await app.request(
        '/api/ai/generate',
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

    it('should return 400 for prompt exceeding 2000 characters', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const longPrompt = 'あ'.repeat(2001)
      const res = await postJson('/api/ai/generate', { prompt: longPrompt }, env, cookie)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('2000')
    })

    it('should return model field in response', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson(
        '/api/ai/generate',
        { prompt: '営業プロセスを作って' },
        env,
        cookie,
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.model).toBeDefined()
      expect(body.model).toBe('claude-haiku-4-5-20251001')
    })
  })

  // ========================================
  // POST /api/ai/:flowId/edit
  // ========================================
  describe('POST /api/ai/:flowId/edit', () => {
    beforeEach(() => {
      insertFlow(db, 'flow-1', AI_USER_ID, 'Existing Flow')
      insertLane(db, 'lane-1', 'flow-1', 'Department A', 0, 0)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task 1', 0)
      insertFlow(db, 'flow-other', OTHER_USER_ID, 'Other Flow')
    })

    it('should edit flow for owner with ai_enabled=1', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: 'ノードを追加して' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flow).toBeDefined()
      expect(body.flow.title).toBeDefined()
    })

    it('should return 403 for other users flow', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-other/edit', { prompt: 'edit' }, env, cookie)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('アクセス権限')
    })

    it('should return 404 for non-existent flow', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/nonexistent/edit', { prompt: 'edit' }, env, cookie)
      expect(res.status).toBe(404)
    })

    it('should return 403 for ai_enabled=0 user', async () => {
      // Register normal user as owner of a flow
      insertFlow(db, 'flow-normal', NORMAL_USER_ID, 'Normal Flow')
      const cookie = await authCookie(NORMAL_USER_ID, NORMAL_USER_EMAIL)
      const res = await postJson('/api/ai/flow-normal/edit', { prompt: 'edit' }, env, cookie)
      expect(res.status).toBe(403)
    })

    it('should return 400 for empty prompt', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: '' }, env, cookie)
      expect(res.status).toBe(400)
    })

    it('should return 401 without auth', async () => {
      const res = await postJson('/api/ai/flow-1/edit', { prompt: 'edit' }, env)
      expect(res.status).toBe(401)
    })

    it('should return haiku model for flow with few nodes', async () => {
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: 'ノードを追加して' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.model).toBe('claude-haiku-4-5-20251001')
    })

    it('should return sonnet model for flow with many nodes', async () => {
      // Insert 10+ nodes to exceed threshold
      for (let i = 2; i <= 11; i++) {
        insertNode(db, `node-${i}`, 'flow-1', 'lane-1', i - 1, `Task ${i}`, 0)
      }
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: '整理して' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.model).toBe('claude-sonnet-4-6')
    })

    it('should return haiku model for flow with exactly threshold-1 nodes', async () => {
      // Insert nodes to reach 9 total (1 already exists from beforeEach)
      for (let i = 2; i <= 9; i++) {
        insertNode(db, `node-${i}`, 'flow-1', 'lane-1', i - 1, `Task ${i}`, 0)
      }
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: '整理して' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.model).toBe('claude-haiku-4-5-20251001')
    })

    it('should return sonnet model for flow with exactly threshold nodes', async () => {
      // Insert nodes to reach 10 total (1 already exists from beforeEach)
      for (let i = 2; i <= 10; i++) {
        insertNode(db, `node-${i}`, 'flow-1', 'lane-1', i - 1, `Task ${i}`, 0)
      }
      const cookie = await authCookie(AI_USER_ID, AI_USER_EMAIL)
      const res = await postJson('/api/ai/flow-1/edit', { prompt: '整理して' }, env, cookie)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.model).toBe('claude-sonnet-4-6')
    })
  })
})
