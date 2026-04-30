# 縦方向（同一レーン）の矢印迂回ロジック

- 関連 issue: [#333](https://github.com/tomohirof/flowline/issues/333)
- 前段 issue: [#314](https://github.com/tomohirof/flowline/issues/314)（横方向の迂回）
- 関連懸念: [#328](https://github.com/tomohirof/flowline/issues/328)（depart 脚クリアランス）

## 背景と目的

issue #314 で「同一行（横方向）で A→C の間に B があるとき迂回」する処理を実装したが、対象外としていた **同一レーン（縦方向）** で同じ問題が残っている。

例: 同一レーン (`lid` 同じ) で `rowIndex` が離れた A→C の矢印が、間にあるノード B を貫通する。

本仕様では、横方向の迂回ロジックを **完全な対称形** で縦方向にも適用し、両方向の迂回を提供する。

## 受け入れ基準（issue 抜粋）

- 同一レーン（`fli === tli`）で A→C の直線パス上に他ノードがあるとき、それらを避けて迂回する
- 迂回方向は **右優先**。直右にもノードがあれば左へ迂回。両方塞がっていれば右優先（横方向の「下優先」と対称）
- 障害が無ければ従来どおりの垂直直線
- 横方向の挙動（issue #314）は従来通り（regression なし）
- Diamond ノードを始点/終点/障害として含む縦方向迂回でも崩れない
- エディタ (`FlowEditor`) と共有ビューア (`SharedFlowViewer`) 両方で同じ挙動

## スコープ外

- 斜め配置（同一行でも同一レーンでもない）でパス上にノードがある場合の迂回（issue #314 と同方針で従来 L 字/Z 字 パスのまま）
- depart 脚クリアランス問題の根本対応（#328 で別途対応。本 issue では縦版でも同じ単純 GAP 定数を採用し、regression リスクを横版と同等に揃える）

## 設計

### アプローチ概要

横方向ロジックの **対称コピー** として縦方向ロジックを追加する。共通化（軸抽象化）は行わず、変数名の可読性と既存テストのコードパス保護を優先する。

具体的には:

1. `arrow-routing.ts` に `detectVerticalDetour` を追加
2. `arrow-routing.ts` に `collectVerticalObstacles` を追加（既存 `collectObstacles` は無変更）
3. `buildArrowPath` で水平直線/垂直直線を判別して dispatch
4. 呼び出し側 (`FlowEditor.aPath`, `SharedFlowViewer.computeArrowPath`) は `fri === tri` のとき `collectObstacles`、`fli === tli` のとき `collectVerticalObstacles` を呼ぶ

### `arrow-routing.ts` の変更

#### 定数

横版と同値・対称設計なので **同一定数を共有** する（命名追加なし）:

- `DETOUR_MARGIN = 14` — 迂回方向（横版: Y / 縦版: X）のオフセット
- `APPROACH_GAP = 14` — 終点側の最終セグメント長
- `DEPART_GAP = 14` — 始点側の初動セグメント長

#### `detectVerticalDetour`

横版 `detectDetour` を Y↔X 入れ替えで対称化する:

```ts
function detectVerticalDetour(
  s: Point, e: Point, obstacles: Bbox[]
): { detourX: number } | null {
  // 垂直直線でなければ迂回しない
  if (Math.abs(e.x - s.x) >= 2) return null

  const yLow = Math.min(s.y, e.y)
  const yHigh = Math.max(s.y, e.y)
  const colX = s.x

  // 垂直移動がなければ迂回対象なし
  if (yLow >= yHigh - 1) return null

  // 経路上の障害ノード = 同一列（colX と X が重なる）かつ Y が始終点の間
  const inCol = obstacles.filter(
    (b) =>
      Math.abs(b.x - colX) < b.w / 2 + 2 &&
      b.y - b.h / 2 < yHigh - 1 &&
      b.y + b.h / 2 > yLow + 1,
  )
  if (inCol.length === 0) return null

  // 左右塞がり判定（Y 重なりするノードが直左/直右に存在するか）
  // 前提: obstacles 配列には呼び出し側で「同一列＋直左列＋直右列のみ」をフィルタ済み
  const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
  const rightBlocked = inCol.some((obs) =>
    obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
  )
  const leftBlocked = inCol.some((obs) =>
    obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
  )

  // 方向決定: 右空きなら右、右塞がり＆左空きなら左、両塞がりは右優先
  const goRight = !rightBlocked || leftBlocked

  // detourX: 障害ノード群の最右端 + マージン or 最左端 - マージン
  const detourX = goRight
    ? Math.max(...inCol.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
    : Math.min(...inCol.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN

  return { detourX }
}
```

#### `buildArrowPath` の dispatch

横版の早期 return（`Math.abs(e.y - s.y) >= 2`）と縦版の早期 return（`Math.abs(e.x - s.x) >= 2`）は排他的なので、**両方を順に試す** 形で良い:

```ts
if (obstacles && obstacles.length > 0) {
  const hDetour = detectDetour(s, e, obstacles)         // 水平直線のとき
  if (hDetour) {
    // 既存の 6 セグメント水平迂回パス
  }
  const vDetour = detectVerticalDetour(s, e, obstacles) // 垂直直線のとき
  if (vDetour) {
    // 6 セグメント垂直迂回パス（下記）
  }
}
```

#### 縦方向 6 セグメントパス

```
M(s.x, s.y)
L(s.x, departY)         // 短い垂直 depart
L(detourX, departY)     // 水平に迂回 X へ
L(detourX, approachY)   // 垂直で目的 Y 近傍まで降下/上昇
L(s.x, approachY)       // 水平に戻す（s.x === e.x なので）
L(e.x, e.y)             // 最終垂直
```

横版 clamp と対称に、`Math.abs(dy) / 2` で `DEPART_GAP` / `APPROACH_GAP` を clamp して自己交差を防ぐ:

```ts
const sign = Math.sign(dy)
const halfDy = Math.abs(dy) / 2
const departY = s.y + sign * Math.min(DEPART_GAP, halfDy)
const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
return { d, mx: detourX, my: (s.y + e.y) / 2 }
```

### `collectVerticalObstacles` の新設

既存 `collectObstacles` は **無変更**（横方向専用として保持）。縦方向用に対称な API を新設する:

```ts
interface CollectVerticalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCy: number     // 始点 Y
  toCy: number       // 終点 Y
  colX: number       // 同一列 X（始点・終点共通）
  colW: number       // 列ピッチ（FlowEditor の LW + G を渡す）
  bboxW: number
  bboxH: number
}

export function collectVerticalObstacles(args: CollectVerticalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCy, toCy, colX, colW, bboxW, bboxH } = args
  const yLow = Math.min(fromCy, toCy)
  const yHigh = Math.max(fromCy, toCy)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dx = Math.abs(n.cx - colX)
    const onCol = dx < bboxW / 2 + 2
    const onAdjacentCol = !onCol && dx > colW - bboxW / 2 && dx < colW + bboxW / 2
    if (onCol) {
      // 同一列: from-to 間レンジに限定（始終点 Y は除外）
      if (n.cy > yLow + 1 && n.cy < yHigh - 1) {
        result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      }
    } else if (onAdjacentCol) {
      // 直左/直右列: 左右塞がり判定用に Y 制限なしで含める
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
    }
  }
  return result
}
```

代案として両関数を `mode` 引数で統一することも検討したが、API 引数の半分が「未使用」になる awkward さが避けられないため、対称な 2 関数構成を採用。共通化が必要になった時点で内部リファクタリングは可能。

### 呼び出し側の変更

#### `FlowEditor.aPath` (src/features/editor/FlowEditor.tsx 行 1386)

```ts
let obstacles: Bbox[] | undefined
if (fri === tri) {
  obstacles = collectObstacles({
    nodes: obstacleNodes,
    fromKey: arrow.from, toKey: arrow.to,
    fromCx: from.x, toCx: to.x,
    rowY: from.y, rowH: RH,
    bboxW: TW, bboxH: TH,
  })
} else if (fli === tli) {
  obstacles = collectVerticalObstacles({
    nodes: obstacleNodes,
    fromKey: arrow.from, toKey: arrow.to,
    fromCy: from.y, toCy: to.y,
    colX: from.x, colW: LW + G,
    bboxW: TW, bboxH: TH,
  })
}
```

`LW + G` がレーンピッチ（`laneX(li) = LM + li * (LW + G)` より）。グループ親レーンの幅 (`getGroupWidth`) は header 表示のみで、ノードの実 X 位置はすべて uniform pitch なのでこの値で正しい。

#### `SharedFlowViewer.computeArrowPath` (src/features/shared/SharedFlowViewer.tsx 行 133)

`FlowEditor` と同様に `fromNode.rowIndex === toNode.rowIndex` / `fromNode.laneId === toNode.laneId` で `mode` を切り替え。`LW + G` を `colW` に渡す。

## テスト

### 単体テスト（`arrow-routing.test.ts`）

横方向テストの **完全な鏡像** を縦方向で追加:

1. `obstacles 省略 → 既存の直線パス（垂直直線）`
2. `obstacles が空配列 → 既存の直線パス`
3. `同一列・障害1個・左右空き → 右迂回パス（detourX = 障害右端 + 14）`
4. `同一列・障害1個・直右塞がり → 左迂回（detourX = 障害左端 - 14）`
5. `同一列・障害1個・両塞がり → 右優先で右迂回`
6. `同一列・障害2個・右空き → まとめて右迂回（detourX は最右端の最大）`
7. `同一列・障害2個・1つだけ直右塞がり → 左迂回`
8. `同一列・障害なし → 直線`
9. `斜め方向（dx >= 2）→ 既存の Z/L 字ロジック（迂回しない）`
10. `始終点が同じ Y（自己参照） → inCol 空 → 直線`
11. `from/to 自身の bbox が混入しても Y±1 マージンで除外される`
12. `同一列・下→上方向でも右迂回する（s.y > e.y）`
13. `垂直 depart＋垂直 approach（始終点とも垂直）の 6 セグメント形状確認`
14. `垂直距離が DEPART_GAP*2 未満の場合 departY/approachY は中央で接合し自己交差しない`

`collectVerticalObstacles` のテスト:

15. `A→C: 同一列の B と直左/直右列を集める。2列離れたノードは除外`
16. `from/to 自身は除外される`
17. `A→B（隣接、間にノードなし）: 同一列は from-to 間限定なので空、直左/直右列は Y 制限なしで含む`
18. `下→上方向でも正しく抽出（fromCy > toCy）`

回帰テスト: 既存の横方向テスト 17 件が全 pass であることを確認。

### Playwright 目視確認

エディタと共有ビューア両方で:

- 同一レーンで A→C の間に B を置き、矢印が右迂回することを確認
- B の直右に別ノードを置き、左迂回に切り替わることを確認
- Diamond ノードを始点/終点/障害に含む組み合わせで崩れないことを確認
- 横方向の迂回（既存）に regression がないことを確認

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `src/lib/arrow-routing.ts` | `detectVerticalDetour` 追加、`buildArrowPath` で dispatch、`collectVerticalObstacles` 新設 |
| `src/lib/arrow-routing.test.ts` | 縦方向迂回テスト 14 件 + `collectVerticalObstacles` テスト 4 件追加 |
| `src/features/editor/FlowEditor.tsx` | `aPath` の `obstacles` 組み立て条件を `fri === tri || fli === tli` に拡張、`mode` で呼び分け |
| `src/features/shared/SharedFlowViewer.tsx` | `computeArrowPath` を同様に拡張 |

## 既知の懸念と対応

### A. レーン幅が一定か（issue 既出）

**確認済み**: `laneX(li) = LM + li * (LW + G)` で uniform pitch。グループ親レーンの幅 (`getGroupWidth`) は header 表示のみで、ノードの実 X 位置には影響しない。`LW + G` を `colW` として渡せばよい。

### B. depart 脚クリアランス問題（#328 の縦版）

縦版でも `DEPART_GAP` の短い垂直 depart を入れるため、密レイアウトで「s.y → departY 区間が直近の障害物を貫通」する同じ regression が起こりうる。

**対応**: 本 issue は横版と同じ単純な定数 GAP で実装する。縦版の clamp は #328 のスコープを「両方向」に拡張して別途解決する（本 issue ではテストで明示的にスコープ外としてコメント記載）。
