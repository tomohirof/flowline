# 同一行で間にノードがある矢印の迂回（Arrow Detour）設計

- Issue: [#314](https://github.com/tomohirof/flowline/issues/314)
- 作成日: 2026-04-29
- ステータス: Design 承認済 → Plan 作成へ

## 背景・目的

同一行（同じ `rid`）で複数レーンをまたぐ矢印（例: A→C）が、経路上にあるノード（B）を貫通してしまう。Issue #314 の画像 1 → 画像 2 のように、間にあるノードを回避して下（または上）に迂回する経路を生成する。

## スコープ

### 対象

- 同一行で `from` から `to` の間のレーンに 1 つ以上ノードが存在する場合の水平直線パスの迂回
- エディタ (`FlowEditor`) と共有ビュー (`SharedFlowViewer`) の両方

### 対象外

- 縦方向（同一レーンで `from` と `to` の間にノードがある）の貫通対応 — 発生頻度が低いため今回は据え置き
- 既存の Z 字 / L 字パス（縦横混合の出入口）に対する障害回避

## 受け入れ基準（Issue #314 より）

- [ ] 同一行で A→B、A→C があるとき、A→C が B を避けて下に迂回する
- [ ] 同一行で A→C 単独（B あり）の場合も同様に迂回する
- [ ] 同一行で A→B 単独（隣接レーン、間にノードなし）は従来どおり直線
- [ ] 直下にノードがある場合は上へ迂回
- [ ] 縦方向（同一レーン）の貫通は対象外で従来挙動のまま
- [ ] エディタと共有ビューアの両方で同じ挙動
- [ ] LCP 1 秒以内 / 全テスト pass / Playwright 目視確認

## アーキテクチャ概要

```
[呼び出し側]
  FlowEditor.aPath / SharedFlowViewer.computeArrowPath
    ↓ tasks/nodes から「同一行・直上行・直下行のノード bbox 配列」を組み立て
    ↓
[flow-engine.ts: calcArrowPath(from, to, config, obstacles?)]
    ↓ パススルー
    ↓
[arrow-routing.ts: buildArrowPath(s, e, fc, tc, obstacles?)]
    ├── detectDetour(s, e, obstacles)  — 内部関数
    │     ・経路上の障害ノード検出
    │     ・障害ノードの直下/直上塞がり判定
    │     ・戻り値: { detourY: number } | null
    └── detourY が得られたら迂回パス、null なら既存パス
```

### 責務分担

| レイヤ                                    | 責務                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| 呼び出し側 (`aPath` / `computeArrowPath`) | 同一行・直上行・直下行のノードを bbox 配列に変換して渡す。`from`/`to` 自身は除外         |
| `arrow-routing.ts`                        | 与えられた bbox 群から経路上の障害を抽出し、上下塞がり判定・迂回方向決定・パス生成を完結 |

## 型定義と API

### 新規型 (`arrow-routing.ts`)

```ts
export interface Bbox {
  x: number // 中心 X
  y: number // 中心 Y
  w: number // 幅
  h: number // 高さ
}
```

### `buildArrowPath` シグネチャ拡張

```ts
export const buildArrowPath = (
  s: Point,
  e: Point,
  fc: Point,
  tc: Point,
  obstacles?: Bbox[],   // ← 新規。同一行＋直上行＋直下行の候補ノード
): ArrowPath
```

### `calcArrowPath` シグネチャ拡張 (`flow-engine.ts`)

```ts
export function calcArrowPath(
  from: NodePos,
  to: NodePos,
  config: ArrowConfig,
  obstacles?: Bbox[], // ← 新規
): ArrowPathResult
```

### 内部定数・ヘルパー

```ts
const DETOUR_MARGIN = 14 // 行間 28px の中央

function detectDetour(s: Point, e: Point, obstacles: Bbox[]): { detourY: number } | null
```

### 後方互換性

- `obstacles` は省略可能。既存呼び出し（テスト含む）は変更不要
- `obstacles` が `undefined` または `[]` のとき、既存挙動と完全一致

## 検出アルゴリズム (`detectDetour`)

```ts
const DETOUR_MARGIN = 14

function detectDetour(s: Point, e: Point, obstacles: Bbox[]): { detourY: number } | null {
  // ① 水平直線でなければ迂回しない
  if (Math.abs(e.y - s.y) >= 2) return null

  const xLow = Math.min(s.x, e.x)
  const xHigh = Math.max(s.x, e.x)
  const rowY = s.y

  // ② 経路上の障害ノード = 同一行（rowY と Y が重なる）かつ X が始終点の間
  const inRow = obstacles.filter(
    (b) =>
      Math.abs(b.y - rowY) < b.h / 2 + 2 && b.x - b.w / 2 < xHigh - 1 && b.x + b.w / 2 > xLow + 1,
  )
  if (inRow.length === 0) return null

  // ③ 上下塞がり判定（X 重なりするノードが直上/直下に存在するか）
  const xOverlap = (a: Bbox, b: Bbox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2
  const downBlocked = inRow.some((obs) =>
    obstacles.some((b) => b.y > obs.y + 1 && xOverlap(obs, b)),
  )
  const upBlocked = inRow.some((obs) => obstacles.some((b) => b.y < obs.y - 1 && xOverlap(obs, b)))

  // ④ 方向決定: 下空きなら下、下塞がり＆上空きなら上、両塞がりは下優先
  const goDown = !downBlocked || upBlocked

  // ⑤ detourY: 障害ノード群の最下端＋マージン or 最上端－マージン
  const detourY = goDown
    ? Math.max(...inRow.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...inRow.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  return { detourY }
}
```

## 迂回パス生成 (`buildArrowPath` 内)

```ts
const detour = obstacles && obstacles.length > 0 ? detectDetour(s, e, obstacles) : null
if (detour) {
  const { detourY } = detour
  const d = `M${s.x},${s.y} L${s.x},${detourY} L${e.x},${detourY} L${e.x},${e.y}`
  return { d, mx: (s.x + e.x) / 2, my: detourY } // ラベルは迂回区間の中点
}
// ↓ 既存の直線/Z字/L字ロジック（変更なし）
```

## 呼び出し側の bbox 抽出ロジック

### `FlowEditor.aPath`

```ts
const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
  const ft = tasks[arrow.from],
    tt = tasks[arrow.to]
  if (!ft || !tt) return null
  const fli = liMap[ft.lid],
    fri = riMap[ft.rid]
  const tli = liMap[tt.lid],
    tri = riMap[tt.rid]
  if ([fli, fri, tli, tri].some((v) => v === undefined)) return null

  const from = ct(fli, fri)
  const to = ct(tli, tri)

  let obstacles: Bbox[] | undefined
  if (fri === tri) {
    // タスク → ObstacleNode[] に変換（自身も含めて全部、collectObstacles 側で from/to を除外）
    const nodes: ObstacleNode[] = []
    for (const [k, t] of Object.entries(tasks)) {
      const li = liMap[t.lid],
        ri = riMap[t.rid]
      if (li === undefined || ri === undefined) continue
      const c = ct(li, ri)
      nodes.push({ key: k, cx: c.x, cy: c.y })
    }
    obstacles = collectObstacles({
      nodes,
      fromKey: arrow.from,
      toKey: arrow.to,
      fromCx: from.x,
      toCx: to.x,
      rowY: from.y,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
  }

  return calcArrowPath(
    from,
    to,
    {
      hw: TW / 2,
      hh: TH / 2,
      rh: RH,
      fromShape: ft.shape ?? undefined,
      toShape: tt.shape ?? undefined,
    },
    obstacles,
  )
}
```

### `collectObstacles` ヘルパー（共通化）

`arrow-routing.ts` に薄いユーティリティとして export し、エディタ・ビューア両方から呼ぶ。

```ts
// arrow-routing.ts
export interface ObstacleNode {
  key: string
  cx: number // 中心 X
  cy: number // 中心 Y
}

export interface CollectObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  toCx: number
  rowY: number
  rowH: number // 行高さ（直上/直下行判定用）
  bboxW: number
  bboxH: number
}

export function collectObstacles(args: CollectObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCx, toCx, rowY, rowH, bboxW, bboxH } = args
  const xLow = Math.min(fromCx, toCx)
  const xHigh = Math.max(fromCx, toCx)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dy = Math.abs(n.cy - rowY)
    const onRow = dy < bboxH / 2 + 2
    // 直上/直下行のみを採用（2行以上離れたノードは無視）
    const onAdjacentRow = !onRow && dy > rowH - bboxH / 2 && dy < rowH + bboxH / 2
    if (onRow) {
      // 同一行: from-to 間レーンに限定
      if (n.cx > xLow + 1 && n.cx < xHigh - 1) {
        result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      }
    } else if (onAdjacentRow) {
      // 直上/直下行: 上下塞がり判定用に X 制限なしで含める
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
    }
  }
  return result
}
```

呼び出し側は `tasks` / `flow.nodes` を `ObstacleNode[]` に1度だけ変換して渡す。

### `SharedFlowViewer.computeArrowPath`

`flow.nodes` を `ObstacleNode[]` にマップして同じヘルパーを呼ぶ。bbox 抽出ロジックを共通化することで、エディタとビューアの挙動差を防ぐ。

## エラー処理・エッジケース

| ケース                                 | 期待挙動                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| `obstacles` が `undefined` または `[]` | 既存挙動完全一致                                               |
| 同一レーン縦方向矢印                   | 既存挙動（スコープ外）                                         |
| 同一行・隣接レーン、間にノードなし     | `inRow` 空 → 既存直線                                          |
| `from === to`（自己参照）              | `xLow === xHigh` → `inRow` 空 → 既存挙動                       |
| `from`/`to` 自身が bbox に混入         | 呼び出し側で除外 + arrow-routing 側でも X±1 マージンで二重防御 |
| 最上行で上塞がり判定                   | 直上行ノードが存在しない → 上塞がりは false → 仕様通り         |
| 浮きノード（liMap/riMap が undefined） | `collectObstacles` で除外                                      |
| 不正 bbox（w=0, h=0）                  | 起こり得ないが、X 重なり判定が自然に false → 副作用なし        |

## テスト戦略

### `src/lib/arrow-routing.test.ts`（新規 or 既存拡張）

| ケース                              | 期待                                               |
| ----------------------------------- | -------------------------------------------------- |
| `obstacles` 省略 / 空               | 既存パスと完全一致                                 |
| 同一行・障害1個・下空き             | 下迂回、`detourY = B.y + B.h/2 + 14`               |
| 同一行・障害1個・直下塞がり・上空き | 上迂回、`detourY = B.y - B.h/2 - 14`               |
| 同一行・障害1個・両塞がり           | 下迂回（下優先）                                   |
| 同一行・障害2個・下空き             | まとめて下迂回、`detourY = max(B,C の最下端) + 14` |
| 同一行・障害2個・1つだけ直下塞がり  | 上迂回（1つでも塞がっていれば上）                  |
| ラベル位置                          | 迂回時 `mx = (s.x+e.x)/2`, `my = detourY`          |
| `from`/`to` 自身が bbox に混入      | X±1 マージンで除外、迂回しない                     |

### `flow-engine.test.ts`（既存拡張）

- 既存テストは引数省略で通る（後方互換）
- `obstacles` を渡したときの 1〜2 ケース

### `collectObstacles` ヘルパーテスト

- 同一行・直上行・直下行のみが集まる
- `from`/`to` 自身が除外される
- 浮きノード（座標 undefined）が無視される

### 統合テスト

- FlowEditor: A→B、A→C 同一行 → A→C が下迂回 / B 直下にもノード → A→C は上迂回 / A→B 単独 → 直線
- SharedFlowViewer: 同等のシナリオ 1〜2 ケース

### Playwright 目視確認（Workflow Step 6）

1. A→B、A→C 同一行 → A→C が B を下に迂回
2. A→C 単独（B あり）→ 同様に下迂回
3. A→B 単独（隣接、間にノードなし）→ 従来直線
4. B 直下にもノード → A→C は上に迂回
5. 縦方向（同一レーン）は従来挙動のまま
6. LCP 1 秒以内

## 影響範囲（ファイル一覧）

- `src/lib/arrow-routing.ts` — `Bbox` 型, `buildArrowPath` 拡張, `detectDetour`, `collectObstacles`
- `src/lib/flow-engine.ts` — `calcArrowPath` の `obstacles` パススルー
- `src/features/editor/FlowEditor.tsx` — `aPath` での bbox 抽出 + 渡し
- `src/features/shared/SharedFlowViewer.tsx` — `computeArrowPath` での bbox 抽出 + 渡し
- `src/lib/flow-engine.test.ts` 等 — 既存テスト追加
- `src/lib/arrow-routing.test.ts` — 新規（または既存拡張）
