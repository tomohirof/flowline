# 双方向矢印（両端矢じり）対応 — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 矢印を双方向（両端に矢じり）にできるようにする。RightPanel から切替、DB に永続化、編集画面・共有ビュー・Mermaid 出力で対応。

**Architecture:** `Arrow` / `InternalArrow` に `bidirectional?: boolean` を追加。DB は `arrows.bidirectional INTEGER DEFAULT 0`。SVG は `<defs>` に `markerStart` 用 marker を追加し `path` の `markerStart` 属性で条件分岐。`from`/`to` は双方向時も保持（片方向に戻したとき復元 + Mermaid 順序維持）。

**Tech Stack:** TypeScript / React / Hono / Cloudflare D1 (SQLite) / Vitest / Zod

**Issue:** [#316](https://github.com/tomohirof/flowline/issues/316)

**Design doc:** `docs/plans/2026-04-29-arrow-bidirectional-design.md`

---

## Pre-flight: ワークツリー作成と issue ラベル

### Task 0: 環境準備

**Files:** （Git 操作のみ）

- [ ] **Step 1: Issue にラベル付与**

```bash
gh issue edit 316 --add-label "作業開始"
```

- [ ] **Step 2: main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

ff-only が通らない場合は作業を中断して人間に報告。

- [ ] **Step 3: ワークツリー作成 + .env リンク**

```bash
git worktree add .worktrees/feat-arrow-bidirectional-316 -b feat/arrow-bidirectional-316
cd .worktrees/feat-arrow-bidirectional-316
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

- [ ] **Step 4: テストルール読込**

```bash
cat ~/.claude/rules/testing.md
```

以降の全タスクは worktree `.worktrees/feat-arrow-bidirectional-316` 内で実行する。

---

## ファイル構成

**作成:**

- `migrations/0011_arrow_bidirectional.sql` — DB マイグレーション

**修正（型・データ層）:**

- `src/lib/types.ts` — `InternalArrow` に `bidirectional`
- `src/features/editor/types.ts` — `Arrow` に `bidirectional`
- `api/lib/validators.ts` — zod schema に `bidirectional`
- `api/lib/flow-transform.ts` — `ArrowRow` / `toArrow` で `bidirectional` を扱う
- `api/routes/flows.ts` — INSERT 時に `bidirectional` をバインド（2 箇所）
- `src/features/editor/FlowEditor.tsx` — `flowToInternal` / `internalStateToPayload` で引き継ぎ

**修正（描画）:**

- `src/features/editor/FlowEditor.tsx` — `markerStart` 追加 + Mermaid 出力分岐
- `src/features/shared/SharedFlowViewer.tsx` — `markerStart` 追加

**修正（UI）:**

- `src/features/editor/components/RightPanel.tsx` — 「⇄ 双方向」ボタン追加 + 「方向を逆転」を条件付き disabled
- `src/locales/ja/editor.json`, `src/locales/en/editor.json` — i18n キー追加

**修正（テスト）:**

- `tests/db/migration.test.ts` — マイグレーション 0011 検証
- `tests/api/routes/flows.test.ts` — `bidirectional` の round-trip
- `src/features/editor/hooks/useArrows.test.ts` — `bidirectional` 保持
- `src/features/editor/FlowEditor.test.tsx` — `marker-start`/`marker-end` 検証
- `src/features/shared/SharedFlowViewer.test.tsx` — 共有ビュー側の検証

---

## Task 1: DB マイグレーション 0011

**Files:**

- Create: `migrations/0011_arrow_bidirectional.sql`
- Test: `tests/db/migration.test.ts`

- [ ] **Step 1: 失敗テストを追加**

`tests/db/migration.test.ts` の末尾（`'should have created_at and updated_at on all tables'` テストの直前）に追加:

```ts
it('should add bidirectional column to arrows (0011)', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const files = [
    '0001_initial.sql',
    '0002_node_arrow_styles.sql',
    '0003_user_settings.sql',
    '0004_email_verification.sql',
    '0005_soft_delete.sql',
    '0006_ai_admin.sql',
    '0007_node_shape.sql',
    '0008_projects.sql',
    '0009_invitation_codes.sql',
    '0010_project_members.sql',
    '0011_arrow_bidirectional.sql',
  ]
  for (const f of files) {
    const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
    for (const stmt of sql.split(';').filter((s) => s.trim())) {
      db.exec(stmt + ';')
    }
  }
  const cols = db.prepare('PRAGMA table_info(arrows)').all() as Array<{
    name: string
    dflt_value: string | null
  }>
  const bidir = cols.find((c) => c.name === 'bidirectional')
  expect(bidir).toBeDefined()
  expect(bidir?.dflt_value).toBe('0')

  // 既存 INSERT が動くこと（DEFAULT 0 で挿入される）
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'u1@test.com', 'h', 'U')",
  ).run()
  db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
  db.prepare("INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'L', 0)").run()
  db.prepare(
    "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f1', 'l1', 0, 0)",
  ).run()
  db.prepare(
    "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f1', 'l1', 1, 1)",
  ).run()
  db.prepare(
    "INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f1', 'n1', 'n2')",
  ).run()
  const row = db.prepare("SELECT bidirectional FROM arrows WHERE id = 'a1'").get() as {
    bidirectional: number
  }
  expect(row.bidirectional).toBe(0)
  db.close()
})
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- tests/db/migration.test.ts
```

期待: 「ENOENT: ...0011_arrow_bidirectional.sql」または該当 it が FAIL。

- [ ] **Step 3: マイグレーション SQL を作成**

`migrations/0011_arrow_bidirectional.sql`:

```sql
-- Add bidirectional flag to arrows table
ALTER TABLE arrows ADD COLUMN bidirectional INTEGER DEFAULT 0;
```

- [ ] **Step 4: テスト pass を確認**

```bash
npm test -- tests/db/migration.test.ts
```

期待: 全 pass。

- [ ] **Step 5: コミット**

```bash
git add migrations/0011_arrow_bidirectional.sql tests/db/migration.test.ts
git commit -m "feat(#316): add bidirectional column to arrows table"
```

---

## Task 2: 型定義（InternalArrow / Arrow）

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/features/editor/types.ts`

このタスクは型追加のみで挙動を変えない。後続タスクのテストで担保される。

- [ ] **Step 1: `InternalArrow` に `bidirectional` を追加**

`src/lib/types.ts` を以下に変更:

```ts
/** 内部矢印データ（DOM/React非依存） */
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
}

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
}
```

- [ ] **Step 2: `Arrow` に `bidirectional` を追加**

`src/features/editor/types.ts:94-101` の `Arrow` インターフェースを:

```ts
export interface Arrow {
  id: string
  fromNodeId: string
  toNodeId: string
  comment: string | null
  color?: string | null
  dash?: string | null
  bidirectional?: boolean | null
}
```

- [ ] **Step 3: 型チェック**

```bash
npm run typecheck
```

期待: エラーなし（既存の `InternalArrow` 利用箇所は省略可能フィールド追加なので壊れない）。

- [ ] **Step 4: コミット**

```bash
git add src/lib/types.ts src/features/editor/types.ts
git commit -m "feat(#316): add bidirectional field to Arrow types"
```

---

## Task 3: API バリデータ + 永続化

**Files:**

- Modify: `api/lib/validators.ts`
- Modify: `api/lib/flow-transform.ts`
- Modify: `api/routes/flows.ts:264-280`, `api/routes/flows.ts:423-440`
- Test: `tests/api/routes/flows.test.ts`

- [ ] **Step 1: 失敗テストを追加**

`tests/api/routes/flows.test.ts` に新しい it を追加（既存の flow CRUD テストの近くに配置）:

```ts
it('should round-trip bidirectional arrow flag', async () => {
  const userId = await createTestUser()
  const token = await getAuthToken(userId)

  const createRes = await app.request(
    '/api/flows',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Bidir test',
        themeId: 'cloud',
        lanes: [{ id: 'l1', name: 'L', colorIndex: 0, position: 0 }],
        nodes: [
          { id: 'n1', laneId: 'l1', rowIndex: 0, label: 'A', orderIndex: 0 },
          { id: 'n2', laneId: 'l1', rowIndex: 1, label: 'B', orderIndex: 1 },
        ],
        arrows: [
          { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', bidirectional: true },
          { id: 'a2', fromNodeId: 'n2', toNodeId: 'n1' },
        ],
      }),
    },
    env,
  )
  expect(createRes.status).toBe(201)
  const { flow } = (await createRes.json()) as {
    flow: { id: string; arrows: Array<{ id: string; bidirectional?: boolean | null }> }
  }
  const a1 = flow.arrows.find((a) => a.id === 'a1')
  const a2 = flow.arrows.find((a) => a.id === 'a2')
  expect(a1?.bidirectional).toBe(true)
  expect(a2?.bidirectional ?? false).toBe(false)

  // GET でも同じ値が返ること
  const getRes = await app.request(
    `/api/flows/${flow.id}`,
    { headers: { Authorization: `Bearer ${token}` } },
    env,
  )
  expect(getRes.status).toBe(200)
  const { flow: got } = (await getRes.json()) as { flow: typeof flow }
  expect(got.arrows.find((a) => a.id === 'a1')?.bidirectional).toBe(true)
  expect(got.arrows.find((a) => a.id === 'a2')?.bidirectional ?? false).toBe(false)
})
```

注: `createTestUser` / `getAuthToken` / `env` / `app` は既存テストで使われているヘルパ。同ファイル内の既存テストの構造をそのまま流用すること。

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- tests/api/routes/flows.test.ts
```

期待: `a1.bidirectional` が undefined のため FAIL。

- [ ] **Step 3: zod schema に `bidirectional` を追加**

`api/lib/validators.ts:25-32` の `arrowSchema` を:

```ts
const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  dash: z.string().nullable().optional(),
  bidirectional: z.boolean().optional(),
})
```

- [ ] **Step 4: `ArrowRow` / `toArrow` に `bidirectional` を追加**

`api/lib/flow-transform.ts:44-54` の `ArrowRow`:

```ts
export interface ArrowRow {
  id: string
  flow_id: string
  from_node_id: string
  to_node_id: string
  comment: string | null
  color: string | null
  dash: string | null
  bidirectional: number | null
  created_at: string
  updated_at: string
}
```

`api/lib/flow-transform.ts:97-108` の `toArrow`:

```ts
export function toArrow(row: ArrowRow) {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    comment: row.comment,
    color: row.color,
    dash: row.dash,
    bidirectional: row.bidirectional === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 5: INSERT 文に `bidirectional` を追加（POST /flows）**

`api/routes/flows.ts:263-280` の arrows INSERT ループを:

```ts
// INSERT arrows
for (const arrow of arrows) {
  statements.push(
    db
      .prepare(
        'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment, color, dash, bidirectional) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        arrow.id,
        flowId,
        arrow.fromNodeId,
        arrow.toNodeId,
        arrow.comment ?? null,
        arrow.color ?? null,
        arrow.dash ?? null,
        arrow.bidirectional ? 1 : 0,
      ),
  )
}
```

- [ ] **Step 6: INSERT 文に `bidirectional` を追加（PUT /flows/:id）**

`api/routes/flows.ts:423-440` の同形式の INSERT ループも同じ変更を適用:

```ts
// INSERT new arrows
for (const arrow of safeArrows) {
  statements.push(
    db
      .prepare(
        'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment, color, dash, bidirectional) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        arrow.id,
        flowId,
        arrow.fromNodeId,
        arrow.toNodeId,
        arrow.comment ?? null,
        arrow.color ?? null,
        arrow.dash ?? null,
        arrow.bidirectional ? 1 : 0,
      ),
  )
}
```

- [ ] **Step 7: テスト pass を確認**

```bash
npm test -- tests/api/routes/flows.test.ts
```

期待: 新テスト含む全 pass。

- [ ] **Step 8: コミット**

```bash
git add api/lib/validators.ts api/lib/flow-transform.ts api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat(#316): persist bidirectional flag on arrows API"
```

---

## Task 4: FlowEditor のデータ変換で bidirectional を引き継ぐ

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:124-134`, `src/features/editor/FlowEditor.tsx:188-203`
- Test: `src/features/editor/hooks/useArrows.test.ts`

`useArrows` hook 自体は spread 保持で既に対応されているが、念のためテストで保証する。FlowEditor 側の `flowToInternal` / `internalStateToPayload` も `bidirectional` を引き継ぐ必要がある。

- [ ] **Step 1: useArrows で bidirectional が保持される失敗テストを追加**

`src/features/editor/hooks/useArrows.test.ts` の末尾（既存のテストグループ内）に追加:

```ts
it('should preserve bidirectional flag through setArrows', () => {
  const arrows: InternalArrow[] = [
    { id: 'a1', from: 'l0_r0', to: 'l0_r1', comment: '', bidirectional: true },
  ]
  const { result } = renderHook(() => useArrows({ ...defaultOptions, initialArrows: arrows }))
  expect(result.current.arrows[0].bidirectional).toBe(true)
  act(() => {
    result.current.setArrows((p) =>
      p.map((a) => (a.id === 'a1' ? { ...a, comment: 'updated' } : a)),
    )
  })
  expect(result.current.arrows[0].bidirectional).toBe(true)
  expect(result.current.arrows[0].comment).toBe('updated')
})
```

注: `defaultOptions` / `renderHook` / `act` / `InternalArrow` インポートは既存テストの形式に合わせる（同ファイルの既存 `it` を参照）。

- [ ] **Step 2: テスト pass を確認（型追加済みなので即 pass のはず）**

```bash
npm test -- src/features/editor/hooks/useArrows.test.ts
```

期待: 全 pass。

- [ ] **Step 3: `flowToInternal` で bidirectional を引き継ぐ**

`src/features/editor/FlowEditor.tsx:124-134` の arrows 構築を:

```ts
// Build arrows
const arrows: InternalArrow[] = flow.arrows
  .map((a) => {
    const from = nodeIdToKey[a.fromNodeId]
    const to = nodeIdToKey[a.toNodeId]
    if (!from || !to) return null
    const arr: InternalArrow = { id: a.id, from, to, comment: a.comment ?? '' }
    if (a.color) arr.color = a.color
    if (a.dash) arr.dash = a.dash
    if (a.bidirectional) arr.bidirectional = true
    return arr
  })
  .filter((a): a is InternalArrow => a !== null)
```

- [ ] **Step 4: `internalStateToPayload` で bidirectional を出力に含める**

`src/features/editor/FlowEditor.tsx:188-203` の apiArrows ビルドを:

```ts
// Build API arrows using stable nodeIds
const apiArrows = arrows
  .map((a) => {
    const fromNodeId = keyToNodeId[a.from]
    const toNodeId = keyToNodeId[a.to]
    if (!fromNodeId || !toNodeId) return null
    return {
      id: a.id,
      fromNodeId,
      toNodeId,
      comment: a.comment || null,
      color: a.color || null,
      dash: a.dash || null,
      bidirectional: a.bidirectional ?? false,
    }
  })
  .filter((a): a is NonNullable<typeof a> => a !== null)
```

- [ ] **Step 5: 型チェック + 既存テスト**

```bash
npm run typecheck
npm test -- src/features/editor/FlowEditor.test.tsx src/features/editor/hooks/useArrows.test.ts
```

期待: 全 pass（既存 marker-end 前提テストは無影響）。

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/hooks/useArrows.test.ts
git commit -m "feat(#316): propagate bidirectional flag in FlowEditor conversions"
```

---

## Task 5: SVG 描画 — FlowEditor

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:2688-2720`（矢印 `<g>` セクション）
- Test: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 1: 失敗テストを追加**

`src/features/editor/FlowEditor.test.tsx` の末尾近く（既存の matrker-end 検証テスト群の近く）に追加:

```ts
  it('should render marker-start on bidirectional arrow', () => {
    const flow: Flow = {
      ...minimalFlow(),
      lanes: [{ id: 'l1', name: 'L', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'l1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'l1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [
        { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null, bidirectional: true },
        { id: 'a2', fromNodeId: 'n2', toNodeId: 'n1', comment: null, bidirectional: false },
      ],
    }
    const { container } = render(<FlowEditor flow={flow} {...defaultProps} />)
    const a1Path = container.querySelector('path[marker-end="url(#m-a1)"]')
    const a2Path = container.querySelector('path[marker-end="url(#m-a2)"]')
    expect(a1Path?.getAttribute('marker-start')).toBe('url(#m-start-a1)')
    expect(a2Path?.getAttribute('marker-start')).toBeNull()
    // start marker defined in defs
    expect(container.querySelector('marker#m-start-a1')).toBeTruthy()
  })
```

注: `minimalFlow()` / `defaultProps` は同ファイル既存ヘルパ／props セットを流用。`Flow` インポート確認。

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/features/editor/FlowEditor.test.tsx -t "marker-start on bidirectional"
```

期待: FAIL。

- [ ] **Step 3: 描画コードを更新**

`src/features/editor/FlowEditor.tsx:2696-2720` の矢印 `<g>` セクションを:

```tsx
              return (
                <g key={`av-${arrow.id}`}>
                  <defs>
                    <marker
                      id={`m-${arrow.id}`}
                      markerWidth="9"
                      markerHeight="8"
                      refX="8"
                      refY="4"
                      orient="auto"
                    >
                      <polygon
                        points="0 0.5, 9 4, 0 7.5"
                        fill={isSel ? arrow.color || T.accent : ac}
                      />
                    </marker>
                    {arrow.bidirectional && (
                      <marker
                        id={`m-start-${arrow.id}`}
                        markerWidth="9"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto-start-reverse"
                      >
                        <polygon
                          points="0 0.5, 9 4, 0 7.5"
                          fill={isSel ? arrow.color || T.accent : ac}
                        />
                      </marker>
                    )}
                  </defs>
                  <path
                    d={d}
                    stroke={isSel ? selC : ac}
                    strokeWidth={isSel ? 2.5 : 2}
                    strokeDasharray={dashArr}
                    fill="none"
                    markerStart={
                      arrow.bidirectional ? `url(#m-start-${arrow.id})` : undefined
                    }
                    markerEnd={`url(#m-${arrow.id})`}
                    style={{ pointerEvents: 'none' }}
                  />
```

（残りのコメントピル等は既存通り）

- [ ] **Step 4: テスト pass を確認**

```bash
npm test -- src/features/editor/FlowEditor.test.tsx
```

期待: 新規 + 既存テスト全 pass（既存は `marker-end` のみチェックなので無影響）。

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#316): render marker-start for bidirectional arrows in FlowEditor"
```

---

## Task 6: SVG 描画 — SharedFlowViewer

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx:495-512`
- Test: `src/features/shared/SharedFlowViewer.test.tsx`

- [ ] **Step 1: 失敗テストを追加**

`src/features/shared/SharedFlowViewer.test.tsx` の末尾近くに追加（既存の `marker-end` 検証テストを参考に）:

```ts
  it('should render marker-start on bidirectional arrow in shared view', () => {
    const flow: Flow = {
      ...minimalFlow(),
      lanes: [{ id: 'l1', name: 'L', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'l1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'l1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [
        { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null, bidirectional: true },
      ],
    }
    const { container } = render(<SharedFlowViewer flow={flow} />)
    const path = Array.from(container.querySelectorAll('path')).find((p) =>
      p.getAttribute('marker-end')?.startsWith('url(#sm-'),
    )
    expect(path?.getAttribute('marker-start')).toBe('url(#sm-start-a1)')
    expect(container.querySelector('marker#sm-start-a1')).toBeTruthy()
  })
```

注: `minimalFlow()` は既存ヘルパを参照。

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/features/shared/SharedFlowViewer.test.tsx -t "marker-start on bidirectional"
```

期待: FAIL。

- [ ] **Step 3: 描画コードを更新**

`src/features/shared/SharedFlowViewer.tsx:495-512` 付近の矢印 marker 定義 + path を:

```tsx
;<marker id={`sm-${arrow.id}`} markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
  <polygon points="0 0.5, 9 4, 0 7.5" fill={ac} />
</marker>
{
  arrow.bidirectional && (
    <marker
      id={`sm-start-${arrow.id}`}
      markerWidth="9"
      markerHeight="8"
      refX="8"
      refY="4"
      orient="auto-start-reverse"
    >
      <polygon points="0 0.5, 9 4, 0 7.5" fill={ac} />
    </marker>
  )
}
```

そして `path` 要素に `markerStart` 属性を追加:

```tsx
                  markerStart={
                    arrow.bidirectional ? `url(#sm-start-${arrow.id})` : undefined
                  }
                  markerEnd={`url(#sm-${arrow.id})`}
```

注: 周辺コードの既存変数名（`ac` など）と既存 `<path>` 属性をそのまま利用すること。SharedFlowViewer.tsx の現コードを Read して、id プレフィックス（`sm-`）と既存属性名を確認の上で編集。

- [ ] **Step 4: テスト pass を確認**

```bash
npm test -- src/features/shared/SharedFlowViewer.test.tsx
```

期待: 新規 + 既存全 pass。

- [ ] **Step 5: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.test.tsx
git commit -m "feat(#316): render marker-start for bidirectional arrows in SharedFlowViewer"
```

---

## Task 7: RightPanel UI — 「⇄ 双方向」ボタン

**Files:**

- Modify: `src/features/editor/components/RightPanel.tsx:653-673`
- Modify: `src/locales/ja/editor.json`, `src/locales/en/editor.json`

- [ ] **Step 1: i18n キーを追加**

`src/locales/ja/editor.json` の `rightPanel` セクション（L51-56 付近）に `arrowBidirectional` を追加:

```json
    "arrowComment": "コメント",
    "arrowCommentPlaceholder": "ラベルを追加…",
    "arrowColor": "線の色",
    "arrowStyle": "線の種類",
    "arrowBidirectional": "⇄ 双方向",
    "arrowReverse": "⇄ 方向を逆転",
    "arrowDelete": "削除",
```

`src/locales/en/editor.json` の同セクションに:

```json
    "arrowComment": "Comment",
    "arrowCommentPlaceholder": "Add label…",
    "arrowColor": "Line color",
    "arrowStyle": "Line style",
    "arrowBidirectional": "⇄ Bidirectional",
    "arrowReverse": "⇄ Reverse direction",
    "arrowDelete": "Delete",
```

- [ ] **Step 2: RightPanel の操作セクションを変更**

`src/features/editor/components/RightPanel.tsx:653-673` の `<PanelSection label={t('rightPanel.operations')}>` ブロックを:

```tsx
<PanelSection label={t('rightPanel.operations')}>
  <div className={styles.panelActions}>
    <PanelBtn
      label={t('rightPanel.arrowBidirectional')}
      color={T.accent}
      active={!!selArrowData.bidirectional}
      onClick={() =>
        setArrows((p) =>
          p.map((a) => (a.id === selArrow ? { ...a, bidirectional: !a.bidirectional } : a)),
        )
      }
    />
    <PanelBtn
      label={t('rightPanel.arrowReverse')}
      color={T.accent}
      disabled={!!selArrowData.bidirectional}
      onClick={() =>
        setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)))
      }
    />
    <PanelBtn
      label={t('rightPanel.arrowDelete')}
      color="#E06060"
      onClick={() => {
        setArrows((p) => p.filter((a) => a.id !== selArrow))
        setSelArrow(null)
      }}
    />
  </div>
</PanelSection>
```

- [ ] **Step 3: PanelBtn が `active`/`disabled` プロパティに対応しているか確認・追加**

`src/features/editor/components/RightPanel.tsx` または `src/features/editor/components/PanelBtn.tsx`（あれば）を Read し、既存の `PanelBtn` コンポーネントが `active?: boolean` と `disabled?: boolean` を受け付けるか確認:

- 受け付けない場合: PanelBtn の Props と JSX を以下のように拡張する:

```tsx
interface PanelBtnProps {
  label: string
  color: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

const PanelBtn = ({ label, color, onClick, active, disabled }: PanelBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    style={{
      flex: 1,
      padding: '6px 8px',
      borderRadius: 6,
      border: `1px solid ${color}`,
      background: active ? color : 'transparent',
      color: active ? '#fff' : color,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {label}
  </button>
)
```

注: 既存スタイルを尊重すること。色やサイズは現在の PanelBtn 実装に合わせる。Read で既存実装を必ず確認の上、最小差分で `active` と `disabled` を追加する。

- [ ] **Step 4: テスト追加（RightPanel が編集動作を返すこと）**

`src/features/editor/components/RightPanel.test.tsx`（既存があれば）または `FlowEditor.test.tsx` 内に統合テストとして:

```ts
it('should toggle bidirectional flag on click', () => {
  // FlowEditor を arrow 1 つ + 選択状態でレンダリング
  // 既存テストで arrow 選択をシミュレートしている例を流用
  const { container, getByText } = renderEditorWithSelectedArrow('a1')
  const btn = getByText('⇄ 双方向').closest('button')!
  expect(btn.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(btn)
  expect(btn.getAttribute('aria-pressed')).toBe('true')
  // 双方向ON時、方向逆転ボタンが disabled
  const reverseBtn = getByText('⇄ 方向を逆転').closest('button')!
  expect(reverseBtn).toBeDisabled()
})
```

注: `renderEditorWithSelectedArrow` は既存テストの選択シミュレーション手順を関数化。同等の処理を `FlowEditor.test.tsx` から探して再利用すること。既存テストファイルにヘルパが無ければ、選択状態を作る既存テストの手順をインライン化。

- [ ] **Step 5: テスト pass を確認**

```bash
npm test
```

期待: 全 pass。FAIL があれば原因調査して修正。

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/components/RightPanel.tsx src/locales/ja/editor.json src/locales/en/editor.json src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#316): add bidirectional toggle button to RightPanel"
```

---

## Task 8: Mermaid 出力で双方向対応

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:1488-1492` 付近
- Test: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 1: 失敗テストを追加**

`src/features/editor/FlowEditor.test.tsx` の Mermaid 出力テスト群（既存の Mermaid 関連テストを検索して追加）:

```ts
it('should output <--> for bidirectional arrows in Mermaid', () => {
  const flow: Flow = {
    ...minimalFlow(),
    lanes: [{ id: 'l1', name: 'L', colorIndex: 0, position: 0 }],
    nodes: [
      { id: 'n1', laneId: 'l1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'l1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ],
    arrows: [
      { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null, bidirectional: true },
      { id: 'a2', fromNodeId: 'n2', toNodeId: 'n1', comment: 'note', bidirectional: true },
    ],
  }
  const mermaid = buildMermaid(flow) // または FlowEditor 経由
  expect(mermaid).toContain('<-->')
  expect(mermaid).toMatch(/<-->\|note\|/)
})
```

注: Mermaid は FlowEditor 内のロジックなので、既存 Mermaid テストの呼び出し方法（モーダル経由 or 関数 export）を確認して合わせる。`buildMermaid` のような export 関数が無ければ、既存テストパターン通りボタンクリックでクリップボード書込をスパイする方式を採用。

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/features/editor/FlowEditor.test.tsx -t "Mermaid"
```

期待: FAIL（双方向時も `-->` のため）。

- [ ] **Step 3: Mermaid 生成ロジックを更新**

`src/features/editor/FlowEditor.tsx:1488-1492` 付近を:

```ts
if (!fromId || !toId) return
const arrowOp = a.bidirectional ? '<-->' : '-->'
if (a.comment) {
  m += `    ${fromId} ${arrowOp}|${esc(a.comment)}| ${toId}\n`
} else {
  m += `    ${fromId} ${arrowOp} ${toId}\n`
}
```

注: `m += ...` のインデントは既存コードに合わせる。Read で当該箇所を確認の上で編集。

- [ ] **Step 4: テスト pass を確認**

```bash
npm test -- src/features/editor/FlowEditor.test.tsx
```

期待: 全 pass。

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#316): emit Mermaid <--> for bidirectional arrows"
```

---

## Task 9: 全体テスト + Lint

**Files:** （実行のみ）

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

期待: 全 pass。FAIL があれば全て修正してから次へ。

- [ ] **Step 2: 型チェック + Lint**

```bash
npm run typecheck
npm run lint
```

期待: エラーなし。

- [ ] **Step 3: 修正があればコミット**

```bash
git add -A
git diff --staged --quiet || git commit -m "chore(#316): fix type/lint issues"
```

---

## Task 10: 実画面検証（Playwright / chrome-devtools）

**Files:** （目視検証 + スクリーンショット）

- [ ] **Step 1: 開発サーバー起動**

```bash
npm run dev
```

別タブで継続実行。

- [ ] **Step 2: ログインしてエディタを開く**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` を使用。

- [ ] **Step 3: 矢印を選択し「⇄ 双方向」をクリック**

操作:

1. 既存または新規フローを開く
2. 矢印を 1 本クリック → RightPanel に「⇄ 双方向」ボタンが表示されることを確認
3. クリック → 矢印の両端に矢じりが付くことを確認
4. 「⇄ 方向を逆転」ボタンが disabled になっていることを確認
5. 再度「⇄ 双方向」をクリック → 片方向に戻ることを確認

スクリーンショット保存先: `.screenshots/arrow-bidirectional-{toggle-on,toggle-off}.png`

- [ ] **Step 4: 保存 → リロードで状態維持を確認**

1. 双方向ON状態でしばらく待ち（autosave 確認）
2. ページリロード
3. 矢印が双方向のまま表示されることを確認

- [ ] **Step 5: 共有ビューでも確認**

1. 共有 URL を取得（既存の共有機能を使用）
2. 別ウィンドウで共有 URL を開く
3. 双方向矢印が両端矢じりで表示されることを確認

- [ ] **Step 6: PNG エクスポート確認**

1. PNG エクスポート機能を実行
2. 出力 PNG を開いて両端矢じりが描画されていることを確認

- [ ] **Step 7: LCP 1秒以内確認**

chrome-devtools の Performance タブで Largest Contentful Paint を計測。1秒超えていれば実装を見直し。

- [ ] **Step 8: 開発サーバー停止**

```bash
# 起動した dev サーバーを停止
```

問題なければ次へ。問題があれば該当タスクに戻って修正。

---

## Task 11: main 同期 + push + PR

**Files:** （Git 操作のみ）

- [ ] **Step 1: main 最新化 + rebase**

```bash
git pull origin main --rebase
npm test
```

全 pass 必須。

- [ ] **Step 2: push**

```bash
git push -u origin feat/arrow-bidirectional-316
```

- [ ] **Step 3: PR 作成**

```bash
gh pr create --title "feat(#316): 矢印を双方向（両端矢じり）にできるようにする" --body "$(cat <<'EOF'
## Summary
- 矢印に `bidirectional` フラグを追加（DB / API / UI / Mermaid 出力）
- RightPanel の操作セクションに「⇄ 双方向」ボタン追加。ON 時は「⇄ 方向を逆転」を disabled
- SVG `<path>` に `markerStart` を条件付きで追加し両端に矢じりを描画
- Closes #316

## Test plan
- [x] DB マイグレーション 0011 のスキーマテスト
- [x] API round-trip テスト（POST → GET）
- [x] FlowEditor / SharedFlowViewer の `marker-start` 描画テスト
- [x] RightPanel のトグル + reverse disabled テスト
- [x] Mermaid `<-->` 出力テスト
- [x] 実画面で双方向切替・保存・リロード・共有ビュー・PNG エクスポート・LCP 確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: CI 監視**

```bash
gh pr checks --watch
```

FAIL があれば修正 → push → 再 watch。

- [ ] **Step 5: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` の手順に従って実行。

- [ ] **Step 6: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 7: レビュー修正ループ**

CLAUDE.md 「9. レビュー修正ループ」の手順に従う。

- [ ] **Step 8: Merge & デプロイ確認**

CLAUDE.md 「10. Merge & Deploy Verification」の手順に従う。

- [ ] **Step 9: Worktree クリーンアップ**

```bash
cd "$MAIN"
git worktree remove .worktrees/feat-arrow-bidirectional-316
git branch -d feat/arrow-bidirectional-316
git worktree list
```

---

## 完了条件（受け入れ条件）

- [ ] エディタで矢印を双方向にできる（実画面確認済み）
- [ ] 共有ビューでも双方向で表示される
- [ ] DB 保存・復元が正しく動く
- [ ] PNG エクスポートに両端の矢じりが反映される
- [ ] 既存の片方向矢印・既存データに影響がない
- [ ] LCP 1 秒以内
- [ ] CI 全 pass
- [ ] PR が `[C:承認OK]` を取得
- [ ] main にマージされ、本番デプロイ確認済み
