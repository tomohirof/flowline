# Arrow Detour 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一行で複数レーンをまたぐ矢印が経路上のノードを貫通する問題を解消し、自動で下（または上）に迂回するパスを生成する。

**Architecture:** `arrow-routing.ts` の `buildArrowPath` に第5引数 `obstacles?: Bbox[]` を追加。内部ヘルパー `detectDetour` が「水平直線・経路上に障害ノードあり」を検知し迂回 Y 座標を返す。`collectObstacles` ヘルパーが「同一行＋直上・直下行のノード」を bbox 化。`FlowEditor.aPath` と `SharedFlowViewer.computeArrowPath` が同ヘルパーで bbox を組み立てて渡す。

**Tech Stack:** TypeScript, React, Vitest, Playwright

**Spec:** `docs/plans/2026-04-29-arrow-detour-design.md`

**Issue:** [#314](https://github.com/tomohirof/flowline/issues/314)

---

## 想定座標系（テスト中で繰り返し使う基準）

`hw = 76`, `hh = 28`, `rh = 84`（`TW = 152`, `TH = 56`, `RH = 84`）

- ノード A: 中心 `(200, 200)`
- ノード B: 中心 `(400, 200)`（同一行）
- ノード C: 中心 `(600, 200)`（同一行、A の右）
- ノード D: 中心 `(400, 284)`（B の直下、`rid+1`）
- ノード E: 中心 `(400, 116)`（B の直上、`rid-1`）

矢印 A→C:
- `exitPt(A, C)` → 横出口 `s = (276, 200)`（A.x + hw）
- `entryPt(C, A)` → 横入口 `e = (524, 200)`（C.x - hw）

B の bbox `{ x: 400, y: 200, w: 152, h: 56 }`:
- 最下端 = `200 + 28 = 228`
- 最上端 = `200 - 28 = 172`

`DETOUR_MARGIN = 14` のとき:
- 下迂回 detourY = `228 + 14 = 242`
- 上迂回 detourY = `172 - 14 = 158`

---

## File Structure

| ファイル | 役割 |
|----------|------|
| `src/lib/arrow-routing.ts` | `Bbox`/`ObstacleNode`/`CollectObstaclesArgs` 型, `DETOUR_MARGIN`, `detectDetour`（内部）, `buildArrowPath` 拡張, `collectObstacles` |
| `src/lib/flow-engine.ts` | `calcArrowPath` の `obstacles` パススルー |
| `src/features/editor/FlowEditor.tsx` | `aPath` で bbox 抽出 + `calcArrowPath` 呼び出し |
| `src/features/shared/SharedFlowViewer.tsx` | `computeArrowPath` で bbox 抽出 + `buildArrowPath` 呼び出し |
| `src/lib/arrow-routing.test.ts` | 新規。`Bbox`/`detectDetour`（buildArrowPath 経由）、`collectObstacles` のテスト |
| `src/lib/flow-engine.test.ts` | `calcArrowPath` の `obstacles` パススルーテスト追加 |

---

## Task 1: arrow-routing.ts に Bbox 型と buildArrowPath の obstacles 引数を追加（TDD）

**Files:**
- Create: `src/lib/arrow-routing.test.ts`
- Modify: `src/lib/arrow-routing.ts`

- [ ] **Step 1: 新規テストファイル `src/lib/arrow-routing.test.ts` を作成し、buildArrowPath の `obstacles` 拡張に関するテストを書く（FAIL を確認するための失敗テスト）**

```ts
import { describe, it, expect } from 'vitest'
import { buildArrowPath, type Bbox } from './arrow-routing'

describe('buildArrowPath - obstacles 引数（迂回モード）', () => {
  // 共通の始終点（A→C 同一行、A=(200,200), C=(600,200) のときの exitPt/entryPt 後の値）
  const s = { x: 276, y: 200 }
  const e = { x: 524, y: 200 }
  const fc = { x: 200, y: 200 }
  const tc = { x: 600, y: 200 }

  it('obstacles 省略 → 既存の直線パスを返す（後方互換）', () => {
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.d).toBe('M276,200 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(200)
  })

  it('obstacles が空配列 → 既存の直線パスを返す', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    expect(r.d).toBe('M276,200 L524,200')
  })

  it('同一行・障害1個・上下空き → 下迂回パス（detourY = 障害下端 + 14）', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    // detourY = 200 + 28 + 14 = 242
    expect(r.d).toBe('M276,200 L276,242 L524,242 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  it('同一行・障害1個・直下塞がり → 上迂回（detourY = 障害上端 - 14）', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const D: Bbox = { x: 400, y: 284, w: 152, h: 56 } // B の直下
    const r = buildArrowPath(s, e, fc, tc, [B, D])
    // detourY = 200 - 28 - 14 = 158
    expect(r.d).toBe('M276,200 L276,158 L524,158 L524,200')
    expect(r.my).toBe(158)
  })

  it('同一行・障害1個・両塞がり → 下優先で下迂回', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const D: Bbox = { x: 400, y: 284, w: 152, h: 56 }
    const E: Bbox = { x: 400, y: 116, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, D, E])
    expect(r.my).toBe(242) // 下迂回
  })

  it('同一行・障害2個・下空き → まとめて下迂回（detourY は最下端の最大）', () => {
    const B: Bbox = { x: 380, y: 200, w: 152, h: 56 }   // 最下端 228
    const C2: Bbox = { x: 480, y: 200, w: 152, h: 80 }  // 最下端 240
    // 始終点を広げる: A=(200,200) → 終点=(700,200)
    const sExt = { x: 276, y: 200 }
    const eExt = { x: 624, y: 200 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 700, y: 200 }, [B, C2])
    // 最下端 max(228, 240) = 240, detourY = 254
    expect(r.my).toBe(254)
    expect(r.d).toBe('M276,200 L276,254 L624,254 L624,200')
  })

  it('同一行・障害2個・1つだけ直下塞がり → 上迂回', () => {
    const B: Bbox = { x: 380, y: 200, w: 152, h: 56 }
    const C2: Bbox = { x: 480, y: 200, w: 152, h: 56 }
    const Bdown: Bbox = { x: 380, y: 284, w: 152, h: 56 }  // B 直下のみ塞がり
    const sExt = { x: 276, y: 200 }
    const eExt = { x: 624, y: 200 }
    const r = buildArrowPath(
      sExt, eExt,
      { x: 200, y: 200 }, { x: 700, y: 200 },
      [B, C2, Bdown],
    )
    // 1つでも直下塞がりがあれば上迂回。最上端 min(172, 172) = 172, detourY = 158
    expect(r.my).toBe(158)
  })

  it('同一行・障害なし（経路上に bbox がない）→ 直線', () => {
    // bbox が始終点 X 範囲外
    const farLeft: Bbox = { x: 100, y: 200, w: 152, h: 56 }
    const farRight: Bbox = { x: 800, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [farLeft, farRight])
    expect(r.d).toBe('M276,200 L524,200')
  })

  it('斜め方向（dy >= 2）→ 既存の Z/L 字ロジック（迂回しない）', () => {
    // s=(276,200), e=(524,300) のような斜めパス
    const sDiag = { x: 276, y: 200 }
    const eDiag = { x: 524, y: 300 }
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(sDiag, eDiag, { x: 200, y: 200 }, { x: 600, y: 300 }, [B])
    // dy=100, dx=248: 縦出口でない（s.y - fc.y = 0, s.x - fc.x = 76 → sV false）
    // 横出口→縦入口（または両横）→ 既存ロジックの結果
    expect(r.d).not.toContain('L276,242')  // 迂回パスではない
  })

  it('始終点が同じ X（自己参照） → inRow 空 → 直線', () => {
    const B: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(
      { x: 200, y: 200 }, { x: 200, y: 200 },
      { x: 200, y: 200 }, { x: 200, y: 200 },
      [B],
    )
    expect(r.d).toBe('M200,200 L200,200')
  })

  it('from/to 自身の bbox が混入しても X±1 マージンで除外される', () => {
    // start=(276,200) の真上にある bbox（A 自身を表すかのような位置）は inRow 判定で除外される
    const fromSelfBbox: Bbox = { x: 200, y: 200, w: 152, h: 56 }  // 左端 124, 右端 276
    const toSelfBbox: Bbox = { x: 600, y: 200, w: 152, h: 56 }    // 左端 524, 右端 676
    const r = buildArrowPath(s, e, fc, tc, [fromSelfBbox, toSelfBbox])
    // どちらも inRow フィルタの X 判定で除外される（X±1 マージン）
    expect(r.d).toBe('M276,200 L524,200')
  })
})
```

- [ ] **Step 2: テスト実行 → FAIL を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts`
Expected: 全テスト FAIL（`Bbox` 型なし、`buildArrowPath` が 5 引数を受け付けない）

- [ ] **Step 3: `src/lib/arrow-routing.ts` に Bbox 型と buildArrowPath 拡張を実装**

`src/lib/arrow-routing.ts` のファイル先頭の `Point` インターフェースの直後に追加:

```ts
export interface Bbox {
  x: number  // 中心 X
  y: number  // 中心 Y
  w: number  // 幅
  h: number  // 高さ
}

const DETOUR_MARGIN = 14

function detectDetour(
  s: Point,
  e: Point,
  obstacles: Bbox[],
): { detourY: number } | null {
  // 水平直線でなければ迂回しない
  if (Math.abs(e.y - s.y) >= 2) return null

  const xLow = Math.min(s.x, e.x)
  const xHigh = Math.max(s.x, e.x)
  const rowY = s.y

  // 経路上の障害ノード = 同一行（rowY と Y が重なる）かつ X が始終点の間
  const inRow = obstacles.filter(
    (b) =>
      Math.abs(b.y - rowY) < b.h / 2 + 2 &&
      b.x - b.w / 2 < xHigh - 1 &&
      b.x + b.w / 2 > xLow + 1,
  )
  if (inRow.length === 0) return null

  // 上下塞がり判定（X 重なりするノードが直上/直下に存在するか）
  const xOverlap = (a: Bbox, b: Bbox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2
  const downBlocked = inRow.some((obs) =>
    obstacles.some((b) => b.y > obs.y + 1 && xOverlap(obs, b)),
  )
  const upBlocked = inRow.some((obs) =>
    obstacles.some((b) => b.y < obs.y - 1 && xOverlap(obs, b)),
  )

  // 方向決定: 下空きなら下、下塞がり＆上空きなら上、両塞がりは下優先
  const goDown = !downBlocked || upBlocked

  // detourY: 障害ノード群の最下端 + マージン or 最上端 - マージン
  const detourY = goDown
    ? Math.max(...inRow.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...inRow.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  return { detourY }
}
```

そして既存の `buildArrowPath` の宣言と本体を以下に置き換える:

```ts
export const buildArrowPath = (
  s: Point,
  e: Point,
  fc: Point,
  tc: Point,
  obstacles?: Bbox[],
): ArrowPath => {
  const dx = e.x - s.x,
    dy = e.y - s.y

  // 迂回モード: 同一行で経路上に障害ノードがある場合
  if (obstacles && obstacles.length > 0) {
    const detour = detectDetour(s, e, obstacles)
    if (detour) {
      const { detourY } = detour
      const d = `M${s.x},${s.y} L${s.x},${detourY} L${e.x},${detourY} L${e.x},${e.y}`
      return { d, mx: (s.x + e.x) / 2, my: detourY }
    }
  }

  let d: string

  // 直線パス: ほぼ垂直またはほぼ水平
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    d = `M${s.x},${s.y} L${e.x},${e.y}`
  } else {
    // 出口が縦方向かどうかを判定（ノード中心との差で判別）
    const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
    const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

    if (sV && eV) {
      // 両方縦出口: Z字パス（横方向に折り返す）
      const my = (s.y + e.y) / 2
      d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）
      const mx = (s.x + e.x) / 2
      d = `M${s.x},${s.y} L${mx},${s.y} L${mx},${e.y} L${e.x},${e.y}`
    } else if (sV) {
      // 縦出口→横入口: L字パス
      d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
    } else {
      // 横出口→縦入口: L字パス
      d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
    }
  }

  return { d, mx: (s.x + e.x) / 2, my: (s.y + e.y) / 2 }
}
```

- [ ] **Step 4: テスト実行 → PASS を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts`
Expected: 全テスト PASS

- [ ] **Step 5: 既存テスト全件実行（リグレッション確認）**

Run: `npm test`
Expected: 既存テストも含めて全 PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#314): add Bbox type and obstacle-aware arrow detour to buildArrowPath"
```

---

## Task 2: flow-engine.ts の calcArrowPath を obstacles パススルーに拡張（TDD）

**Files:**
- Modify: `src/lib/flow-engine.ts`
- Modify: `src/lib/flow-engine.test.ts`

- [ ] **Step 1: `src/lib/flow-engine.test.ts` の `describe('calcArrowPath', ...)` ブロックの末尾（既存テストの後）に obstacles テストを追加**

`src/lib/flow-engine.test.ts` の既存 `describe('calcArrowPath', ...)` ブロックの最後の `it` の後ろに以下を追加:

```ts
  it('should pass obstacles through to buildArrowPath and produce detour path', () => {
    // A=(200,200) → C=(600,200) 同一行、間に B (400,200) 障害
    const obstacles = [{ x: 400, y: 200, w: 152, h: 56 }]
    const r = calcArrowPath(
      { x: 200, y: 200 },
      { x: 600, y: 200 },
      { hw: 76, hh: 28, rh: 84 },
      obstacles,
    )
    expect(r).not.toBeNull()
    // exitPt: dx=400 横出口 {276,200}, entryPt: 横入口 {524,200}
    // 迂回: detourY = 228 + 14 = 242
    expect(r.d).toBe('M276,200 L276,242 L524,242 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  it('should ignore obstacles when arrow is not horizontal', () => {
    const obstacles = [{ x: 200, y: 200, w: 152, h: 56 }]
    const r = calcArrowPath(
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { hw: 76, hh: 28, rh: 84 },
      obstacles,
    )
    // 縦パスなので obstacles 無視 → 既存の直線
    expect(r.d).toBe('M100,128 L100,272')
  })
```

- [ ] **Step 2: テスト実行 → FAIL を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts -t "obstacles"`
Expected: FAIL（`calcArrowPath` が 4 引数を受け付けない）

- [ ] **Step 3: `src/lib/flow-engine.ts` の `calcArrowPath` を拡張**

ファイル冒頭の import を:

```ts
import { exitPt, entryPt, buildArrowPath } from './arrow-routing'
import type { Point, Bbox } from './arrow-routing'
```

`calcArrowPath` の関数定義を以下に置き換える:

```ts
export function calcArrowPath(
  from: NodePos,
  to: NodePos,
  config: ArrowConfig,
  obstacles?: Bbox[],
): ArrowPathResult {
  const f: Point = { x: from.x, y: from.y }
  const t: Point = { x: to.x, y: to.y }
  const s = exitPt(f, t, config.hw, config.hh, config.rh, config.fromShape)
  const e = entryPt(t, f, config.hw, config.hh, config.rh, config.toShape)
  return buildArrowPath(s, e, f, t, obstacles)
}
```

- [ ] **Step 4: テスト実行 → PASS を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 既存テスト含む全 PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat(#314): pass obstacles through calcArrowPath to buildArrowPath"
```

---

## Task 3: arrow-routing.ts に collectObstacles ヘルパー追加（TDD）

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: `src/lib/arrow-routing.test.ts` の末尾に collectObstacles のテストを追加**

ファイル先頭の import を:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildArrowPath,
  collectObstacles,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
```

ファイル末尾に新規 describe ブロック追加:

```ts
describe('collectObstacles', () => {
  // A=(200,200), B=(400,200), C=(600,200) 同一行 (rowY=200)
  // D=(400,284) B 直下行, E=(400,116) B 直上行
  // F=(400,368) 2行下（除外対象）
  const TW = 152, TH = 56, RH = 84

  const baseNodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 200 },
    { key: 'B', cx: 400, cy: 200 },
    { key: 'C', cx: 600, cy: 200 },
    { key: 'D', cx: 400, cy: 284 },
    { key: 'E', cx: 400, cy: 116 },
    { key: 'F', cx: 400, cy: 368 },
  ]

  it('A→C: 同一行の B（from-to 間）と直上 E・直下 D を集める。F（2行下）は除外', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // B (同一行・間), D (直下), E (直上) が含まれる
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(result).toHaveLength(3)
    expect(cxs).toEqual([400, 400, 400])
    // F (cy=368) は除外
    expect(result.every((b) => b.y !== 368)).toBe(true)
  })

  it('from/to 自身は除外される', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // A, C は含まれない
    const ys = result.map((b) => `${b.x},${b.y}`)
    expect(ys).not.toContain('200,200')
    expect(ys).not.toContain('600,200')
  })

  it('A→B（隣接、間にノードなし）: 同一行は from-to 間限定なので空、直上下は X 制限なしで含む', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'B',
      fromCx: 200,
      toCx: 400,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // 同一行: A=200, B=400 が from/to で除外。C=600 は X 範囲外で除外。→ 0件
    // 直上下: D, E, F は X 制限なしだが F は 2行下で除外。D, E のみ含まれる。
    expect(result).toHaveLength(2)
    const cys = result.map((b) => b.y).sort((a, b) => a - b)
    expect(cys).toEqual([116, 284])
  })

  it('Bbox の w, h は引数の bboxW, bboxH と一致する', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result.every((b) => b.w === TW && b.h === TH)).toBe(true)
  })
})
```

- [ ] **Step 2: テスト実行 → FAIL を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts`
Expected: 新規テスト FAIL（`collectObstacles` 未定義）

- [ ] **Step 3: `src/lib/arrow-routing.ts` の末尾に collectObstacles 実装を追加**

```ts
export interface ObstacleNode {
  key: string
  cx: number  // 中心 X
  cy: number  // 中心 Y
}

export interface CollectObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  toCx: number
  rowY: number
  rowH: number    // 行高さ（直上/直下行判定用）
  bboxW: number
  bboxH: number
}

/**
 * 矢印の同一行・直上行・直下行にあるノードを bbox 配列に変換する。
 * 同一行は from-to 間レーンに限定。直上/直下行は X 制限なしで含める（上下塞がり判定用）。
 * from/to 自身および 2 行以上離れたノードは除外する。
 */
export function collectObstacles(args: CollectObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCx, toCx, rowY, rowH, bboxW, bboxH } = args
  const xLow = Math.min(fromCx, toCx)
  const xHigh = Math.max(fromCx, toCx)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dy = Math.abs(n.cy - rowY)
    const onRow = dy < bboxH / 2 + 2
    // 直上/直下行のみを採用（dy が rowH に近い）。2行以上離れたノードは除外。
    const onAdjacentRow = !onRow && dy > rowH - bboxH / 2 && dy < rowH + bboxH / 2
    if (onRow) {
      // 同一行: from-to 間レーンに限定（始終点 X は除外）
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

- [ ] **Step 4: テスト実行 → PASS を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts`
Expected: 全テスト PASS

- [ ] **Step 5: 全テスト実行（リグレッション確認）**

Run: `npm test`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#314): add collectObstacles helper for in-row + adjacent-row bbox extraction"
```

---

## Task 4: FlowEditor.aPath を更新して obstacles を渡す

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: import に collectObstacles, Bbox, ObstacleNode 型を追加**

`src/features/editor/FlowEditor.tsx:36` の既存 import 文:

```ts
import { DS } from '../../lib/arrow-routing'
```

を以下に置き換える:

```ts
import {
  DS,
  collectObstacles,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
```

`flow-engine` 由来の `calcArrowPath` import（`src/features/editor/FlowEditor.tsx:50`）は変更不要。

- [ ] **Step 2: `aPath` 関数を obstacles 抽出付きに更新**

`src/features/editor/FlowEditor.tsx` の `aPath` 関数（`src/features/editor/FlowEditor.tsx:1362` 付近）を以下に置き換える:

```ts
  const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
    const ft = tasks[arrow.from],
      tt = tasks[arrow.to]
    if (!ft || !tt) return null
    const fli = liMap[ft.lid],
      fri = riMap[ft.rid],
      tli = liMap[tt.lid],
      tri = riMap[tt.rid]
    if ([fli, fri, tli, tri].some((v) => v === undefined)) return null
    const from = ct(fli, fri)
    const to = ct(tli, tri)

    // 同一行のときのみ obstacles を組み立てる
    let obstacles: Bbox[] | undefined
    if (fri === tri) {
      const nodes: ObstacleNode[] = []
      for (const k of Object.keys(tasks)) {
        const t = tasks[k]
        const li = liMap[t.lid]
        const ri = riMap[t.rid]
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

- [ ] **Step 3: TypeScript 型チェック・全テスト実行**

Run: `npm test`
Expected: 全 PASS（既存テストへの影響なし、aPath は外部 API ではないので単体テストはなし）

- [ ] **Step 4: dev server を起動して目視確認（手動チェックポイント）**

Run: `npm run dev`

ブラウザで以下を確認:
1. 既存フローを開いて、矢印が従来どおり描画されるか（リグレッションなし）
2. 同一行 A→B、A→C の構成を作って A→C が B を下に迂回するか
3. B の直下にノードを配置して A→C が上に迂回するか

問題があれば Step 2 に戻って修正。

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#314): wire obstacles into FlowEditor.aPath via collectObstacles"
```

---

## Task 5: SharedFlowViewer.computeArrowPath を更新して obstacles を渡す

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`

- [ ] **Step 1: import に collectObstacles, Bbox, ObstacleNode を追加**

`src/features/shared/SharedFlowViewer.tsx` の冒頭、既存の `arrow-routing` import を以下のように拡張:

```ts
import {
  exitPt,
  entryPt,
  buildArrowPath,
  collectObstacles,
  DS,
  type Point,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
```

- [ ] **Step 2: `computeArrowPath` を obstacles 抽出付きに更新**

既存の `computeArrowPath` 関数（`src/features/shared/SharedFlowViewer.tsx:93` 付近）を以下に置き換える:

```ts
  // Arrow path calculation
  const computeArrowPath = (arrow: Arrow): { d: string; mx: number; my: number } | null => {
    const fromNode = nodeById[arrow.fromNodeId]
    const toNode = nodeById[arrow.toNodeId]
    if (!fromNode || !toNode) return null

    const fli = laneIdToIndex[fromNode.laneId]
    const tli = laneIdToIndex[toNode.laneId]
    if (fli === undefined || tli === undefined) return null

    const f = ct(fli, fromNode.rowIndex)
    const t = ct(tli, toNode.rowIndex)
    const hw = TW / 2,
      hh = TH / 2
    const s = exitPt(f, t, hw, hh, RH, fromNode.shape as 'diamond' | undefined)
    const e = entryPt(t, f, hw, hh, RH, toNode.shape as 'diamond' | undefined)

    // 同一行のときのみ obstacles を組み立てる
    let obstacles: Bbox[] | undefined
    if (fromNode.rowIndex === toNode.rowIndex) {
      const nodes: ObstacleNode[] = []
      for (const n of flow.nodes) {
        const li = laneIdToIndex[n.laneId]
        if (li === undefined) continue
        const c = ct(li, n.rowIndex)
        nodes.push({ key: n.id, cx: c.x, cy: c.y })
      }
      obstacles = collectObstacles({
        nodes,
        fromKey: fromNode.id,
        toKey: toNode.id,
        fromCx: f.x,
        toCx: t.x,
        rowY: f.y,
        rowH: RH,
        bboxW: TW,
        bboxH: TH,
      })
    }

    return buildArrowPath(s, e, f, t, obstacles)
  }
```

- [ ] **Step 3: 全テスト実行**

Run: `npm test`
Expected: 全 PASS

- [ ] **Step 4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#314): wire obstacles into SharedFlowViewer.computeArrowPath"
```

---

## Task 6: Playwright で実画面検証（受け入れ基準シナリオ）

**Files:**
- Save: `.screenshots/issue-314-*.png`

- [ ] **Step 1: dev server を起動**

Run: `npm run dev`

- [ ] **Step 2: Playwright で受け入れ基準のシナリオを実行**

`mcp__playwright__browser_navigate` で `http://localhost:5173`（または該当ポート）にアクセスし、以下を確認:

1. **A→B、A→C 同一行 → A→C が B を下に迂回**
   - 同一行に A, B, C を配置（A→B, A→C 矢印）
   - スクリーンショット: `.screenshots/issue-314-down-detour.png`
2. **A→C 単独（B あり）も同様に下迂回**
   - A→B 矢印を削除し A→C のみにする
   - スクリーンショット: `.screenshots/issue-314-down-detour-no-ab.png`
3. **A→B 単独（隣接、間にノードなし）→ 直線**
   - 並びを A, B のみにして A→B
   - スクリーンショット: `.screenshots/issue-314-adjacent-line.png`
4. **B の直下にノード → A→C は上に迂回**
   - B の直下行（同レーン rid+1）に追加ノード D を配置
   - スクリーンショット: `.screenshots/issue-314-up-detour.png`
5. **同一レーンの縦方向は従来挙動（迂回しない）**
   - A の同レーン下にノードを配置し、その下にさらにもう1つ → 縦の矢印が貫通する従来挙動のままを確認
   - スクリーンショット: `.screenshots/issue-314-vertical-unchanged.png`

- [ ] **Step 3: LCP（Largest Contentful Paint）測定**

`mcp__playwright__browser_evaluate` で以下を実行し、LCP が 1 秒以内であることを確認:

```js
new Promise((resolve) => {
  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    resolve(entries[entries.length - 1].startTime)
  }).observe({ type: 'largest-contentful-paint', buffered: true })
})
```

LCP > 1000ms の場合は実装パフォーマンスを見直す。

- [ ] **Step 4: 共有ビューでも同様に確認**

共有リンクを発行（または既存の共有 URL を使用）し、同じ A→C 構成が共有ビューでも下迂回するか確認。
- スクリーンショット: `.screenshots/issue-314-shared-view-detour.png`

- [ ] **Step 5: 全テスト最終実行**

Run: `npm test`
Expected: 全 PASS

- [ ] **Step 6: スクリーンショットをコミット（gitignore でなければ）**

`.screenshots/` は `.gitignore` に含まれているため、目視確認のみで OK。コミット不要。
