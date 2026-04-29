# 統合レーン (groupId/groupRole) の DB 永続化設計

- **Issue**: #309
- **Date**: 2026-04-29
- **Type**: Bug fix

## 背景

エディタの「レーン統合」機能は、フロント（`src/features/editor/FlowEditor.tsx` ほか）で `Lane.groupId` / `Lane.groupRole` (`'parent' | 'sub'`) を用いて隣接レーンを 1 つの広い列として扱う。

しかしバックエンド (`api/`) は DB スキーマ・INSERT・SELECT 変換のいずれも `group_id` / `group_role` に対応しておらず、validator (`api/lib/validators.ts`) のみ素通しで受理していた。結果として PUT で送られた統合情報は DB に書き込まれず、リロードで失われる。

## 受け入れ基準

- [ ] 統合レーン作成 → リロード → 統合が維持される
- [ ] 共有リンク経由でも統合レーンが表示される
- [ ] 本番 D1 にマイグレーションが適用される
- [ ] 既存の単独レーン (`group_id = NULL`) が壊れない
- [ ] E2E テスト / API テストが追加されている

## アーキテクチャ概要

フロントエンドのデータモデル `Lane.groupId?: string` / `Lane.groupRole?: 'parent' | 'sub'` を、DB の `lanes` テーブルに 2 カラム追加する形で 1:1 対応させる。別テーブルへの正規化や JSON カラム化は YAGNI として採用しない（バグ修正スコープを超え、現フロントとも非対称になるため）。

## データモデル / マイグレーション

新規マイグレーション: **`migrations/0012_lane_groups.sql`**

```sql
ALTER TABLE lanes ADD COLUMN group_id TEXT;
ALTER TABLE lanes ADD COLUMN group_role TEXT CHECK(group_role IN ('parent','sub'));
CREATE INDEX IF NOT EXISTS idx_lanes_group_id ON lanes(group_id) WHERE group_id IS NOT NULL;
```

設計ポイント:

- どちらも nullable（既存単独レーンは `group_id IS NULL` のまま）
- `group_role` に CHECK 制約を入れ DB レベルで `'parent'`/`'sub'` 以外の混入を防止
- 「1 グループに parent ちょうど 1、sub 1 つ以上」の不変条件はアプリ層で担保（フロント `FlowEditor.tsx` が現状すでに維持）。DB 制約は過剰なので入れない
- 部分インデックス（`WHERE group_id IS NOT NULL`）で容量を節約

## API 層の変更

### `api/lib/flow-transform.ts`

`LaneRow` 型に `group_id`, `group_role` を追加し、`toLane()` で camelCase へマップする。NULL は `undefined` に正規化（フロント型 `Lane.groupId?: string` と整合）。

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

### `api/routes/flows.ts`

POST `/`（lane INSERT）と PUT `/:id`（構造更新時の lane INSERT）の SQL に `group_id`, `group_role` カラムを追加し bind する。

```ts
db.prepare(
  'INSERT INTO lanes (id, flow_id, name, color_index, position, group_id, group_role) VALUES (?, ?, ?, ?, ?, ?, ?)'
).bind(
  lane.id, flowId, lane.name, lane.colorIndex, lane.position,
  lane.groupId ?? null,
  lane.groupRole ?? null,
)
```

### `api/routes/shared.ts`

`toLane()` 経由で読み取るため **コード変更なし**。`flow-transform.ts` の修正だけで共有ビューにも統合情報が含まれる。

### `api/lib/validators.ts`

すでに `groupId` / `groupRole` を受理しているため **変更なし**。

### フロントエンド (`src/features/editor/`, `src/features/shared/`)

既に `groupId` / `groupRole` を送受信する実装（`FlowEditor.tsx`, `SharedFlowViewer.tsx`, `lane-group-utils.ts`）になっているため **コード変更なし**。

## テスト戦略

### ユニット (`api/lib/flow-transform.test.ts`)

- `toLane` が `group_id`/`group_role` を `groupId`/`groupRole` にマップする
- `toLane` が NULL を `undefined` に正規化する
- `toLane` が `'parent'` / `'sub'` 双方を保持する

### API ラウンドトリップ (`api/routes/flows.test.ts`)

- **ケースA**: POST → GET ラウンドトリップ。統合レーン (parent + sub × 2、同一 groupId) を含む POST 直後に GET → groupId/groupRole が一致
- **ケースB**: PUT → GET ラウンドトリップ（**Issue の本丸**）。既存フローを PUT で構造更新（統合レーン追加）→ GET → groupId/groupRole が一致
- **ケースC**: 単独レーン非破壊。groupId なしで POST → GET で `groupId === undefined`
- **ケースD**: CHECK 制約検証。`group_role = 'invalid'` の直接 INSERT が SQL エラーになる

### E2E (`tests/e2e/lane-merge-persistence.spec.ts` 新規)

- **ケース1**: 統合 → リロード → 統合維持
  1. ログイン → 新規 flow 作成
  2. レーン 2 つ追加
  3. レーン間ギャップをクリックして統合
  4. 統合状態を assert
  5. 自動保存待機（2.5 秒）
  6. `page.reload()`
  7. 統合状態が維持されている assert
- **ケース2**: 共有リンク経由でも統合表示
  1. ケース1の flow を共有 → token 取得
  2. 別コンテキストで `/shared/<token>` を開く
  3. 統合レーンが表示されている assert

## 実装順序

1. `migrations/0012_lane_groups.sql` を追加
2. **Red**: `flow-transform.test.ts` に `toLane` テスト 3 件追加 → 失敗確認
3. **Green**: `LaneRow` / `toLane()` 修正 → ユニット pass
4. **Red**: `flows.test.ts` にラウンドトリップ 4 ケース追加 → 失敗確認
5. **Green**: `flows.ts` POST / PUT INSERT に group_id, group_role 追加 → API pass
6. E2E `lane-merge-persistence.spec.ts` 新規作成
7. ローカル検証: `npm test` 全 pass、Playwright で実画面リロード確認
8. PR description に本番 D1 へのマイグレーション適用手順を明記

## リスクと対策

| リスク | 対策 |
|---|---|
| 本番 D1 にマイグレーションが適用されないままデプロイ | PR description に `wrangler d1 migrations apply` 手順を明記。受け入れ基準にも含める |
| 既存「壊れた」レーンの自動復元 | **スコープ外**。ユーザーが再操作で修復（Issue 既知の制限） |
| CHECK 制約違反 | フロント・validator (`z.enum(['parent','sub'])`) で防御済 → DB CHECK と二重防御 |
| テスト DB (better-sqlite3) と D1 の差異 | 標準 SQLite 構文のみ使用（ALTER TABLE ADD COLUMN, CHECK, partial index） |

## スコープ外（既知の制限）

- 既に本番 DB に保存済みの「統合のつもりだったが group_id 欠落」レーンの自動復元は行わない。ユーザーが再度統合操作をやり直すことで修復される
- 既存エクスポート JSON（`groupId` 欠落）のインポート復元は別タスク
