# ソフトデリート + ゴミ箱機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** フロー削除を物理削除からソフトデリートに変更し、ダッシュボードにゴミ箱ビューを追加して削除済みフローの復元・完全削除を可能にする

**Architecture:** DBに`deleted_at`カラムを追加し、既存DELETEエンドポイントをUPDATEに変更。新規にtrash/restore/permanentエンドポイントを追加。フロントエンドはDashboard内のナビ切り替えでゴミ箱ビューを表示し、FlowCard/FlowContextMenuをゴミ箱モード対応に拡張。

**Tech Stack:** Hono, D1(SQLite), React, TypeScript, Vitest, @testing-library/react

---

### Task 1: DBマイグレーション + テストヘルパー更新

**Files:**
- Create: `migrations/0005_soft_delete.sql`
- Modify: `tests/helpers/mock-d1.ts:8-13`

**Step 1: マイグレーションファイルを作成**

`migrations/0005_soft_delete.sql`:

```sql
ALTER TABLE flows ADD COLUMN deleted_at TEXT DEFAULT NULL;
```

**Step 2: テストヘルパーにマイグレーションを追加**

`tests/helpers/mock-d1.ts` L8-13のmigrationFiles配列に追加:

```typescript
  const migrationFiles = [
    '0001_initial.sql',
    '0002_node_arrow_styles.sql',
    '0003_user_settings.sql',
    '0004_email_verification.sql',
    '0005_soft_delete.sql',
  ]
```

**Step 3: 既存テストが全パスすることを確認**

Run: `npm test`
Expected: ALL PASS

**Step 4: コミット**

```bash
git add migrations/0005_soft_delete.sql tests/helpers/mock-d1.ts
git commit -m "feat: deleted_atカラム追加マイグレーション + テストヘルパー更新"
```

---

### Task 2: APIバックエンド — ソフトデリート + 既存エンドポイント修正（テスト）

**Files:**
- Modify: `tests/api/routes/flows.test.ts:761-819`
- Modify: `api/routes/flows.ts:69-81,180-195,409-431`
- Modify: `api/lib/flow-transform.ts:6-14,53-62`

**Step 1: FlowRow型とtoFlowSummaryにdeleted_atを追加**

`api/lib/flow-transform.ts` L6-14のFlowRowに追加:

```typescript
export interface FlowRow {
  id: string
  user_id: string
  title: string
  theme_id: string
  share_token: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}
```

`api/lib/flow-transform.ts` L53-62のtoFlowSummaryに追加:

```typescript
export function toFlowSummary(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    shareToken: row.share_token,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Step 2: 既存DELETEテストをソフトデリート用に書き換え**

`tests/api/routes/flows.test.ts` の `describe('DELETE /api/flows/:id')` (L761-819) を以下に置換:

```typescript
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
      // Set share_token first
      db.prepare('UPDATE flows SET share_token = ? WHERE id = ?').run('token-1', 'flow-1')

      await deleteWithCookie('/api/flows/flow-1', env, cookie)

      const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get('flow-1') as {
        deleted_at: string | null
        share_token: string | null
      }
      expect(flow.deleted_at).not.toBeNull()
      expect(flow.share_token).toBeNull()

      // Related data should still exist
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
  })
```

**Step 3: テストが失敗することを確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: FAIL — メッセージが「フローを削除しました」、deleted_atがnull、フローが物理削除される

**Step 4: GET /api/flowsにdeleted_at IS NULLを追加**

`api/routes/flows.ts` L73-74を変更:

```typescript
  const result = await db
    .prepare('SELECT * FROM flows WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC')
    .bind(userId)
    .all<FlowRow>()
```

**Step 5: GET /api/flows/:idに削除済みチェックを追加**

`api/routes/flows.ts` L180-195のGET /:idハンドラーを変更。`checkFlowOwnership`の後に削除済みチェックを追加:

```typescript
flows.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // Check if soft-deleted
  const flowCheck = await db
    .prepare('SELECT deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ deleted_at: string | null }>()
  if (flowCheck?.deleted_at) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }

  const detail = await getFlowDetail(db, flowId)
  return c.json({ flow: detail })
})
```

**Step 6: PUT /api/flows/:idに削除済みチェックを追加**

`api/routes/flows.ts` L201-213の`checkFlowOwnership`の後に同じ削除済みチェックを追加:

```typescript
  // Check if soft-deleted
  const flowCheck = await db
    .prepare('SELECT deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ deleted_at: string | null }>()
  if (flowCheck?.deleted_at) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
```

**Step 7: DELETE /api/flows/:idをソフトデリートに変更**

`api/routes/flows.ts` L409-431を変更:

```typescript
flows.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // Soft delete: set deleted_at, clear share_token
  await db
    .prepare(
      "UPDATE flows SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), share_token = NULL WHERE id = ?",
    )
    .bind(flowId)
    .run()

  return c.json({ message: 'フローをゴミ箱に移動しました' })
})
```

**Step 8: テストがパスすることを確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: PASS

**Step 9: コミット**

```bash
git add api/routes/flows.ts api/lib/flow-transform.ts tests/api/routes/flows.test.ts
git commit -m "feat: ソフトデリート実装 — DELETE→UPDATE, 既存エンドポイントにdeleted_atフィルター追加"
```

---

### Task 3: APIバックエンド — trash/restore/permanentエンドポイント（テスト）

**Files:**
- Modify: `tests/api/routes/flows.test.ts`
- Modify: `api/routes/flows.ts`

**Step 1: テストヘルパー関数を追加**

`tests/api/routes/flows.test.ts`のヘルパー関数エリア（L75の後）に追加:

```typescript
function softDeleteFlow(db: ReturnType<typeof Database>, flowId: string) {
  db.prepare("UPDATE flows SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(
    flowId,
  )
}
```

**Step 2: trash/restore/permanentのテストを追加**

`tests/api/routes/flows.test.ts`のDELETEテストの後（`describe('DELETE /api/flows/:id')` の閉じカッコの後）に追加:

```typescript
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

    it('should return 404 for non-deleted flow', async () => {
      insertFlow(db, 'flow-2', USER_ID, 'Active Flow')
      const res = await postJson('/api/flows/flow-2/restore', {}, env, cookie)
      expect(res.status).toBe(404)
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
```

**Step 3: テストが失敗することを確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: FAIL — trash/restore/permanentエンドポイントが存在しない

**Step 4: GET /api/flows/trashエンドポイントを追加**

`api/routes/flows.ts`のGET /（L69-81）の直後に追加:

```typescript
// =============================================
// GET /trash - List user's deleted flows
// =============================================

flows.get('/trash', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  const result = await db
    .prepare(
      'SELECT * FROM flows WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
    )
    .bind(userId)
    .all<FlowRow>()

  const flowList = (result.results ?? []).map(toFlowSummary)

  return c.json({ flows: flowList })
})
```

**重要**: このルートは `GET /:id` より**前**に配置すること（Honoは上から順にマッチするため、`/trash`が`:id`パラメータとして解釈されないようにする）。

**Step 5: POST /:id/restoreエンドポイントを追加**

`api/routes/flows.ts`のDELETE /:id/shareの後、DELETE /:idの前に追加:

```typescript
// =============================================
// POST /:id/restore - Restore soft-deleted flow
// =============================================

flows.post('/:id/restore', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // Only restore if actually deleted
  const flow = await db
    .prepare('SELECT deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ deleted_at: string | null }>()
  if (!flow?.deleted_at) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }

  await db.prepare('UPDATE flows SET deleted_at = NULL WHERE id = ?').bind(flowId).run()

  return c.json({ message: 'フローを復元しました' })
})
```

**Step 6: DELETE /:id/permanentエンドポイントを追加**

DELETE /:id/shareの後、POST /:id/restoreの後に追加（DELETE /:idより前）:

```typescript
// =============================================
// DELETE /:id/permanent - Permanently delete flow
// =============================================

flows.delete('/:id/permanent', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // Only permanently delete if in trash
  const flow = await db
    .prepare('SELECT deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ deleted_at: string | null }>()
  if (!flow?.deleted_at) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }

  await db.batch([
    db.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM flows WHERE id = ?').bind(flowId),
  ])

  return c.json({ message: 'フローを完全に削除しました' })
})
```

**重要ルート順序**: `/trash`, `/:id/share`, `/:id/restore`, `/:id/permanent` は全て `/:id` より**前**に配置すること。

**Step 7: テストがパスすることを確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: PASS

**Step 8: 全テスト実行**

Run: `npm test`
Expected: ALL PASS

**Step 9: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat: trash/restore/permanentエンドポイント追加"
```

---

### Task 4: フロントエンド型定義 + API呼び出し

**Files:**
- Modify: `src/features/editor/types.ts:105-116`

**Step 1: FlowSummaryにdeletedAtを追加**

`src/features/editor/types.ts` L105-116を変更:

```typescript
export interface FlowSummary {
  id: string
  title: string
  themeId: string
  shareToken: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
```

**Step 2: 全テスト実行（型エラーがないか確認）**

Run: `npm test`
Expected: ALL PASS

**Step 3: コミット**

```bash
git add src/features/editor/types.ts
git commit -m "feat: FlowSummary型にdeletedAtフィールド追加"
```

---

### Task 5: ダッシュボードのゴミ箱ナビ＋ビュー切り替え（テスト）

**Files:**
- Modify: `src/features/dashboard/Dashboard.test.tsx`
- Modify: `src/features/dashboard/Dashboard.tsx:37,50-61,112-125,260,306-330`

**Step 1: ゴミ箱関連のテストを追加**

`src/features/dashboard/Dashboard.test.tsx`の末尾に追加:

```typescript
describe('trash view (#95)', () => {
  it('should load trash flows when trash nav is selected', async () => {
    const trashFlows = [
      {
        id: 'flow-deleted',
        title: '削除済みフロー',
        themeId: 'cloud',
        shareToken: null,
        deletedAt: '2026-02-20T10:00:00Z',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-15T10:00:00Z',
      },
    ]
    mockApiFetch.mockResolvedValueOnce({ flows: [] }) // initial load
    mockApiFetch.mockResolvedValueOnce({ flows: trashFlows }) // trash load

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument()
    })

    // Click trash nav
    const trashNav = screen.getByTestId('nav-item-trash')
    await userEvent.click(trashNav)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/trash')
    })
  })

  it('should show trash empty state when no deleted flows', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] }) // initial load
    mockApiFetch.mockResolvedValueOnce({ flows: [] }) // trash load

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument()
    })

    const trashNav = screen.getByTestId('nav-item-trash')
    await userEvent.click(trashNav)

    await waitFor(() => {
      expect(screen.getByTestId('trash-empty')).toBeInTheDocument()
    })
  })

  it('should show trash title when in trash view', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument()
    })

    const trashNav = screen.getByTestId('nav-item-trash')
    await userEvent.click(trashNav)

    await waitFor(() => {
      expect(screen.getByText('ゴミ箱')).toBeInTheDocument()
    })
  })
})
```

**Step 2: テストが失敗することを確認**

Run: `npx vitest run src/features/dashboard/Dashboard.test.tsx`
Expected: FAIL — `/flows/trash`が呼ばれない、trash-emptyが存在しない

**Step 3: Dashboard.tsxにゴミ箱ビュー機能を追加**

`src/features/dashboard/Dashboard.tsx`に以下の変更を加える:

**3a. トラッシュフロー用state追加** (L26の後):

```typescript
  const [trashFlows, setTrashFlows] = useState<FlowSummary[]>([])
```

**3b. loadTrashFlows関数追加** (loadFlowsの後):

```typescript
  const loadTrashFlows = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<FlowListResponse>('/flows/trash')
      setTrashFlows(data.flows)
    } catch {
      setError('ゴミ箱の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])
```

**3c. selectedNavの変更時にゴミ箱を読み込む** (useEffectの後に追加):

```typescript
  useEffect(() => {
    if (selectedNav === 'trash') {
      loadTrashFlows()
    }
  }, [selectedNav, loadTrashFlows])
```

**3d. handleDelete内の確認メッセージ変更** (L114):

```typescript
    if (!window.confirm(`「${title}」をゴミ箱に移動しますか？`)) return
```

**3e. handleRestore関数追加** (handleDeleteの後):

```typescript
  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/flows/${id}/restore`, { method: 'POST' })
      setTrashFlows((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('フローの復元に失敗しました')
    }
  }

  const handlePermanentDelete = async (id: string, title: string) => {
    if (!window.confirm(`「${title}」を完全に削除しますか？この操作は取り消せません。`)) return
    try {
      await apiFetch(`/flows/${id}/permanent`, { method: 'DELETE' })
      setTrashFlows((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('フローの完全削除に失敗しました')
    }
  }
```

**3f. タイトルをゴミ箱ビューで切り替え** (L260の`<h1>`):

```tsx
            <h1 className={styles.title}>
              {selectedNav === 'trash' ? 'ゴミ箱' : 'マイフロー'}
            </h1>
```

**3g. ゴミ箱ビューのレンダリング** — `{/* Content */}`セクション(L301)の`loading ?`分岐の後、`filteredAndSortedFlows.length === 0`の前に、ゴミ箱ビューの分岐を追加:

loadingチェックの後に `selectedNav === 'trash'` 分岐を挿入。全体の条件分岐を再構成:

```tsx
          {loading ? (
            <div data-testid="dashboard-loading" className={styles.loading}>
              <p className={styles.loadingText}>読み込み中...</p>
            </div>
          ) : selectedNav === 'trash' ? (
            trashFlows.length === 0 ? (
              <div data-testid="trash-empty" className={styles.empty}>
                <div className={styles.emptyIcon}>▢</div>
                <p className={styles.emptyTitle}>ゴミ箱は空です</p>
                <p className={styles.emptySubtitle}>
                  削除したフローはここに表示されます
                </p>
              </div>
            ) : (
              <div data-testid="trash-grid" className={styles.grid}>
                {trashFlows.map((flow) => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    onDelete={handlePermanentDelete}
                    onRename={handleRename}
                    onContextMenu={handleContextMenu}
                    deleting={deletingId === flow.id}
                    isHovered={hoveredId === flow.id}
                    onHover={setHoveredId}
                    renamingId={renamingId}
                    isTrash
                    onRestore={handleRestore}
                  />
                ))}
              </div>
            )
          ) : filteredAndSortedFlows.length === 0 ? (
            // ... existing empty state (unchanged)
```

**Step 4: テストがパスすることを確認**

Run: `npx vitest run src/features/dashboard/Dashboard.test.tsx`
Expected: PASS（FlowCardにisTrash/onRestoreを渡す部分でコンパイルエラーが出る場合はTask 6で解消）

**Step 5: コミット**

```bash
git add src/features/dashboard/Dashboard.tsx src/features/dashboard/Dashboard.test.tsx
git commit -m "feat: ダッシュボードにゴミ箱ビュー追加 — ナビ切り替え、復元/完全削除"
```

---

### Task 6: FlowCardのゴミ箱モード対応

**Files:**
- Modify: `src/features/dashboard/FlowCard.tsx:9-18,96-197`

**Step 1: FlowCardPropsにゴミ箱用プロップを追加**

`src/features/dashboard/FlowCard.tsx` L9-18のインターフェースを変更:

```typescript
interface FlowCardProps {
  flow: FlowSummary
  onDelete: (id: string, title: string) => void
  onRename: (id: string, newTitle: string) => void
  onContextMenu: (id: string, x: number, y: number) => void
  deleting?: boolean
  isHovered: boolean
  onHover: (id: string | null) => void
  renamingId: string | null
  isTrash?: boolean
  onRestore?: (id: string) => void
}
```

**Step 2: FlowCardのpropsを展開**

関数シグネチャのデストラクチャリングに追加:

```typescript
export function FlowCard({
  flow,
  onDelete,
  onRename,
  onContextMenu,
  deleting = false,
  isHovered,
  onHover,
  renamingId,
  isTrash = false,
  onRestore,
}: FlowCardProps) {
```

**Step 3: ゴミ箱モード時のホバーオーバーレイを変更**

FlowCard内のホバーオーバーレイ（L112-122）を条件分岐に変更:

```tsx
        {isHovered && (
          <div className={styles.hoverOverlay}>
            {isTrash ? (
              <>
                <button
                  data-testid={`restore-flow-${flow.id}`}
                  className={styles.openButton}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRestore?.(flow.id)
                  }}
                >
                  復元
                </button>
                <button
                  data-testid={`permanent-delete-${flow.id}`}
                  className={`${styles.openButton} ${styles.dangerButton}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelete(flow.id, flow.title)
                  }}
                >
                  完全に削除
                </button>
              </>
            ) : (
              <Link
                to={`/flows/${flow.id}`}
                data-testid={`flow-link-${flow.id}`}
                className={styles.openButton}
              >
                開く
              </Link>
            )}
          </div>
        )}
```

**Step 4: ゴミ箱モード時のメタ情報にdeletedAt表示**

FlowCard内のメタ情報（L166付近の `<span className={styles.updatedAt}>` ）を条件分岐:

```tsx
          <span className={styles.updatedAt}>
            {isTrash && flow.deletedAt
              ? `削除: ${formatRelativeTime(flow.deletedAt)}`
              : `更新: ${formatRelativeTime(flow.updatedAt)}`}
          </span>
```

**Step 5: dangerButtonスタイルをFlowCard.module.cssに追加**

`src/features/dashboard/FlowCard.module.css`に追加:

```css
.dangerButton {
  background: #ef4444 !important;
}

.dangerButton:hover {
  background: #dc2626 !important;
}
```

**Step 6: 全テスト実行**

Run: `npm test`
Expected: ALL PASS

**Step 7: コミット**

```bash
git add src/features/dashboard/FlowCard.tsx src/features/dashboard/FlowCard.module.css
git commit -m "feat: FlowCardにゴミ箱モード追加 — 復元/完全削除ボタン、削除日時表示"
```

---

### Task 7: FlowContextMenuのゴミ箱モード対応

**Files:**
- Modify: `src/features/dashboard/FlowContextMenu.tsx:4-12,41-47`
- Modify: `src/features/dashboard/Dashboard.tsx`

**Step 1: FlowContextMenuPropsにゴミ箱用プロップ追加**

`src/features/dashboard/FlowContextMenu.tsx` L4-12を変更:

```typescript
interface FlowContextMenuProps {
  x: number
  y: number
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
  isTrash?: boolean
  onRestore?: () => void
  onPermanentDelete?: () => void
}
```

**Step 2: 関数シグネチャに新プロップを追加**

```typescript
export function FlowContextMenu({
  x,
  y,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
  isTrash = false,
  onRestore,
  onPermanentDelete,
}: FlowContextMenuProps) {
```

**Step 3: itemsをゴミ箱モードで切り替え**

L41-47を変更:

```typescript
  const items: (MenuItem | 'sep')[] = isTrash
    ? [
        { label: '復元', action: () => onRestore?.() },
        'sep',
        { label: '完全に削除', action: () => onPermanentDelete?.(), danger: true },
      ]
    : [
        { label: '開く', action: onOpen },
        { label: '名前を変更', action: onRename },
        { label: '複製', action: onDuplicate },
        'sep',
        { label: '削除', action: onDelete, danger: true },
      ]
```

**Step 4: Dashboard.tsxのコンテキストメニューにゴミ箱モードプロップを渡す**

`Dashboard.tsx`のFlowContextMenu使用箇所にゴミ箱関連ハンドラーを追加:

```tsx
      {contextMenu && (
        <FlowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onOpen={handleContextOpen}
          onRename={handleContextRename}
          onDuplicate={handleContextDuplicate}
          onDelete={handleContextDelete}
          onClose={handleCloseContextMenu}
          isTrash={selectedNav === 'trash'}
          onRestore={() => {
            if (contextMenu) {
              handleRestore(contextMenu.flowId)
              setContextMenu(null)
            }
          }}
          onPermanentDelete={() => {
            if (contextMenu && contextFlow) {
              handlePermanentDelete(contextMenu.flowId, contextFlow.title)
              setContextMenu(null)
            }
          }}
        />
      )}
```

注意: ゴミ箱ビューではcontextFlowの検索対象を`trashFlows`にする必要がある。`contextFlow`の定義を変更:

```typescript
  const contextFlow = contextMenu
    ? (selectedNav === 'trash' ? trashFlows : flows).find((f) => f.id === contextMenu.flowId)
    : null
```

**Step 5: 全テスト実行**

Run: `npm test`
Expected: ALL PASS

**Step 6: コミット**

```bash
git add src/features/dashboard/FlowContextMenu.tsx src/features/dashboard/Dashboard.tsx
git commit -m "feat: FlowContextMenuにゴミ箱モード追加 — 復元/完全削除メニュー"
```

---

### Task 8: ブラウザ目視検証

**Step 1: ローカルサーバーで確認**

Run: `npm run dev`

ブラウザで以下を確認:
1. ダッシュボードでフローの削除 → 「ゴミ箱に移動しますか？」確認ダイアログ
2. 削除後、フローが一覧から消える
3. サイドバーの「ごみ箱」をクリック → ゴミ箱ビュー表示
4. ゴミ箱内のフローカードにマウスオーバー → 「復元」「完全に削除」ボタン表示
5. 「復元」クリック → フローが通常一覧に戻る
6. 「完全に削除」クリック → 確認ダイアログ → 完全削除
7. ゴミ箱が空の場合 → エンプティステート表示

**Step 2: スクリーンショットで検証**
