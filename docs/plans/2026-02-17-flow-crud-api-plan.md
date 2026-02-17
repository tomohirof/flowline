# フローCRUD API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** フローの作成・読み取り・更新・削除のREST APIを実装する

**Architecture:** Hono routeとして`/api/flows`配下に5エンドポイントを実装。既存の`authMiddleware`で認証を適用し、zodでバリデーション。D1の`batch()`でlanes/nodes/arrowsを一括保存。

**Tech Stack:** Hono, zod, D1 (Cloudflare), Vitest, better-sqlite3

---

### Task 1: zodインストールとバリデーションスキーマ作成

**Files:**
- Create: `api/lib/validators.ts`
- Modify: `package.json` (zod追加)

**Step 1: zodをインストール**

Run: `npm install zod`

**Step 2: バリデーションスキーマを作成**

`api/lib/validators.ts`:
```typescript
import { z } from 'zod'

const laneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colorIndex: z.number().int().min(0),
  position: z.number().int().min(0),
})

const nodeSchema = z.object({
  id: z.string().min(1),
  laneId: z.string().min(1),
  rowIndex: z.number().int().min(0),
  label: z.string().min(1),
  note: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0),
})

const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
})

export const createFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  lanes: z.array(laneSchema).optional().default([]),
  nodes: z.array(nodeSchema).optional().default([]),
  arrows: z.array(arrowSchema).optional().default([]),
})

export const updateFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  lanes: z.array(laneSchema).optional().default([]),
  nodes: z.array(nodeSchema).optional().default([]),
  arrows: z.array(arrowSchema).optional().default([]),
})

export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>
```

**Step 3: コミット**

```bash
git add package.json package-lock.json api/lib/validators.ts
git commit -m "chore: add zod and create flow validation schemas"
```

---

### Task 2: mock-d1にbatchメソッド追加

**Files:**
- Modify: `tests/helpers/mock-d1.ts`
- Test: `tests/helpers/mock-d1.test.ts`（既存テストが通ればOK）

**Step 1: mock-d1にbatchメソッドを追加**

`tests/helpers/mock-d1.ts`のcreateMockD1の返り値に追加:
```typescript
async batch(statements: Array<{ bind: (...params: unknown[]) => { run: () => Promise<unknown>; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }> } }>) {
  // D1のbatch()はトランザクション内で複数statementを実行する
  // better-sqlite3ではtransactionで包む
  const results: unknown[] = []
  const transaction = sqliteDb.transaction(() => {
    for (const stmt of statements) {
      // stmtはprepare().bind()の結果。内部でsqliteを実行
      // mock-d1のstatementオブジェクトのrun()を呼ぶ
      results.push(stmt)
    }
  })
  transaction()
  return results
}
```

実際のD1 batch APIを正確に模倣する必要がある。D1の`batch()`は`prepare().bind()`済みのstatementの配列を受け取り、各statementの結果を配列で返す。mock-d1の実装を以下のようにする:

`tests/helpers/mock-d1.ts`のcreateMockD1に`batch`メソッドを追加:
```typescript
async batch(preparedStatements: unknown[]) {
  const results: unknown[] = []
  const fn = sqliteDb.transaction(() => {
    for (const stmt of preparedStatements as Array<{ _sql: string; _params: unknown[] }>) {
      const s = sqliteDb.prepare(stmt._sql)
      try {
        const rows = s.all(...stmt._params)
        results.push({ results: rows, success: true, meta: {} })
      } catch {
        const r = s.run(...stmt._params)
        results.push({ success: true, meta: { changes: r.changes } })
      }
    }
  })
  fn()
  return results
},
```

これには内部のstatementオブジェクトに`_sql`と`_params`を保持する必要がある。statementオブジェクトを以下のように修正:

```typescript
prepare(sql: string) {
  let boundParams: unknown[] = []
  const statement = {
    _sql: sql,
    _params: boundParams,
    bind(...params: unknown[]) {
      boundParams = params
      statement._params = params
      return statement
    },
    // ... (既存のfirst, run, allはそのまま)
  }
  return statement
},
```

**Step 2: 既存テストが通ることを確認**

Run: `npm test`
Expected: 全テスト通過

**Step 3: コミット**

```bash
git add tests/helpers/mock-d1.ts
git commit -m "feat: add batch() method to mock-d1 for transaction support"
```

---

### Task 3: フロー一覧取得 GET /api/flows（TDD）

**Files:**
- Create: `api/routes/flows.ts`
- Modify: `api/app.ts`（ルートマウント）
- Create: `tests/api/routes/flows.test.ts`

**Step 1: テストファイル作成（失敗するテスト）**

`tests/api/routes/flows.test.ts`:
```typescript
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
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
    .run(id, email, 'hash', 'Test User')
}

function insertFlow(db: ReturnType<typeof Database>, id: string, userId: string, title: string) {
  db.prepare('INSERT INTO flows (id, user_id, title, theme_id) VALUES (?, ?, ?, ?)')
    .run(id, userId, title, 'cloud')
}

describe('Flow API', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('GET /api/flows', () => {
    it('should return empty array when user has no flows', async () => {
      registerUser(db, 'user1', 'test@example.com')
      const cookie = await authCookie('user1', 'test@example.com')

      const res = await app.request('/api/flows', {
        headers: { Cookie: cookie },
      }, env)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toEqual([])
    })

    it('should return only the current user flows', async () => {
      registerUser(db, 'user1', 'user1@example.com')
      registerUser(db, 'user2', 'user2@example.com')
      insertFlow(db, 'flow1', 'user1', 'My Flow')
      insertFlow(db, 'flow2', 'user2', 'Other Flow')

      const cookie = await authCookie('user1', 'user1@example.com')
      const res = await app.request('/api/flows', {
        headers: { Cookie: cookie },
      }, env)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flows).toHaveLength(1)
      expect(body.flows[0].title).toBe('My Flow')
    })

    it('should return 401 without auth', async () => {
      const res = await app.request('/api/flows', {}, env)
      expect(res.status).toBe(401)
    })
  })
})
```

**Step 2: テスト失敗を確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: FAIL（ルートが存在しない）

**Step 3: 最小限の実装**

`api/routes/flows.ts`:
```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AuthEnv } from '../app'

const flows = new Hono<AuthEnv>()

flows.use('*', authMiddleware)

flows.get('/', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, title, theme_id, share_token, created_at, updated_at FROM flows WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all()

  return c.json({ flows: results.map((f: Record<string, unknown>) => ({
    id: f.id,
    title: f.title,
    themeId: f.theme_id,
    shareToken: f.share_token,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  })) })
})

export { flows }
```

`api/app.ts`に追加:
```typescript
import { flows } from './routes/flows'
// ... 既存コードの後に
app.route('/flows', flows)
```

**Step 4: テスト通過を確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: PASS

**Step 5: コミット**

```bash
git add api/routes/flows.ts api/app.ts tests/api/routes/flows.test.ts
git commit -m "feat: add GET /api/flows endpoint for listing user flows"
```

---

### Task 4: フロー作成 POST /api/flows（TDD）

**Files:**
- Modify: `api/routes/flows.ts`
- Modify: `tests/api/routes/flows.test.ts`

**Step 1: テスト追加（失敗するテスト）**

`tests/api/routes/flows.test.ts`のdescribeブロック内に追加:
```typescript
describe('POST /api/flows', () => {
  it('should create a flow with title only', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '業務フロー' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.flow.title).toBe('業務フロー')
    expect(body.flow.id).toBeDefined()
    expect(body.flow.lanes).toEqual([])
    expect(body.flow.nodes).toEqual([])
    expect(body.flow.arrows).toEqual([])
  })

  it('should create a flow with lanes, nodes, and arrows', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: '業務フロー',
        themeId: 'modern',
        lanes: [{ id: 'lane1', name: '企業', colorIndex: 0, position: 0 }],
        nodes: [
          { id: 'node1', laneId: 'lane1', rowIndex: 0, label: '申請', note: null, orderIndex: 0 },
          { id: 'node2', laneId: 'lane1', rowIndex: 1, label: '承認', note: 'メモ', orderIndex: 1 },
        ],
        arrows: [{ id: 'arr1', fromNodeId: 'node1', toNodeId: 'node2', comment: '' }],
      }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.flow.title).toBe('業務フロー')
    expect(body.flow.themeId).toBe('modern')
    expect(body.flow.lanes).toHaveLength(1)
    expect(body.flow.nodes).toHaveLength(2)
    expect(body.flow.arrows).toHaveLength(1)
  })

  it('should use default title and theme when not provided', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.flow.title).toBe('無題のフロー')
    expect(body.flow.themeId).toBe('cloud')
  })

  it('should return 400 for invalid request body', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '' }),
    }, env)

    expect(res.status).toBe(400)
  })

  it('should return 400 for malformed JSON', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: 'not json',
    }, env)

    expect(res.status).toBe(400)
  })

  it('should return 401 without auth', async () => {
    const res = await app.request('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test' }),
    }, env)

    expect(res.status).toBe(401)
  })
})
```

**Step 2: テスト失敗確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: POST関連テストがFAIL

**Step 3: 実装**

`api/routes/flows.ts`に追加:
```typescript
import { generateId } from '../lib/id'
import { createFlowSchema } from '../lib/validators'

flows.post('/', async (c) => {
  const userId = c.get('userId')

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  const parsed = createFlowSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }

  const input = parsed.data
  const flowId = generateId()
  const title = input.title ?? '無題のフロー'
  const themeId = input.themeId ?? 'cloud'

  // flowを挿入
  await c.env.FLOWLINE_DB.prepare(
    'INSERT INTO flows (id, user_id, title, theme_id) VALUES (?, ?, ?, ?)'
  ).bind(flowId, userId, title, themeId).run()

  // lanes/nodes/arrowsをバッチ挿入
  const statements = []

  for (const lane of input.lanes) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)'
      ).bind(lane.id, flowId, lane.name, lane.colorIndex, lane.position)
    )
  }

  for (const node of input.nodes) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(node.id, flowId, node.laneId, node.rowIndex, node.label, node.note ?? null, node.orderIndex)
    )
  }

  for (const arrow of input.arrows) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)'
      ).bind(arrow.id, flowId, arrow.fromNodeId, arrow.toNodeId, arrow.comment ?? null)
    )
  }

  if (statements.length > 0) {
    await c.env.FLOWLINE_DB.batch(statements)
  }

  // 作成したフローを返す
  return c.json({ flow: await getFlowDetail(c.env.FLOWLINE_DB, flowId) }, 201)
})
```

`getFlowDetail`ヘルパー関数を同ファイルに追加:
```typescript
async function getFlowDetail(db: D1Database, flowId: string) {
  const flow = await db.prepare(
    'SELECT id, user_id, title, theme_id, share_token, created_at, updated_at FROM flows WHERE id = ?'
  ).bind(flowId).first<Record<string, unknown>>()

  if (!flow) return null

  const { results: lanes } = await db.prepare(
    'SELECT id, name, color_index, position, created_at, updated_at FROM lanes WHERE flow_id = ? ORDER BY position'
  ).bind(flowId).all()

  const { results: nodes } = await db.prepare(
    'SELECT id, lane_id, row_index, label, note, order_index, created_at, updated_at FROM nodes WHERE flow_id = ? ORDER BY order_index'
  ).bind(flowId).all()

  const { results: arrows } = await db.prepare(
    'SELECT id, from_node_id, to_node_id, comment, created_at, updated_at FROM arrows WHERE flow_id = ?'
  ).bind(flowId).all()

  return {
    id: flow.id,
    title: flow.title,
    themeId: flow.theme_id,
    shareToken: flow.share_token,
    createdAt: flow.created_at,
    updatedAt: flow.updated_at,
    lanes: (lanes as Record<string, unknown>[]).map(l => ({
      id: l.id, name: l.name, colorIndex: l.color_index, position: l.position,
      createdAt: l.created_at, updatedAt: l.updated_at,
    })),
    nodes: (nodes as Record<string, unknown>[]).map(n => ({
      id: n.id, laneId: n.lane_id, rowIndex: n.row_index, label: n.label,
      note: n.note, orderIndex: n.order_index, createdAt: n.created_at, updatedAt: n.updated_at,
    })),
    arrows: (arrows as Record<string, unknown>[]).map(a => ({
      id: a.id, fromNodeId: a.from_node_id, toNodeId: a.to_node_id,
      comment: a.comment, createdAt: a.created_at, updatedAt: a.updated_at,
    })),
  }
}
```

注: `D1Database`型はHonoのBindingsから取得可能。`getFlowDetail`のdb引数の型は`AuthEnv['Bindings']['FLOWLINE_DB']`として定義するか、`any`で実装してから型を整える。

**Step 4: テスト通過を確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: PASS

**Step 5: コミット**

```bash
git add api/routes/flows.ts api/lib/validators.ts tests/api/routes/flows.test.ts
git commit -m "feat: add POST /api/flows endpoint for creating flows"
```

---

### Task 5: フロー詳細取得 GET /api/flows/:id（TDD）

**Files:**
- Modify: `api/routes/flows.ts`
- Modify: `tests/api/routes/flows.test.ts`

**Step 1: テスト追加**

```typescript
describe('GET /api/flows/:id', () => {
  it('should return flow with lanes, nodes, and arrows', async () => {
    registerUser(db, 'user1', 'test@example.com')
    insertFlow(db, 'flow1', 'user1', '業務フロー')
    db.prepare('INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)')
      .run('lane1', 'flow1', '企業', 0, 0)
    db.prepare('INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('node1', 'flow1', 'lane1', 0, '申請', null, 0)

    const cookie = await authCookie('user1', 'test@example.com')
    const res = await app.request('/api/flows/flow1', {
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.flow.title).toBe('業務フロー')
    expect(body.flow.lanes).toHaveLength(1)
    expect(body.flow.nodes).toHaveLength(1)
    expect(body.flow.lanes[0].name).toBe('企業')
  })

  it('should return 404 for non-existent flow', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows/nonexistent', {
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(404)
  })

  it('should return 403 for other user flow', async () => {
    registerUser(db, 'user1', 'user1@example.com')
    registerUser(db, 'user2', 'user2@example.com')
    insertFlow(db, 'flow1', 'user2', 'Other Flow')

    const cookie = await authCookie('user1', 'user1@example.com')
    const res = await app.request('/api/flows/flow1', {
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(403)
  })

  it('should return 401 without auth', async () => {
    const res = await app.request('/api/flows/flow1', {}, env)
    expect(res.status).toBe(401)
  })
})
```

**Step 2: テスト失敗確認**

**Step 3: 実装**

```typescript
flows.get('/:id', async (c) => {
  const userId = c.get('userId')
  const flowId = c.req.param('id')

  const flow = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, user_id FROM flows WHERE id = ?'
  ).bind(flowId).first<{ id: string; user_id: string }>()

  if (!flow) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }

  if (flow.user_id !== userId) {
    return c.json({ error: 'このフローへのアクセス権がありません' }, 403)
  }

  const detail = await getFlowDetail(c.env.FLOWLINE_DB, flowId)
  return c.json({ flow: detail })
})
```

**Step 4: テスト通過確認**
**Step 5: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat: add GET /api/flows/:id endpoint for flow detail"
```

---

### Task 6: フロー更新 PUT /api/flows/:id（TDD）

**Files:**
- Modify: `api/routes/flows.ts`
- Modify: `tests/api/routes/flows.test.ts`

**Step 1: テスト追加**

```typescript
describe('PUT /api/flows/:id', () => {
  it('should update flow title and theme', async () => {
    registerUser(db, 'user1', 'test@example.com')
    insertFlow(db, 'flow1', 'user1', '旧タイトル')

    const cookie = await authCookie('user1', 'test@example.com')
    const res = await app.request('/api/flows/flow1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '新タイトル', themeId: 'modern' }),
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.flow.title).toBe('新タイトル')
    expect(body.flow.themeId).toBe('modern')
  })

  it('should replace lanes, nodes, and arrows on update', async () => {
    registerUser(db, 'user1', 'test@example.com')
    insertFlow(db, 'flow1', 'user1', 'フロー')
    db.prepare('INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)')
      .run('old-lane', 'flow1', '古いレーン', 0, 0)

    const cookie = await authCookie('user1', 'test@example.com')
    const res = await app.request('/api/flows/flow1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'フロー',
        lanes: [{ id: 'new-lane', name: '新しいレーン', colorIndex: 1, position: 0 }],
      }),
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.flow.lanes).toHaveLength(1)
    expect(body.flow.lanes[0].id).toBe('new-lane')
    expect(body.flow.lanes[0].name).toBe('新しいレーン')

    // 古いレーンがDBから消えていることを確認
    const oldLane = db.prepare('SELECT id FROM lanes WHERE id = ?').get('old-lane')
    expect(oldLane).toBeUndefined()
  })

  it('should return 404 for non-existent flow', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'test' }),
    }, env)

    expect(res.status).toBe(404)
  })

  it('should return 403 for other user flow', async () => {
    registerUser(db, 'user1', 'user1@example.com')
    registerUser(db, 'user2', 'user2@example.com')
    insertFlow(db, 'flow1', 'user2', 'Other')

    const cookie = await authCookie('user1', 'user1@example.com')
    const res = await app.request('/api/flows/flow1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'hijack' }),
    }, env)

    expect(res.status).toBe(403)
  })

  it('should return 400 for invalid body', async () => {
    registerUser(db, 'user1', 'test@example.com')
    insertFlow(db, 'flow1', 'user1', 'フロー')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows/flow1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '' }),
    }, env)

    expect(res.status).toBe(400)
  })
})
```

**Step 2: テスト失敗確認**

**Step 3: 実装**

```typescript
flows.put('/:id', async (c) => {
  const userId = c.get('userId')
  const flowId = c.req.param('id')

  const flow = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, user_id FROM flows WHERE id = ?'
  ).bind(flowId).first<{ id: string; user_id: string }>()

  if (!flow) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (flow.user_id !== userId) {
    return c.json({ error: 'このフローへのアクセス権がありません' }, 403)
  }

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  const parsed = updateFlowSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }

  const input = parsed.data
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  // 既存のlanes/nodes/arrowsを削除してから再挿入
  const statements = []

  // 子テーブルを削除（arrowsはnodes依存なので先に削除）
  statements.push(
    c.env.FLOWLINE_DB.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId)
  )
  statements.push(
    c.env.FLOWLINE_DB.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId)
  )
  statements.push(
    c.env.FLOWLINE_DB.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId)
  )

  // flow本体を更新
  if (input.title || input.themeId) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'UPDATE flows SET title = COALESCE(?, title), theme_id = COALESCE(?, theme_id), updated_at = ? WHERE id = ?'
      ).bind(input.title ?? null, input.themeId ?? null, now, flowId)
    )
  }

  // 再挿入
  for (const lane of input.lanes) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)'
      ).bind(lane.id, flowId, lane.name, lane.colorIndex, lane.position)
    )
  }

  for (const node of input.nodes) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(node.id, flowId, node.laneId, node.rowIndex, node.label, node.note ?? null, node.orderIndex)
    )
  }

  for (const arrow of input.arrows) {
    statements.push(
      c.env.FLOWLINE_DB.prepare(
        'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)'
      ).bind(arrow.id, flowId, arrow.fromNodeId, arrow.toNodeId, arrow.comment ?? null)
    )
  }

  await c.env.FLOWLINE_DB.batch(statements)

  const detail = await getFlowDetail(c.env.FLOWLINE_DB, flowId)
  return c.json({ flow: detail })
})
```

**Step 4: テスト通過確認**
**Step 5: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat: add PUT /api/flows/:id endpoint for updating flows"
```

---

### Task 7: フロー削除 DELETE /api/flows/:id（TDD）

**Files:**
- Modify: `api/routes/flows.ts`
- Modify: `tests/api/routes/flows.test.ts`

**Step 1: テスト追加**

```typescript
describe('DELETE /api/flows/:id', () => {
  it('should delete flow and cascade to lanes/nodes/arrows', async () => {
    registerUser(db, 'user1', 'test@example.com')
    insertFlow(db, 'flow1', 'user1', 'フロー')
    db.prepare('INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)')
      .run('lane1', 'flow1', 'レーン', 0, 0)
    db.prepare('INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('node1', 'flow1', 'lane1', 0, 'ノード', null, 0)

    const cookie = await authCookie('user1', 'test@example.com')
    const res = await app.request('/api/flows/flow1', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBeDefined()

    // DBからも消えていることを確認
    const flow = db.prepare('SELECT id FROM flows WHERE id = ?').get('flow1')
    expect(flow).toBeUndefined()
    const lane = db.prepare('SELECT id FROM lanes WHERE flow_id = ?').get('flow1')
    expect(lane).toBeUndefined()
    const node = db.prepare('SELECT id FROM nodes WHERE flow_id = ?').get('flow1')
    expect(node).toBeUndefined()
  })

  it('should return 404 for non-existent flow', async () => {
    registerUser(db, 'user1', 'test@example.com')
    const cookie = await authCookie('user1', 'test@example.com')

    const res = await app.request('/api/flows/nonexistent', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(404)
  })

  it('should return 403 for other user flow', async () => {
    registerUser(db, 'user1', 'user1@example.com')
    registerUser(db, 'user2', 'user2@example.com')
    insertFlow(db, 'flow1', 'user2', 'Other Flow')

    const cookie = await authCookie('user1', 'user1@example.com')
    const res = await app.request('/api/flows/flow1', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    }, env)

    expect(res.status).toBe(403)
  })
})
```

**Step 2: テスト失敗確認**

**Step 3: 実装**

```typescript
flows.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const flowId = c.req.param('id')

  const flow = await c.env.FLOWLINE_DB.prepare(
    'SELECT id, user_id FROM flows WHERE id = ?'
  ).bind(flowId).first<{ id: string; user_id: string }>()

  if (!flow) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (flow.user_id !== userId) {
    return c.json({ error: 'このフローへのアクセス権がありません' }, 403)
  }

  await c.env.FLOWLINE_DB.prepare('DELETE FROM flows WHERE id = ?')
    .bind(flowId).run()

  return c.json({ message: 'フローを削除しました' })
})
```

**Step 4: テスト通過確認**
**Step 5: 全テスト通過確認**

Run: `npm test`
Expected: 全テストPASS

**Step 6: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat: add DELETE /api/flows/:id endpoint"
```

---

### Task 8: ブラウザ検証とPR作成

**Step 1: devサーバーを起動しAPIが動作することを確認**

```bash
npm run db:migrate
npm run dev
```

curlまたはブラウザで:
- ログイン → Cookieを取得
- POST /api/flows でフロー作成
- GET /api/flows で一覧取得
- GET /api/flows/:id で詳細取得
- PUT /api/flows/:id で更新
- DELETE /api/flows/:id で削除

**Step 2: PR作成**

```bash
git push -u origin feat/flow-crud
gh pr create --title "feat: フローCRUD API実装 (#4)" --body "..."
```
