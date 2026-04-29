# Lane Group Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue #309 を修正し、`lanes` テーブルに `group_id` / `group_role` を永続化することで、エディタの統合レーンがリロード後・共有リンク経由でも維持されるようにする。

**Architecture:** マイグレーション `0012_lane_groups.sql` で `lanes` テーブルに 2 カラム（`group_id TEXT` nullable + `group_role TEXT CHECK(...)` nullable）を追加。`api/lib/flow-transform.ts` の `LaneRow` 型と `toLane()` 変換、`api/routes/flows.ts` の POST/PUT INSERT 文を対応させる。共有ビュー (`api/routes/shared.ts`) と validators (`api/lib/validators.ts`) は既存実装が `toLane()` 経由 / groupId 受理済みのため変更不要。

**Tech Stack:** Cloudflare D1 (SQLite), Hono, Zod, Vitest, better-sqlite3 (test DB), Playwright MCP（手動実画面検証）。

**Spec:** `docs/superpowers/specs/2026-04-29-lane-group-persistence-design.md`

---

## File Structure

| Path | 操作 | 責務 |
|---|---|---|
| `migrations/0012_lane_groups.sql` | Create | `lanes` に `group_id`, `group_role` 追加 + 部分インデックス |
| `tests/helpers/mock-d1.ts` | Modify | `migrationFiles` 配列に `'0012_lane_groups.sql'` 追加 |
| `tests/db/migration.test.ts` | Modify | 0012 マイグレーション検証ケース追加 |
| `api/lib/flow-transform.ts` | Modify | `LaneRow` に `group_id`/`group_role` 追加、`toLane()` でマップ |
| `api/lib/flow-transform.test.ts` | Modify | `toLane` のユニットテスト追加 |
| `api/routes/flows.ts` | Modify | POST `/` と PUT `/:id` の lane INSERT に 2 カラム bind |
| `tests/api/routes/flows.test.ts` | Modify | ラウンドトリップ（POST→GET / PUT→GET）テスト追加 |

E2E は Playwright MCP による手動検証（CLAUDE.md ワークフロー Step 6）として扱う。Playwright 自動テスト基盤は本リポジトリに存在しないため、新規導入は本タスクのスコープ外。

---

## Workflow 準拠の前準備

> **Note:** これは CLAUDE.md ワークフロー Step 0–1 を本プランに統合したもの。

### Task 0: 環境リフレッシュと作業開始ラベル

- [ ] **Step 0.1: cleanup**

```bash
/cleanup
```

- [ ] **Step 0.2: 既存「作業開始」ラベル確認**

```bash
gh issue view 309 --json labels --jq '.labels[].name'
```

期待: `"作業開始"` が含まれない（既に付与済みなら別 issue を選ぶか中断）

- [ ] **Step 0.3: ラベル付与**

```bash
gh issue edit 309 --add-label "作業開始" || gh label create "作業開始" --color "E11D48" && gh issue edit 309 --add-label "作業開始"
```

### Task 1: ワークツリー作成

**Files:**
- Create: `.worktrees/fix/lane-group-persistence-309/` (worktree)

- [ ] **Step 1.1: ローカル main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

期待: `Already up to date.` または fast-forward マージ成功。失敗時は **作業を中断して人間に報告**。

- [ ] **Step 1.2: ワークツリー作成 + .env リンク**

```bash
git worktree add .worktrees/fix/lane-group-persistence-309 -b fix/lane-group-persistence-309
cd .worktrees/fix/lane-group-persistence-309
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

期待: ワークツリー作成成功、`.env` 系ファイルがリンクされている。

- [ ] **Step 1.3: 設計ドキュメントをワークツリーに反映**

main 側で作成した spec を新ブランチでコミット可能にするため、ファイルがワークツリーに見えていることを確認:

```bash
ls docs/superpowers/specs/2026-04-29-lane-group-persistence-design.md
```

期待: ファイル存在（git worktree は同一作業ツリーを共有しないため、untracked file は見えない可能性あり。見えなければ main 側からコピーする）。

```bash
[ -f docs/superpowers/specs/2026-04-29-lane-group-persistence-design.md ] || cp "$MAIN/docs/superpowers/specs/2026-04-29-lane-group-persistence-design.md" docs/superpowers/specs/
[ -f docs/superpowers/plans/2026-04-29-lane-group-persistence.md ] || cp "$MAIN/docs/superpowers/plans/2026-04-29-lane-group-persistence.md" docs/superpowers/plans/
```

- [ ] **Step 1.4: テストルール読込**

```bash
cat ~/.claude/rules/testing.md
```

期待: テスト品質基準が表示される。以降のテスト作成時に参照。

- [ ] **Step 1.5: spec/plan を初期コミット**

```bash
git add docs/superpowers/specs/2026-04-29-lane-group-persistence-design.md docs/superpowers/plans/2026-04-29-lane-group-persistence.md
git commit -m "docs(#309): add design and plan for lane group persistence"
```

期待: コミット成功。

---

## 実装フェーズ

### Task 2: マイグレーション作成（Red）

**Files:**
- Create: `migrations/0012_lane_groups.sql`
- Modify: `tests/helpers/mock-d1.ts`
- Modify: `tests/db/migration.test.ts`

- [ ] **Step 2.1: migration.test.ts に 0012 検証ケースを書く（Red）**

`tests/db/migration.test.ts` の末尾、`it('should have created_at and updated_at on all tables', ...)` の前に以下を追加:

```ts
  it('should add group_id and group_role to lanes (0012)', () => {
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
      '0012_lane_groups.sql',
    ]
    for (const f of files) {
      const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
      for (const stmt of sql.split(';').filter((s) => s.trim())) {
        db.exec(stmt + ';')
      }
    }
    const cols = db.prepare('PRAGMA table_info(lanes)').all() as Array<{
      name: string
      type: string
      notnull: number
    }>
    const groupId = cols.find((c) => c.name === 'group_id')
    const groupRole = cols.find((c) => c.name === 'group_role')
    expect(groupId).toBeDefined()
    expect(groupId?.type).toBe('TEXT')
    expect(groupId?.notnull).toBe(0)
    expect(groupRole).toBeDefined()
    expect(groupRole?.type).toBe('TEXT')
    expect(groupRole?.notnull).toBe(0)

    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'g@test.com', 'h', 'U')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()

    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l1', 'f1', 'L1', 0, 'g1', 'parent')",
    ).run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l2', 'f1', 'L2', 1, 'g1', 'sub')",
    ).run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l3', 'f1', 'L3', 2)",
    ).run()

    expect(() =>
      db
        .prepare(
          "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l_bad', 'f1', 'Bad', 3, 'g2', 'invalid')",
        )
        .run(),
    ).toThrow()

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'lanes'")
      .all() as Array<{ name: string }>
    expect(indexes.map((i) => i.name)).toContain('idx_lanes_group_id')

    db.close()
  })
```

- [ ] **Step 2.2: テスト失敗を確認**

```bash
npm test -- tests/db/migration.test.ts -t "should add group_id and group_role to lanes"
```

期待: FAIL（マイグレーションファイル `0012_lane_groups.sql` が存在しない）

- [ ] **Step 2.3: マイグレーション作成（Green）**

`migrations/0012_lane_groups.sql` を以下の内容で作成:

```sql
-- 0012: Add group_id / group_role columns to lanes for merged-lane persistence (issue #309)
ALTER TABLE lanes ADD COLUMN group_id TEXT;
ALTER TABLE lanes ADD COLUMN group_role TEXT CHECK(group_role IN ('parent','sub'));
CREATE INDEX IF NOT EXISTS idx_lanes_group_id ON lanes(group_id) WHERE group_id IS NOT NULL;
```

- [ ] **Step 2.4: テストヘルパーのマイグレーション配列に追加**

`tests/helpers/mock-d1.ts` の `migrationFiles` 配列の末尾に追加:

```ts
  const migrationFiles = [
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
    '0012_lane_groups.sql',
  ]
```

- [ ] **Step 2.5: テスト pass を確認**

```bash
npm test -- tests/db/migration.test.ts
```

期待: 全 PASS（既存ケースも含む）。

- [ ] **Step 2.6: コミット**

```bash
git add migrations/0012_lane_groups.sql tests/helpers/mock-d1.ts tests/db/migration.test.ts
git commit -m "feat(#309): add migration 0012 for lane group_id/group_role columns"
```

---

### Task 3: flow-transform 修正

**Files:**
- Modify: `api/lib/flow-transform.ts:18-26, 70-79`
- Modify: `api/lib/flow-transform.test.ts`

- [ ] **Step 3.1: toLane の失敗テストを書く（Red）**

`api/lib/flow-transform.test.ts` のインポート行と `describe` ブロック群に追加:

```ts
import { toNode, toFlowSummary, toProject, toLane } from './flow-transform'
import type { NodeRow, FlowRow, ProjectRow, LaneRow } from './flow-transform'
```

ファイル末尾（既存 describe の後）に以下を追加:

```ts
describe('toLane', () => {
  const baseRow: LaneRow = {
    id: 'l1',
    flow_id: 'f1',
    name: 'Lane',
    color_index: 0,
    position: 0,
    group_id: null,
    group_role: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('should map group_id and group_role to camelCase for parent role', () => {
    const row: LaneRow = { ...baseRow, group_id: 'g1', group_role: 'parent' }
    const result = toLane(row)
    expect(result.groupId).toBe('g1')
    expect(result.groupRole).toBe('parent')
  })

  it('should preserve sub role', () => {
    const row: LaneRow = { ...baseRow, group_id: 'g1', group_role: 'sub' }
    expect(toLane(row).groupRole).toBe('sub')
  })

  it('should normalize null group fields to undefined', () => {
    const result = toLane(baseRow)
    expect(result.groupId).toBeUndefined()
    expect(result.groupRole).toBeUndefined()
  })

  it('should not include snake_case keys in output', () => {
    const result = toLane({ ...baseRow, group_id: 'g1', group_role: 'parent' })
    expect(result).not.toHaveProperty('group_id')
    expect(result).not.toHaveProperty('group_role')
  })
})
```

- [ ] **Step 3.2: テスト失敗を確認**

```bash
npm test -- api/lib/flow-transform.test.ts
```

期待: FAIL（`LaneRow` 型に `group_id`/`group_role` が無く TS コンパイルエラー、または `groupId` が undefined になる）。

- [ ] **Step 3.3: LaneRow と toLane を修正（Green）**

`api/lib/flow-transform.ts` の `LaneRow` を以下に置き換え:

```ts
export interface LaneRow {
  id: string
  flow_id: string
  name: string
  color_index: number
  position: number
  group_id: string | null
  group_role: 'parent' | 'sub' | null
  created_at: string
  updated_at: string
}
```

`toLane` を以下に置き換え:

```ts
export function toLane(row: LaneRow) {
  return {
    id: row.id,
    name: row.name,
    colorIndex: row.color_index,
    position: row.position,
    groupId: row.group_id ?? undefined,
    groupRole: row.group_role ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 3.4: テスト pass を確認**

```bash
npm test -- api/lib/flow-transform.test.ts
```

期待: 全 PASS。

- [ ] **Step 3.5: コミット**

```bash
git add api/lib/flow-transform.ts api/lib/flow-transform.test.ts
git commit -m "feat(#309): map lane group_id/group_role in flow-transform"
```

---

### Task 4: API ラウンドトリップテスト（Red）

**Files:**
- Modify: `tests/api/routes/flows.test.ts`

- [ ] **Step 4.1: ラウンドトリップテストを書く（Red）**

`tests/api/routes/flows.test.ts` の末尾、`describe` ブロックの最後に以下を追加（既存の `describe` 内に追加するか、新しい `describe('Lane group persistence (#309)', ...)` ブロックとして追加）:

```ts
describe('Lane group persistence (#309)', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  it('POST→GET should round-trip groupId and groupRole', async () => {
    registerUser(db, 'u_g1', 'g1@test.com')
    const env = createEnv(db)
    const cookie = await authCookie('u_g1', 'g1@test.com')

    const groupId = 'grp-1'
    const body = {
      title: 'Merged Flow',
      lanes: [
        { id: 'lp', name: 'Parent', colorIndex: 0, position: 0, groupId, groupRole: 'parent' },
        { id: 'ls', name: 'Sub', colorIndex: 1, position: 1, groupId, groupRole: 'sub' },
        { id: 'lo', name: 'Solo', colorIndex: 2, position: 2 },
      ],
      nodes: [],
      arrows: [],
    }

    const postRes = await postJson('/flows', body, env, cookie)
    expect(postRes.status).toBe(201)
    const created = (await postRes.json()) as { flow: { id: string } }
    const flowId = created.flow.id

    const getRes = await getWithCookie(`/flows/${flowId}`, env, cookie)
    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()) as {
      flow: {
        lanes: Array<{ id: string; groupId?: string; groupRole?: 'parent' | 'sub' }>
      }
    }
    const byId = Object.fromEntries(fetched.flow.lanes.map((l) => [l.id, l]))
    expect(byId.lp.groupId).toBe(groupId)
    expect(byId.lp.groupRole).toBe('parent')
    expect(byId.ls.groupId).toBe(groupId)
    expect(byId.ls.groupRole).toBe('sub')
    expect(byId.lo.groupId).toBeUndefined()
    expect(byId.lo.groupRole).toBeUndefined()
  })

  it('PUT→GET should round-trip groupId and groupRole (issue #309 scenario)', async () => {
    registerUser(db, 'u_g2', 'g2@test.com')
    insertFlow(db, 'f_g2', 'u_g2', 'Flow')
    insertLane(db, 'l_a', 'f_g2', 'A', 0, 0)
    insertLane(db, 'l_b', 'f_g2', 'B', 1, 1)
    const env = createEnv(db)
    const cookie = await authCookie('u_g2', 'g2@test.com')

    const groupId = 'grp-2'
    const body = {
      lanes: [
        { id: 'l_a', name: 'A', colorIndex: 0, position: 0, groupId, groupRole: 'parent' },
        { id: 'l_b', name: 'B', colorIndex: 1, position: 1, groupId, groupRole: 'sub' },
      ],
      nodes: [],
      arrows: [],
    }

    const putRes = await putJson('/flows/f_g2', body, env, cookie)
    expect(putRes.status).toBe(200)

    const getRes = await getWithCookie('/flows/f_g2', env, cookie)
    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()) as {
      flow: { lanes: Array<{ id: string; groupId?: string; groupRole?: string }> }
    }
    const byId = Object.fromEntries(fetched.flow.lanes.map((l) => [l.id, l]))
    expect(byId.l_a.groupId).toBe(groupId)
    expect(byId.l_a.groupRole).toBe('parent')
    expect(byId.l_b.groupId).toBe(groupId)
    expect(byId.l_b.groupRole).toBe('sub')
  })

  it('should leave non-grouped lanes intact (groupId undefined)', async () => {
    registerUser(db, 'u_g3', 'g3@test.com')
    const env = createEnv(db)
    const cookie = await authCookie('u_g3', 'g3@test.com')

    const body = {
      title: 'Solo only',
      lanes: [{ id: 'l_solo', name: 'Solo', colorIndex: 0, position: 0 }],
      nodes: [],
      arrows: [],
    }
    const postRes = await postJson('/flows', body, env, cookie)
    expect(postRes.status).toBe(201)
    const created = (await postRes.json()) as { flow: { id: string } }

    const getRes = await getWithCookie(`/flows/${created.flow.id}`, env, cookie)
    const fetched = (await getRes.json()) as {
      flow: { lanes: Array<{ groupId?: string }> }
    }
    expect(fetched.flow.lanes[0].groupId).toBeUndefined()
  })
})
```

- [ ] **Step 4.2: テスト失敗を確認**

```bash
npm test -- tests/api/routes/flows.test.ts -t "Lane group persistence"
```

期待: 3 ケース全て FAIL（INSERT が group_id/group_role を bind していないため、GET 結果で `groupId` が undefined になる）。

> **Note:** 失敗していなければ実装に問題がある。本当に失敗を確認してから次に進むこと。

---

### Task 5: flows.ts INSERT 修正（Green）

**Files:**
- Modify: `api/routes/flows.ts:230-238` (POST lane INSERT)
- Modify: `api/routes/flows.ts:391-399` (PUT lane INSERT)

- [ ] **Step 5.1: POST `/` の lane INSERT を修正**

`api/routes/flows.ts` 内の POST ハンドラの `// INSERT lanes` ループ（現状 L230-238）を以下に置き換え:

```ts
  // INSERT lanes
  for (const lane of lanes) {
    statements.push(
      db
        .prepare(
          'INSERT INTO lanes (id, flow_id, name, color_index, position, group_id, group_role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          lane.id,
          flowId,
          lane.name,
          lane.colorIndex,
          lane.position,
          lane.groupId ?? null,
          lane.groupRole ?? null,
        ),
    )
  }
```

- [ ] **Step 5.2: PUT `/:id` の lane INSERT を修正**

同ファイル内 PUT ハンドラの `// INSERT new lanes` ループ（現状 L391-399）を以下に置き換え:

```ts
      // INSERT new lanes
      for (const lane of safeLanes) {
        statements.push(
          db
            .prepare(
              'INSERT INTO lanes (id, flow_id, name, color_index, position, group_id, group_role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              lane.id,
              flowId,
              lane.name,
              lane.colorIndex,
              lane.position,
              lane.groupId ?? null,
              lane.groupRole ?? null,
            ),
        )
      }
```

- [ ] **Step 5.3: ラウンドトリップテスト pass を確認**

```bash
npm test -- tests/api/routes/flows.test.ts
```

期待: 全 PASS（既存ケースも含む）。

- [ ] **Step 5.4: 全ユニット/統合テスト実行**

```bash
npm test
```

期待: 全 PASS（FAIL が 1 件でもあれば次に進まない）。

- [ ] **Step 5.5: 型チェック / Lint**

```bash
npm run build && npm run lint
```

期待: エラーなし。

- [ ] **Step 5.6: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "fix(#309): persist lane group_id/group_role in POST and PUT"
```

---

### Task 6: 実画面検証（Playwright MCP）

> CLAUDE.md ワークフロー Step 6 「実画面検証」の実行。Playwright 自動テスト基盤は無いので、Playwright MCP で手動操作 + スクリーンショットで検証する。

**Files:**
- 検証対象: 既デプロイ環境ではなく **ローカル `npm run dev`** 起動
- ログイン情報: `.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`

- [ ] **Step 6.1: ローカル D1 にマイグレーション適用**

```bash
npm run db:migrate
```

期待: `0012_lane_groups.sql` が新規適用される。

- [ ] **Step 6.2: 開発サーバ起動**

```bash
npm run dev
```

別ターミナル / バックグラウンドで起動。

- [ ] **Step 6.3: 統合 → リロード検証（Playwright MCP）**

Playwright MCP で以下を順に実行:
1. `mcp__playwright__browser_navigate` → ローカル URL（dev サーバ）
2. ログイン（`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`）
3. 新規フロー作成 → レーンを 2 つ確保
4. レーン間ギャップをクリックして統合
5. 統合状態をスクリーンショット保存（`.screenshots/lane-merge-before-reload.png`）
6. 自動保存を 2.5 秒待機（`mcp__playwright__browser_wait_for` で時間待ち）
7. `mcp__playwright__browser_navigate` で同じ URL にリロード
8. 統合が維持されていることをスクリーンショットで確認（`.screenshots/lane-merge-after-reload.png`）

合格基準: リロード後も「統合された 1 つの広い列」として表示される。

- [ ] **Step 6.4: 共有リンク検証**

1. 上記フローで「共有」ボタン押下、共有 URL 取得
2. 別タブ（or shared 経路）で `/shared/<token>` を開く
3. 統合レーンが表示されることをスクリーンショット保存（`.screenshots/lane-merge-shared.png`）

合格基準: 共有ビューでも統合表示。

- [ ] **Step 6.5: LCP 計測**

CLAUDE.md ワークフロー Step 6 のパフォーマンス基準: LCP ≤ 1 秒。`mcp__playwright__browser_evaluate` 等で performance entry を取得し、LCP > 1s なら本タスクで原因調査・修正。

期待: LCP ≤ 1000ms。

- [ ] **Step 6.6: 不具合があれば Task 5 に戻る**

問題があれば原因を特定し、修正後に再度 6.3〜6.5 を実施。

---

### Task 7: 最新 main 同期 + テスト再走

**Files:**
- (なし) ブランチ rebase のみ

- [ ] **Step 7.1: main を rebase**

```bash
git pull origin main --rebase
```

コンフリクトが起きた場合: 両側の差分を読んで手動解決し、`git rebase --continue`。`--abort` は最終手段。

- [ ] **Step 7.2: 全テスト再走**

```bash
npm test
```

期待: 全 PASS（1 件でも FAIL があれば修正してから次へ）。

---

### Task 8: PR 作成 + CI

**Files:**
- (なし) GitHub PR

- [ ] **Step 8.1: push**

```bash
git push -u origin fix/lane-group-persistence-309
```

- [ ] **Step 8.2: PR 作成**

```bash
gh pr create --title "fix(#309): persist merged lane groupId/groupRole in DB" --body "$(cat <<'EOF'
## Summary
- `lanes` テーブルに `group_id` / `group_role` カラムを追加するマイグレーション 0012 を作成
- `flow-transform.toLane()` で camelCase に正規化（NULL → undefined）
- `flows.ts` の POST/PUT で `group_id`/`group_role` を bind し、リロード後・共有リンク経由でも統合レーンが維持されるようにした

Closes #309

## 本番デプロイ手順
本番 D1 にマイグレーション適用が必須:
\`\`\`
npm run db:migrate:remote
\`\`\`
（CI が自動適用するなら不要。`wrangler.toml` の migrations 設定を確認）

## Test plan
- [ ] CI 全パス
- [ ] 統合レーン作成 → リロード → 統合が維持されることを確認
- [ ] 共有リンク経由でも統合レーンが表示されることを確認
- [ ] 既存の単独レーン（group_id NULL）が壊れないことを確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8.3: CI 完了待機**

```bash
gh pr checks --watch
```

期待: 全 pass。FAIL があれば修正 → push → 再 watch。

- [ ] **Step 8.4: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

### Task 8.5: 本番ビルド確認

- [ ] **Step 8.5.1: preview skill 実行**

`~/.claude/skills/preview/SKILL.md` を参照し、本番ビルドをローカルで起動して目視確認。

期待: 本番ビルドでも統合レーン作成 → リロード → 維持。

---

### Task 9: レビュー修正ループ（最大10回）

> 1 回ずつ個別ステップとして実行。for/while で一括実行しない。`claude` のコメントのみを判定対象とする。

- [ ] **Step 9.1: 1 分待機**

```bash
sleep 60
```

- [ ] **Step 9.2: レビュー取得**

```bash
gh pr view --json comments
```

- [ ] **Step 9.3: 最新 `claude[bot]` コメントの末尾判定を抽出**

再レビュー後の判定は、再レビュー依頼コメントの `created_at` より後に投稿された `claude[bot]` コメントだけを対象にする。

- **[A:要修正] / [B:条件つき承認]**: 修正 → push → CI pass → 再レビュー依頼コメント → Step 9.1 に戻る
- **[C:承認OK]**: Task 10 へ

10 回超過の場合: **人間にエスカレーション**。

---

### Task 10: Merge & デプロイ確認

- [ ] **Step 10.1: マージ**

```bash
gh pr merge --merge
```

- [ ] **Step 10.2: 30 秒待機 → main 同期**

```bash
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 10.3: 本番 D1 マイグレーション適用確認**

`~/.claude/skills/deploy/SKILL.md` 参照。Cloudflare Pages デプロイログとマイグレーション適用を確認。

```bash
npm run db:migrate:remote 2>&1 | tee /tmp/migrate-309.log
```

期待: 0012 が適用済みまたは新規適用成功。

- [ ] **Step 10.4: 本番動作確認**

本番 URL で実際に統合レーン作成 → リロード → 維持されることを確認（任意で Playwright MCP）。

---

### Task 11: ワークツリー後始末

- [ ] **Step 11.1: ワークツリー削除**

メインリポジトリに戻ってから:

```bash
cd "$MAIN"
git worktree remove .worktrees/fix/lane-group-persistence-309
git branch -d fix/lane-group-persistence-309
git worktree list
```

期待: 残骸なし。

---

## Self-Review

**1. Spec coverage:**
- マイグレーション → Task 2 ✓
- LaneRow / toLane → Task 3 ✓
- POST/PUT INSERT → Task 5 ✓
- shared.ts: 変更不要（spec 通り）✓
- validators: 変更不要（spec 通り）✓
- ユニットテスト → Task 3 (toLane), Task 2 (migration)  ✓
- API ラウンドトリップ ケースA/B/C → Task 4 ✓
- ケースD（CHECK 制約）→ Task 2.1 で網羅 ✓
- E2E → Task 6（自動 Playwright 基盤が無いため、Playwright MCP による手動検証に変更：Spec の「E2E テスト追加」要件は実態に合わせて「Playwright MCP 手動検証」に置換）。受け入れ基準「E2E テスト / API テストが追加されている」は API テストでカバー
- 受け入れ基準「本番 D1 にマイグレーション適用」→ Task 8.2 PR description, Task 10.3 ✓

**2. Placeholder scan:** TBD/TODO/「実装後で」のような文言なし。全コードブロックに完全な実装あり。

**3. Type consistency:**
- `LaneRow.group_role: 'parent' | 'sub' | null` を Task 3.3 で定義、Task 4.1 のテストでも `'parent' | 'sub'` として一致
- `toLane` の出力 `groupId?: string` / `groupRole?: 'parent' | 'sub'` がフロント `Lane` 型および validators の `z.enum(['parent','sub'])` と一致
- マイグレーション SQL の CHECK 制約 `IN ('parent','sub')` が型と一致
- `migrationFiles` 配列の追加要素 `'0012_lane_groups.sql'` がファイル名と一致
