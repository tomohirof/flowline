# toSide + 四角形ノード side 指定

- 関連 issue: #355
- 関連 PR: #352 (#349 — fromSide for diamond)
- 関連 issue: #69（共有ビューと描画乖離 — 防止のため SharedFlowViewer も同時更新）

## 背景

#349 でひし形ノードの接続元 (`fromSide`) 指定を実装した。残るスコープは以下の 2 点:

1. **`toSide`**: 接続先（target 側）の頂点/辺を指定
2. **四角形ノード**: 現在 `fromSide` の honor は `shape === 'diamond'` 限定 → 四角形ノードでも上下左右の出口/入口指定を可能にする

両者は `exitPt` / `entryPt` の四角形分岐、UI セレクタ、DB マイグレーション、API シリアライズが密結合のため 1 PR にまとめる。

## 目標

- ドラッグ完了時に接続先のスナップ位置から `toSide` を導出して保存
- `entryPt` が `toSide` を受け取り、指定時はその頂点/辺を返す
- `exitPt` / `entryPt` の四角形分岐でも `fromSide` / `toSide` を honor
- プロパティパネル「出口側」セレクタを diamond/四角形どちらでも表示
- プロパティパネルに「入口側」セレクタを追加（diamond/四角形どちらでも）
- 既存矢印（`fromSide` / `toSide` 未指定）は従来の自動ロジック（後方互換）

## 非目標

- 始点エンドポイントをドラッグで掴み直す UX（別 issue）
- auto-connect 経路からの fromSide/toSide 推論（実害なし・実装効果なしと判断、見送り）

## 設計

### 型（shared 共有）

`src/lib/types.ts` の `InternalArrow` に `toSide?: ArrowSide` を追加（`ArrowSide` は既に #357 で `shared/types.ts` に集約済み）。

```ts
export interface InternalArrow {
  // ... 既存 ...
  fromSide?: ArrowSide
  toSide?: ArrowSide // 新規
}
```

### routing (`src/lib/arrow-routing.ts`)

#### `exitPt` の四角形分岐に fromSide 対応

```ts
export const exitPt = (
  c, o, hw, hh, rh,
  shape?: 'diamond',
  fromSide?: ArrowSide,
): Point => {
  if (shape === 'diamond') {
    // 既存 diamond 分岐（fromSide honor 含む）
    ...
  }
  // 新規: 四角形でも fromSide があれば優先
  if (fromSide === 'top')    return { x: c.x, y: c.y - hh }
  if (fromSide === 'right')  return { x: c.x + hw, y: c.y }
  if (fromSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (fromSide === 'left')   return { x: c.x - hw, y: c.y }
  // 既存 auto 分岐
  ...
}
```

#### `entryPt` を拡張して toSide を受ける

```ts
export const entryPt = (
  c, o, hw, hh, rh,
  shape?: 'diamond',
  toSide?: ArrowSide,
): Point => {
  if (shape === 'diamond') {
    if (toSide === 'top')    return { x: c.x, y: c.y - DS }
    if (toSide === 'right')  return { x: c.x + DS, y: c.y }
    if (toSide === 'bottom') return { x: c.x, y: c.y + DS }
    if (toSide === 'left')   return { x: c.x - DS, y: c.y }
    // 既存 diamond auto 分岐
    ...
  }
  // 四角形でも toSide があれば優先
  if (toSide === 'top')    return { x: c.x, y: c.y - hh }
  if (toSide === 'right')  return { x: c.x + hw, y: c.y }
  if (toSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (toSide === 'left')   return { x: c.x - hw, y: c.y }
  // 既存 auto 分岐
  ...
}
```

#### `deriveToSide` の追加

数学的には `deriveFromSide(origin, center)` と同一（`dx = point.x - center.x` の符号と `dy` の比較で side を決定）。コードの readable さのため別関数として export し、内部実装は再利用:

```ts
/** ドロップ点 (point) とターゲットノード中心 (center) の位置関係から
 *  どの側に接続するかを判定する。deriveFromSide と同一ロジック。 */
export const deriveToSide = deriveFromSide
```

### `calcArrowPath` (`src/lib/flow-engine.ts`)

`ArrowConfig` に `toSide?: ArrowSide` を追加し、`entryPt` に渡す:

```ts
interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
  fromSide?: ArrowSide
  toSide?: ArrowSide // 新規
}

// calcArrowPath 内部
const e = entryPt(t, f, config.hw, config.hh, config.rh, config.toShape, config.toSide)
```

### DB マイグレーション

`migrations/0014_arrow_to_side.sql`:

```sql
-- Issue #355: 矢印に入口側 (toSide) を持たせる
-- diamond/四角形どちらでも意味を持つ。NULL は自動（既存ロジック）。
ALTER TABLE arrows ADD COLUMN to_side TEXT;
```

### API

#### `api/lib/flow-transform.ts`

```ts
export interface ArrowRow {
  // ... 既存 ...
  from_side: ArrowSide | null
  to_side: ArrowSide | null // 新規
  // ...
}

export function toArrow(row: ArrowRow) {
  return {
    // ... 既存 ...
    fromSide: row.from_side,
    toSide: row.to_side, // 新規
    // ...
  }
}
```

#### `api/lib/validators.ts`

```ts
const arrowSchema = z.object({
  // ... 既存 ...
  fromSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
  toSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(), // 新規
})
```

#### `api/routes/flows.ts`

INSERT 文 2 箇所に `to_side` カラムと `arrow.toSide ?? null` を追加。

### Frontend

#### `src/features/editor/FlowEditor.tsx`

ドラッグ完了時（line 1062 周辺）:

```ts
// 接続元: 既存の diamond ガードを撤廃し、shape に関わらず fromSide を派生
let fromSide: ArrowSide | undefined
if (connectFromPt) {
  const srcLi = liMap[srcTask.lid]
  const srcRi = riMap[srcTask.rid]
  if (srcLi !== undefined && srcRi !== undefined) {
    const sc = ct(srcLi, srcRi)
    fromSide = deriveFromSide(connectFromPt, sc)
  }
}

// 接続先: 新規 toSide を派生（ドロップ点とターゲットノード中心から）
const toSide: ArrowSide | undefined = deriveToSide(pt, c)

setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '', fromSide, toSide }])
```

矢印描画（line 1442 の calcArrowPath 呼び出し）:

```ts
return calcArrowPath(
  from,
  to,
  {
    hw: TW / 2,
    hh: TH / 2,
    rh: RH,
    fromShape: ft.shape ?? undefined,
    toShape: tt.shape ?? undefined,
    fromSide: arrow.fromSide,
    toSide: arrow.toSide, // 新規
  },
  obstacles,
)
```

load/save transform (line 144, 215 周辺): `toSide` も同様にパススルー。

#### `src/features/shared/SharedFlowViewer.tsx`

calcArrowPath 呼び出しに `toSide: arrow.toSide ?? undefined` を追加。

#### `src/features/editor/components/RightPanel.tsx`

- 「出口側」セクションの diamond ガード `tasks[selArrowData.from]?.shape === 'diamond'` を撤廃 → 矢印選択中は常に表示
- その直下に「入口側」セクションを追加（同じ 5 択 UI、`selArrowData.toSide` を読み書き）

#### i18n

`src/locales/{ja,en}/editor.json` に `rightPanel.arrowToSide` を追加。

```json
// ja
"arrowToSide": "入口側"
// en
"arrowToSide": "Entry side"
```

## 検証

### TDD で追加するテスト

- `arrow-routing.test.ts`:
  - `exitPt`: 四角形 + fromSide=top/right/bottom/left → 上下左右の辺中央
  - `entryPt`: 四角形 + toSide=各方向 → 対応する辺中央
  - `entryPt`: diamond + toSide=各方向 → 対応する頂点
  - `deriveToSide`: deriveFromSide と同一結果（基本パリティ）
- `flow-engine.test.ts`:
  - `calcArrowPath`: ArrowConfig.toSide を渡すと entryPt に届く（diamond/rect の両ケース）
  - 既存矢印（toSide 未指定）の挙動が変化しないこと

### 既存テストの維持

- 全 1645 テスト pass
- API ラウンドトリップで toSide が保存・取得される

### 実画面確認

- 矢印選択 → 「入口側」セレクタ表示、5 択（自動/上/右/下/左）クリックで即時描画反映
- 四角形ノード同士の矢印で出口/入口側が指定通りに動く
- ひし形 → 四角形矢印で `toSide=left` 指定 → 左辺中央から入る
- 既存矢印（toSide=null）は変化なし
- 共有ビューで完全一致（#69 防止）

## 影響範囲

- 新規: `migrations/0014_arrow_to_side.sql`, ja/en に `arrowToSide` キー追加
- 修正:
  - `src/lib/types.ts`, `src/features/editor/types.ts`
  - `src/lib/arrow-routing.ts`, `src/lib/arrow-routing.test.ts`
  - `src/lib/flow-engine.ts`, `src/lib/flow-engine.test.ts`
  - `src/features/editor/FlowEditor.tsx`
  - `src/features/shared/SharedFlowViewer.tsx`
  - `src/features/editor/components/RightPanel.tsx`
  - `api/lib/flow-transform.ts`, `api/lib/validators.ts`, `api/routes/flows.ts`
  - 各種テスト

## 工数見積

3-4 時間（型・routing 実装 1h、API/DB 30min、UI 1h、テスト 1h、検証 30min）
