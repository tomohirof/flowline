# issue #346: 斜め配置矢印 Z字パスの中間行ノード貫通修正 — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 斜め配置 (異行×異レーン) の矢印 Z字パスが中間行のノードを貫通するバグを修正する。`detectDiagonalDetour` と `collectDiagonalObstacles` を新規追加し、Z字パス 3 セグメント全てに衝突判定を入れる。

**Architecture:** 既存 `collectObstacles` / `collectVerticalObstacles` / `detectDetour` / `detectVerticalDetour` には触れず、新規 `Diagonal` 系関数として独立実装。`buildArrowPath` の斜め分岐に迂回判定を追加し、`FlowEditor.aPath` / `SharedFlowViewer.computeArrowPath` の obstacles 組み立て分岐に `else` 節を 1 行追加する。

**Tech Stack:** TypeScript, React, Vitest, SVG path arithmetic, Playwright (目視確認)

**Spec:** [docs/superpowers/specs/2026-05-22-issue-346-diagonal-arrow-detour-design.md](../specs/2026-05-22-issue-346-diagonal-arrow-detour-design.md)

---

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `src/lib/arrow-routing.ts` | Modify | 新規 `collectDiagonalObstacles` / `detectDiagonalDetour` 追加、`buildArrowPath` の斜め分岐拡張 |
| `src/lib/arrow-routing.test.ts` | Modify | 新規 detector / collector の単体テスト、`buildArrowPath` 統合テスト、regression テスト |
| `src/features/editor/FlowEditor.tsx` | Modify | `aPath` の obstacles 組み立てに diagonal 分岐追加 (1 箇所) |
| `src/features/shared/SharedFlowViewer.tsx` | Modify | `computeArrowPath` の obstacles 組み立てに diagonal 分岐追加 (1 箇所) |

---

## 共通テスト fixture

以降のタスクで使用する座標 (post-exitPt/entryPt 後の値):

- **source 中心**: `f = (200, 100)`
- **target 中心**: `t = (600, 400)`
- **s (source bottom)**: `(200, 128)`
- **e (target top)**: `(600, 372)`
- **初期 my**: `(128 + 372) / 2 = 250`
- **bbox**: `w = 152, h = 56`
- **source 列 x**: 200
- **target 列 x**: 600
- **中央行 Y**: 250

定数: `DETOUR_MARGIN = 14`, `APPROACH_GAP = 14`, `DEPART_GAP = 14` (既存)

---

### Task 1: `collectDiagonalObstacles` の skeleton + from/to 除外

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/arrow-routing.test.ts` の末尾 (last `describe` 後) に追加:

```ts
describe('collectDiagonalObstacles', () => {
  const baseArgs = {
    fromKey: 'A',
    toKey: 'C',
    fromCx: 200,
    fromCy: 100,
    toCx: 600,
    toCy: 400,
    rowH: 84,
    colW: 200,
    bboxW: 152,
    bboxH: 56,
  }

  it('should exclude from/to nodes themselves when only from/to exist', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([])
  })
})
```

ファイル先頭の import に `collectDiagonalObstacles` を追加:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `collectDiagonalObstacles` is not exported / not a function

- [ ] **Step 3: Write minimal implementation**

`src/lib/arrow-routing.ts` の末尾 (last `export function` 後) に追加:

```ts
interface CollectDiagonalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  fromCy: number
  toCx: number
  toCy: number
  rowH: number
  colW: number
  bboxW: number
  bboxH: number
}

/**
 * 斜め配置矢印 (異行×異レーン) の Z字パスに沿った障害ノードを bbox 配列で返す。
 * source 列・target 列・中央行・各列の隣接列を広めに収集し、detector 側で再フィルタする。
 * from/to 自身と Z字パスから離れたノードは除外する。
 */
export function collectDiagonalObstacles(args: CollectDiagonalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey } = args
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    // TODO: 後続タスクで収集ロジックを追加
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): add collectDiagonalObstacles skeleton with from/to exclusion"
```

---

### Task 2: `collectDiagonalObstacles` - source 列ストリップ収集

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

`describe('collectDiagonalObstacles', ...)` 内に追加:

```ts
it('should collect source-column obstacle between source and target rows', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 200, cy: 250 }, // source 列 (x=200), 中央行
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([{ x: 200, y: 250, w: 152, h: 56 }])
})

it('should not collect source-column nodes outside Z-path Y range', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 200, cy: 50 },  // source 行より上 (out of range)
    { key: 'D', cx: 200, cy: 450 }, // target 行より下 (out of range)
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — empty array returned, expected `{ x: 200, y: 250, ... }`

- [ ] **Step 3: Update implementation**

`collectDiagonalObstacles` 内のループに追加:

```ts
export function collectDiagonalObstacles(args: CollectDiagonalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCx, fromCy, toCx, toCy, bboxW, bboxH } = args
  const yLow = Math.min(fromCy, toCy)
  const yHigh = Math.max(fromCy, toCy)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const onSourceCol = Math.abs(n.cx - fromCx) < bboxW / 2 + 2
    const inZRangeY = n.cy > yLow + 1 && n.cy < yHigh - 1
    if (onSourceCol && inZRangeY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS (both new tests + Task 1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): collectDiagonalObstacles picks up source-column obstacles"
```

---

### Task 3: `collectDiagonalObstacles` - target 列ストリップ収集

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should collect target-column obstacle between source and target rows', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 600, cy: 250 }, // target 列 (x=600), 中央行
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([{ x: 600, y: 250, w: 152, h: 56 }])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `[]` returned, expected `[{ x: 600, ... }]`

- [ ] **Step 3: Update implementation**

`collectDiagonalObstacles` ループ内に分岐追加:

```ts
    const onSourceCol = Math.abs(n.cx - fromCx) < bboxW / 2 + 2
    const onTargetCol = Math.abs(n.cx - toCx) < bboxW / 2 + 2
    const inZRangeY = n.cy > yLow + 1 && n.cy < yHigh - 1
    if ((onSourceCol || onTargetCol) && inZRangeY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): collectDiagonalObstacles picks up target-column obstacles"
```

---

### Task 4: `collectDiagonalObstacles` - 中央行ストリップ収集

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should collect middle-row obstacle between source and target X', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 400, cy: 250 }, // 中央 X、中央行 Y
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([{ x: 400, y: 250, w: 152, h: 56 }])
})

it('should not collect nodes outside Z-path X range at middle row', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 50, cy: 250 },  // source の左 (out of range)
    { key: 'D', cx: 750, cy: 250 }, // target の右 (out of range, 隣接列でもない)
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — middle row node not collected

- [ ] **Step 3: Update implementation**

```ts
    const onSourceCol = Math.abs(n.cx - fromCx) < bboxW / 2 + 2
    const onTargetCol = Math.abs(n.cx - toCx) < bboxW / 2 + 2
    const inZRangeY = n.cy > yLow + 1 && n.cy < yHigh - 1
    if ((onSourceCol || onTargetCol) && inZRangeY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
    const midY = (fromCy + toCy) / 2
    const onMiddleRow = Math.abs(n.cy - midY) < bboxH / 2 + 2
    const xLow = Math.min(fromCx, toCx)
    const xHigh = Math.max(fromCx, toCx)
    const inZRangeX = n.cx > xLow + 1 && n.cx < xHigh - 1
    if (onMiddleRow && inZRangeX) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): collectDiagonalObstacles picks up middle-row obstacles"
```

---

### Task 5: `collectDiagonalObstacles` - 隣接列 (左右1列) 収集

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('should collect source-adjacent-column obstacle within extended Y range', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 400, cy: 100 }, // source の右隣列 (x=200+colW=400), source 行と同じ Y
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toContainEqual({ x: 400, y: 100, w: 152, h: 56 })
})

it('should collect target-adjacent-column obstacle for direction decision', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 800, cy: 400 }, // target の右隣列 (x=600+colW=800)
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toContainEqual({ x: 800, y: 400, w: 152, h: 56 })
})

it('should not collect adjacent-column nodes outside extended Y range', () => {
  const nodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 100 },
    { key: 'B', cx: 400, cy: 800 }, // source の右隣列だが Y が範囲外
    { key: 'C', cx: 600, cy: 400 },
  ]
  const r = collectDiagonalObstacles({ nodes, ...baseArgs })
  expect(r).toEqual([])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — adjacent column nodes not collected

- [ ] **Step 3: Update implementation**

`collectDiagonalObstacles` 内のループに分岐追加:

```ts
    const { nodes, fromKey, toKey, fromCx, fromCy, toCx, toCy, rowH, colW, bboxW, bboxH } = args
    // ... 既存収集ロジックの後 ...

    const onSourceAdjacentCol =
      Math.abs(n.cx - fromCx) > colW - bboxW / 2 && Math.abs(n.cx - fromCx) < colW + bboxW / 2
    const onTargetAdjacentCol =
      Math.abs(n.cx - toCx) > colW - bboxW / 2 && Math.abs(n.cx - toCx) < colW + bboxW / 2
    const inExtendedY = n.cy >= yLow - rowH / 2 && n.cy <= yHigh + rowH / 2
    if ((onSourceAdjacentCol || onTargetAdjacentCol) && inExtendedY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
```

注: `rowH` と `colW` を関数先頭の destructure に追加すること。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): collectDiagonalObstacles picks up adjacent-column obstacles"
```

---

### Task 6: `detectDiagonalDetour` - null ガード (水平・垂直・空配列)

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

import に `detectDiagonalDetour` を追加:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  detectDiagonalDetour,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
```

新規 describe を `collectDiagonalObstacles` の describe 後に追加:

```ts
describe('detectDiagonalDetour', () => {
  const s = { x: 200, y: 128 }
  const e = { x: 600, y: 372 }

  it('should return null when arrow is horizontal (|dy| < 2)', () => {
    const r = detectDiagonalDetour({ x: 200, y: 200 }, { x: 600, y: 201 }, [
      { x: 400, y: 200, w: 152, h: 56 },
    ])
    expect(r).toBeNull()
  })

  it('should return null when arrow is vertical (|dx| < 2)', () => {
    const r = detectDiagonalDetour({ x: 200, y: 100 }, { x: 201, y: 400 }, [
      { x: 200, y: 250, w: 152, h: 56 },
    ])
    expect(r).toBeNull()
  })

  it('should return null with empty obstacles array', () => {
    expect(detectDiagonalDetour(s, e, [])).toBeNull()
  })

  it('should return null when no obstacles intersect Z-path', () => {
    const farAway: Bbox = { x: 50, y: 50, w: 152, h: 56 }
    expect(detectDiagonalDetour(s, e, [farAway])).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `detectDiagonalDetour` is not exported

- [ ] **Step 3: Write minimal implementation**

`src/lib/arrow-routing.ts` の `detectVerticalDetour` 関数の後 (line 103 付近) に追加:

```ts
type DiagonalDetourResult =
  | { kind: 'shift-my'; my: number }
  | { kind: 'target-detour'; my: number; detourX: number; approachY: number }
  | { kind: 'source-detour'; departY: number; detourX: number; my: number }
  | {
      kind: 'both-detour'
      departY: number
      sourceDetourX: number
      my: number
      targetDetourX: number
      approachY: number
    }

/**
 * 斜め配置矢印 (異行×異レーン) の Z字パス 3 セグメント (source 縦/中央水平/target 縦) と
 * 障害ノードの衝突を判定し、迂回パスを記述する DiagonalDetourResult を返す。
 * 障害なしまたは斜めでない (水平・垂直直線) ときは null を返す。
 *
 * 優先順位:
 *   sourceColHit && targetColHit → 'both-detour' (8 セグ)
 *   targetColHit                 → 'target-detour' (6 セグ、core ケース)
 *   sourceColHit                 → 'source-detour' (6 セグ、鏡像)
 *   middleRowHit のみ             → 'shift-my' (4 セグ維持)
 */
export function detectDiagonalDetour(
  s: Point,
  e: Point,
  obstacles: Bbox[],
): DiagonalDetourResult | null {
  if (Math.abs(e.x - s.x) < 2 || Math.abs(e.y - s.y) < 2) return null
  if (obstacles.length === 0) return null

  // TODO: 後続タスクで衝突判定を追加
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): add detectDiagonalDetour skeleton with null guards"
```

---

### Task 7: `detectDiagonalDetour` - target-detour (右優先) を返す

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

`describe('detectDiagonalDetour', ...)` 内に追加:

```ts
it('should return target-detour when obstacle is in target column between my and e.y', () => {
  // s=(200,128), e=(600,372), initial my = 250
  // 障害 B は target 列 (x=600) の中央行 (y=250)
  const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
  const r = detectDiagonalDetour(s, e, [B])
  expect(r).toEqual({
    kind: 'target-detour',
    my: 250,
    detourX: 600 + 76 + 14, // 690 (右迂回: 障害右端 + DETOUR_MARGIN)
    approachY: 372 - 14,    // 358
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `null` returned

- [ ] **Step 3: Update implementation**

`detectDiagonalDetour` の本体を実装:

```ts
export function detectDiagonalDetour(
  s: Point,
  e: Point,
  obstacles: Bbox[],
): DiagonalDetourResult | null {
  if (Math.abs(e.x - s.x) < 2 || Math.abs(e.y - s.y) < 2) return null
  if (obstacles.length === 0) return null

  const my = (s.y + e.y) / 2

  // source 列衝突: source 縦セグメント (s.y → my) と重なる障害
  const sourceColHits = obstacles.filter((b) => {
    const yLow = Math.min(s.y, my)
    const yHigh = Math.max(s.y, my)
    return (
      Math.abs(b.x - s.x) < b.w / 2 + 2 &&
      b.y - b.h / 2 < yHigh - 1 &&
      b.y + b.h / 2 > yLow + 1
    )
  })

  // target 列衝突: target 縦セグメント (my → e.y) と重なる障害
  const targetColHits = obstacles.filter((b) => {
    const yLow = Math.min(my, e.y)
    const yHigh = Math.max(my, e.y)
    return (
      Math.abs(b.x - e.x) < b.w / 2 + 2 &&
      b.y - b.h / 2 < yHigh - 1 &&
      b.y + b.h / 2 > yLow + 1
    )
  })

  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    // 方向決定: target 列障害の左右塞がり判定
    const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
    const rightBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const leftBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const goRight = !rightBlocked || leftBlocked
    const detourX = goRight
      ? Math.max(...targetColHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...targetColHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    const sign = Math.sign(e.y - my)
    const halfDy = Math.abs(e.y - my) / 2
    const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
    return { kind: 'target-detour', my, detourX, approachY }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): detectDiagonalDetour returns target-detour for target-column obstacle"
```

---

### Task 8: `detectDiagonalDetour` - target-detour 左迂回 (右塞がり時)

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should return target-detour with left-side detourX when target column is right-blocked', () => {
  const B: Bbox = { x: 600, y: 250, w: 152, h: 56 } // target 列障害
  const R: Bbox = { x: 800, y: 250, w: 152, h: 56 } // 直右に障害 (Y 重なり)
  const r = detectDiagonalDetour(s, e, [B, R])
  expect(r).toEqual({
    kind: 'target-detour',
    my: 250,
    detourX: 600 - 76 - 14, // 510 (左迂回)
    approachY: 358,
  })
})

it('should prefer right detour when both sides of target column are blocked', () => {
  const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
  const R: Bbox = { x: 800, y: 250, w: 152, h: 56 }
  const L: Bbox = { x: 400, y: 250, w: 152, h: 56 }
  const r = detectDiagonalDetour(s, e, [B, R, L])
  expect(r).toEqual({
    kind: 'target-detour',
    my: 250,
    detourX: 690, // 右優先
    approachY: 358,
  })
})
```

- [ ] **Step 2: Run tests to verify they fail / pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: 1個目 (左迂回) FAIL、2個目 (両塞がり右優先) PASS (既存ロジックで動く)

- [ ] **Step 3: Verify left detour logic works (no code change needed)**

Task 7 で実装した左右判定ロジックは既に正しく左迂回を返すはず。失敗テストの原因が `detourX` 計算式の符号ミスでないか確認:
- `goRight = !rightBlocked || leftBlocked` → 右塞がり&左空きで `false`
- `detourX = goRight ? max(右端)+14 : min(左端)-14` → 左迂回時は `600 - 76 - 14 = 510` ✓

実装変更不要。テストのみ追加。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#346): cover target-detour direction (left side, both-blocked priority)"
```

---

### Task 9: `detectDiagonalDetour` - source-detour (鏡像)

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should return source-detour when obstacle is in source column between s.y and my', () => {
  const B: Bbox = { x: 200, y: 250, w: 152, h: 56 } // source 列 (x=200), 中央行
  const r = detectDiagonalDetour(s, e, [B])
  expect(r).toEqual({
    kind: 'source-detour',
    departY: 128 + 14, // 142
    detourX: 200 + 76 + 14, // 290 (右優先)
    my: 250,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `null` returned

- [ ] **Step 3: Update implementation**

`detectDiagonalDetour` の `target-detour` 分岐の後に追加:

```ts
  if (sourceColHits.length > 0 && targetColHits.length === 0) {
    const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
    const rightBlocked = sourceColHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const leftBlocked = sourceColHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const goRight = !rightBlocked || leftBlocked
    const detourX = goRight
      ? Math.max(...sourceColHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...sourceColHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    const sign = Math.sign(my - s.y)
    const halfDy = Math.abs(my - s.y) / 2
    const departY = s.y + sign * Math.min(DEPART_GAP, halfDy)
    return { kind: 'source-detour', departY, detourX, my }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): detectDiagonalDetour returns source-detour for source-column obstacle"
```

---

### Task 10: `detectDiagonalDetour` - shift-my (中央水平のみ衝突)

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should return shift-my when only middle horizontal segment is blocked', () => {
  // 中央 X (x=400), 中央行 Y (y=250) — source/target 列に重ならない
  const B: Bbox = { x: 400, y: 250, w: 152, h: 56 }
  const r = detectDiagonalDetour(s, e, [B])
  expect(r).toEqual({
    kind: 'shift-my',
    my: 250 + 28 + 14, // 292 (下優先: 障害下端 + DETOUR_MARGIN)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `null` returned

- [ ] **Step 3: Update implementation**

`detectDiagonalDetour` の `source-detour` 分岐の後に追加:

```ts
  // 中央水平セグメント衝突: Y ≈ my で X が源-標的間
  const middleRowHits = obstacles.filter((b) => {
    const xLow = Math.min(s.x, e.x)
    const xHigh = Math.max(s.x, e.x)
    return (
      Math.abs(b.y - my) < b.h / 2 + 2 &&
      b.x - b.w / 2 < xHigh - 1 &&
      b.x + b.w / 2 > xLow + 1
    )
  })

  if (middleRowHits.length > 0 && sourceColHits.length === 0 && targetColHits.length === 0) {
    // 上下塞がり判定 (xOverlap で X 方向に重なる障害を直上/直下から探す)
    const xOverlap = (a: Bbox, b: Bbox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2
    const downBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => b.y > obs.y + 1 && xOverlap(obs, b)),
    )
    const upBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => b.y < obs.y - 1 && xOverlap(obs, b)),
    )
    const goDown = !downBlocked || upBlocked
    const shiftedMy = goDown
      ? Math.max(...middleRowHits.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
      : Math.min(...middleRowHits.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

    // ガード: shiftedMy が source 行 / target 行を侵食しないこと
    const yLow = Math.min(s.y, e.y)
    const yHigh = Math.max(s.y, e.y)
    const bboxHEst = middleRowHits[0]?.h ?? 56
    const lo = yLow + bboxHEst / 2 + 1
    const hi = yHigh - bboxHEst / 2 - 1
    if (shiftedMy >= lo && shiftedMy <= hi) {
      return { kind: 'shift-my', my: shiftedMy }
    }
    // 範囲外 → 後続タスクで target-detour 昇格 (Task 11)
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): detectDiagonalDetour returns shift-my for middle-row obstacle"
```

---

### Task 11: `detectDiagonalDetour` - shift-my エスカレーション → target-detour

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should escalate to target-detour when shift-my would exceed row bounds', () => {
  // 狭い dy: s=(200,128), e=(600,172), my=150. ガード幅は実質ゼロ。
  const sNarrow = { x: 200, y: 128 }
  const eNarrow = { x: 600, y: 172 }
  const B: Bbox = { x: 400, y: 150, w: 152, h: 56 } // 中央 X、中央行近傍
  const r = detectDiagonalDetour(sNarrow, eNarrow, [B])
  expect(r?.kind).toBe('target-detour')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — `null` returned (escalation 未実装)

- [ ] **Step 3: Update implementation**

`detectDiagonalDetour` 内、shift-my ガード失敗時に `middleRowHits` を `targetColHits` 扱いで再度 target-detour ロジックを実行:

`shift-my` ブロックの最後の `// 範囲外 → 後続タスクで target-detour 昇格 (Task 11)` 行を以下に置き換え:

```ts
    // 範囲外 → 中央障害を targetColHit 扱いで target-detour に昇格
    const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
    const rightBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const leftBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const goRight2 = !rightBlocked || leftBlocked
    const detourX = goRight2
      ? Math.max(...middleRowHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...middleRowHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    const sign = Math.sign(e.y - my)
    const halfDy = Math.abs(e.y - my) / 2
    const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
    return { kind: 'target-detour', my, detourX, approachY }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): detectDiagonalDetour escalates shift-my to target-detour on row clamp"
```

---

### Task 12: `detectDiagonalDetour` - both-detour (両列衝突)

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should return both-detour when source and target columns both have obstacles', () => {
  const Bs: Bbox = { x: 200, y: 250, w: 152, h: 56 } // source 列
  const Bt: Bbox = { x: 600, y: 250, w: 152, h: 56 } // target 列
  const r = detectDiagonalDetour(s, e, [Bs, Bt])
  expect(r).toEqual({
    kind: 'both-detour',
    departY: 142,
    sourceDetourX: 290,
    my: 250,
    targetDetourX: 690,
    approachY: 358,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: FAIL — 現状は `target-detour` が返る (sourceColHits も targetColHits も両方ある条件分岐がない)

- [ ] **Step 3: Update implementation**

`detectDiagonalDetour` の最初に `both-detour` 分岐を追加。`source-detour` / `target-detour` 分岐の **前** に挿入:

```ts
  // 両列衝突 → 8 セグメント二重迂回
  if (sourceColHits.length > 0 && targetColHits.length > 0) {
    const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
    // source 列の方向決定
    const srcRightBlocked = sourceColHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const srcLeftBlocked = sourceColHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const srcGoRight = !srcRightBlocked || srcLeftBlocked
    const sourceDetourX = srcGoRight
      ? Math.max(...sourceColHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...sourceColHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    // target 列の方向決定
    const tgtRightBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const tgtLeftBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const tgtGoRight = !tgtRightBlocked || tgtLeftBlocked
    const targetDetourX = tgtGoRight
      ? Math.max(...targetColHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...targetColHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    // depart / approach Y
    const signS = Math.sign(my - s.y)
    const halfDyS = Math.abs(my - s.y) / 2
    const departY = s.y + signS * Math.min(DEPART_GAP, halfDyS)
    const signE = Math.sign(e.y - my)
    const halfDyE = Math.abs(e.y - my) / 2
    const approachY = e.y - signE * Math.min(APPROACH_GAP, halfDyE)
    return { kind: 'both-detour', departY, sourceDetourX, my, targetDetourX, approachY }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): detectDiagonalDetour returns both-detour for both-column collision"
```

---

### Task 13: `buildArrowPath` - 斜め分岐に target-detour を統合

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

新規 describe を `collectVerticalObstacles` の describe 後に追加:

```ts
describe('buildArrowPath - 斜め迂回（異行×異レーン）', () => {
  // s=(200,128), e=(600,372), fc=(200,100), tc=(600,400)
  const s = { x: 200, y: 128 }
  const e = { x: 600, y: 372 }
  const fc = { x: 200, y: 100 }
  const tc = { x: 600, y: 400 }

  it('should produce 6-segment target-detour path when obstacle in target column (core bug case)', () => {
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.d).toBe('M200,128 L200,250 L690,250 L690,358 L600,358 L600,372')
    expect(r.mx).toBe((200 + 690) / 2)
    expect(r.my).toBe(250)
  })

  it('should produce default Z-path when no obstacles intersect (diagonal)', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    // 既存 Z字: M(s.x,s.y) L(s.x,my) L(e.x,my) L(e.x,e.y)
    expect(r.d).toBe('M200,128 L200,250 L600,250 L600,372')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: 1個目 FAIL (target-detour 未統合)、2個目 PASS

- [ ] **Step 3: Update buildArrowPath**

`src/lib/arrow-routing.ts` の `buildArrowPath` 内、`detectVerticalDetour` 分岐 (line 221-235) の **後** に追加:

```ts
    const dDetour = detectDiagonalDetour(s, e, obstacles)
    if (dDetour) {
      if (dDetour.kind === 'target-detour') {
        const { my, detourX, approachY } = dDetour
        const d = `M${s.x},${s.y} L${s.x},${my} L${detourX},${my} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
        return { d, mx: (s.x + detourX) / 2, my }
      }
      // 後続タスクで source-detour / both-detour / shift-my 分岐を追加
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): buildArrowPath emits target-detour 6-segment path"
```

---

### Task 14: `buildArrowPath` - source-detour / both-detour / shift-my 統合

**Files:**
- Modify: `src/lib/arrow-routing.ts`
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing tests**

`buildArrowPath - 斜め迂回` describe 内に追加:

```ts
it('should produce 6-segment source-detour path (mirror)', () => {
  const B: Bbox = { x: 200, y: 250, w: 152, h: 56 } // source 列
  const r = buildArrowPath(s, e, fc, tc, [B])
  expect(r.d).toBe('M200,128 L200,142 L290,142 L290,250 L600,250 L600,372')
  expect(r.mx).toBe((290 + 600) / 2)
  expect(r.my).toBe(250)
})

it('should produce 8-segment both-detour path when both columns blocked', () => {
  const Bs: Bbox = { x: 200, y: 250, w: 152, h: 56 }
  const Bt: Bbox = { x: 600, y: 250, w: 152, h: 56 }
  const r = buildArrowPath(s, e, fc, tc, [Bs, Bt])
  expect(r.d).toBe(
    'M200,128 L200,142 L290,142 L290,250 L690,250 L690,358 L600,358 L600,372',
  )
  expect(r.mx).toBe((290 + 690) / 2)
  expect(r.my).toBe(250)
})

it('should produce 4-segment shift-my path when only middle horizontal segment is blocked', () => {
  const B: Bbox = { x: 400, y: 250, w: 152, h: 56 } // 中央 X、中央行
  const r = buildArrowPath(s, e, fc, tc, [B])
  expect(r.d).toBe('M200,128 L200,292 L600,292 L600,372')
  expect(r.mx).toBe(400)
  expect(r.my).toBe(292)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: 3 件 FAIL — 各 kind の分岐が未実装

- [ ] **Step 3: Update buildArrowPath**

Task 13 で追加した `if (dDetour) { ... }` ブロックを以下に置き換え:

```ts
    const dDetour = detectDiagonalDetour(s, e, obstacles)
    if (dDetour) {
      if (dDetour.kind === 'target-detour') {
        const { my, detourX, approachY } = dDetour
        const d = `M${s.x},${s.y} L${s.x},${my} L${detourX},${my} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
        return { d, mx: (s.x + detourX) / 2, my }
      }
      if (dDetour.kind === 'source-detour') {
        const { departY, detourX, my } = dDetour
        const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${my} L${e.x},${my} L${e.x},${e.y}`
        return { d, mx: (detourX + e.x) / 2, my }
      }
      if (dDetour.kind === 'both-detour') {
        const { departY, sourceDetourX, my, targetDetourX, approachY } = dDetour
        const d = `M${s.x},${s.y} L${s.x},${departY} L${sourceDetourX},${departY} L${sourceDetourX},${my} L${targetDetourX},${my} L${targetDetourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
        return { d, mx: (sourceDetourX + targetDetourX) / 2, my }
      }
      if (dDetour.kind === 'shift-my') {
        const { my } = dDetour
        const d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
        return { d, mx: (s.x + e.x) / 2, my }
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#346): buildArrowPath emits source/both/shift-my diagonal detour paths"
```

---

### Task 15: regression guard - 既存横方向/縦方向迂回への影響なし

**Files:**
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

`buildArrowPath - 斜め迂回` describe 内に追加:

```ts
it('should not affect horizontal arrow detour (regression guard for #314)', () => {
  // 同一行: s=(276,200), e=(524,200) (既存テスト同等)
  const sH = { x: 276, y: 200 }
  const eH = { x: 524, y: 200 }
  const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
  const r = buildArrowPath(sH, eH, { x: 200, y: 200 }, { x: 600, y: 200 }, [B])
  expect(r.d).toBe('M276,200 L290,200 L290,242 L510,242 L510,200 L524,200')
})

it('should not affect vertical arrow detour (regression guard for #333)', () => {
  // 同一列: s=(200,128), e=(200,372) (X 一致 → 垂直)
  const sV = { x: 200, y: 128 }
  const eV = { x: 200, y: 372 }
  // 同一列障害 (x=200, 中央)
  const B: Bbox = { x: 200, y: 250, w: 152, h: 56 }
  const r = buildArrowPath(sV, eV, { x: 200, y: 100 }, { x: 200, y: 400 }, [B])
  // 既存 detectVerticalDetour による 6 セグ右迂回
  expect(r.d).toContain('M200,128')
  expect(r.d).toContain('L200,372')
  expect(r.d).toMatch(/L290,\d+/) // 右迂回 detourX = 200+76+14 = 290
})

it('should produce default Z-path when obstacles array is undefined (diagonal)', () => {
  const r = buildArrowPath(s, e, fc, tc)
  expect(r.d).toBe('M200,128 L200,250 L600,250 L600,372')
})
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS (regression なし)

- [ ] **Step 3: Commit**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#346): add regression guards for #314 / #333 / undefined obstacles"
```

---

### Task 16: Diamond ノードでの diagonal detour 動作確認

**Files:**
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('should handle diagonal detour when source/target points come from diamond shape', () => {
  // Diamond の exitPt/entryPt は頂点 (DS=34) を返すが、buildArrowPath には
  // 既に exitPt/entryPt 後の s/e が渡るので、Diamond 形状でも同じ振る舞いになるはず。
  const sDia = { x: 200, y: 134 } // ≈ ノード中心 (200,100) + DS(34) 下
  const eDia = { x: 600, y: 366 } // ≈ ノード中心 (600,400) - DS(34) 上
  const B: Bbox = { x: 600, y: 250, w: 152, h: 56 } // target 列障害
  const r = buildArrowPath(sDia, eDia, { x: 200, y: 100 }, { x: 600, y: 400 }, [B])
  // target-detour パターン: M(s) L(s.x,my) L(detourX,my) L(detourX,approachY) L(e.x,approachY) L(e)
  expect(r.d).toMatch(/^M200,134 L200,250 L690,250 L690,\d+ L600,\d+ L600,366$/)
})
```

- [ ] **Step 2: Run test**

Run: `npm test -- src/lib/arrow-routing.test.ts`
Expected: PASS (既存ロジックは Diamond 専用ではないので動くはず)

- [ ] **Step 3: Commit**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#346): diagonal detour works with diamond-shape exit/entry points"
```

---

### Task 17: `FlowEditor.aPath` に diagonal 分岐を追加

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: Locate and update the obstacles assembly block**

`src/features/editor/FlowEditor.tsx` の `aPath` 関数内、現 1397-1423 行付近の `obstacles` 組み立て分岐に `else` 節を追加:

```ts
    // 同一行/同一レーン/斜め配置のときに obstacles を組み立てる（迂回判定用）
    let obstacles: Bbox[] | undefined
    if (fri === tri) {
      obstacles = collectObstacles({
        nodes: obstacleNodes,
        fromKey: arrow.from,
        toKey: arrow.to,
        fromCx: from.x,
        toCx: to.x,
        rowY: from.y,
        rowH: RH,
        bboxW: TW,
        bboxH: TH,
      })
    } else if (fli === tli) {
      obstacles = collectVerticalObstacles({
        nodes: obstacleNodes,
        fromKey: arrow.from,
        toKey: arrow.to,
        fromCy: from.y,
        toCy: to.y,
        colX: from.x,
        colW: LW + G,
        bboxW: TW,
        bboxH: TH,
      })
    } else {
      obstacles = collectDiagonalObstacles({
        nodes: obstacleNodes,
        fromKey: arrow.from,
        toKey: arrow.to,
        fromCx: from.x,
        fromCy: from.y,
        toCx: to.x,
        toCy: to.y,
        rowH: RH,
        colW: LW + G,
        bboxW: TW,
        bboxH: TH,
      })
    }
```

ファイル先頭の import に `collectDiagonalObstacles` を追加:

```ts
import {
  ...
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  ...
} from '@/lib/arrow-routing'
```

(import パスは既存に従う)

- [ ] **Step 2: Run typecheck and unit tests**

Run: `npm test`
Expected: PASS (全テスト)

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#346): wire collectDiagonalObstacles into FlowEditor.aPath"
```

---

### Task 18: `SharedFlowViewer.computeArrowPath` に diagonal 分岐を追加

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`

- [ ] **Step 1: Locate and update the obstacles assembly block**

`src/features/shared/SharedFlowViewer.tsx` の `computeArrowPath` 内、現 135-159 行付近の obstacles 組み立て分岐に `else` 節を追加:

```ts
    let obstacles: Bbox[] | undefined
    if (fromNode.rowIndex === toNode.rowIndex) {
      obstacles = collectObstacles({ ... })           // 既存
    } else if (fromNode.laneId === toNode.laneId) {
      obstacles = collectVerticalObstacles({ ... })   // 既存
    } else {
      obstacles = collectDiagonalObstacles({
        nodes: obstacleNodes,
        fromKey: fromNode.id,
        toKey: toNode.id,
        fromCx: f.x,
        fromCy: f.y,
        toCx: t.x,
        toCy: t.y,
        rowH: RH,
        colW: LW + G,
        bboxW: TW,
        bboxH: TH,
      })
    }
```

ファイル先頭の import に `collectDiagonalObstacles` を追加:

```ts
import {
  ...
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  ...
} from '@/lib/arrow-routing'
```

- [ ] **Step 2: Run typecheck and unit tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#346): wire collectDiagonalObstacles into SharedFlowViewer"
```

---

### Task 19: 実画面検証 (Playwright / 目視)

**Files:**
- スクリーンショット保存: `.screenshots/issue-346-after.png`

- [ ] **Step 1: 開発サーバー起動**

Run (バックグラウンド): `npm run dev`
Wait until: `Local: http://localhost:5173` (or similar) が表示される

- [ ] **Step 2: bug 再現データで矢印描画を確認**

Playwright で `https://flowline.six1.jp/flows/951c20ca-2430-495b-af6d-068795a93c60` (ALLFIT-コンシェルジュ flow) を開く (要ログイン: `.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`)。

- ガイド → 店舗詳細 の矢印が 一覧ページを貫通していないことを確認
- スクリーンショット保存: `.screenshots/issue-346-after.png`

- [ ] **Step 3: regression 確認**

- ダッシュボード一覧の表示が崩れていないこと
- 通常の Z字矢印 (障害なし) が直線的に描かれていること
- 横方向迂回 (#314) のテスト flow があれば崩れていないこと

- [ ] **Step 4: LCP 確認**

Chrome DevTools の Performance タブで LCP < 1秒 を確認。超過していたら原因調査。

- [ ] **Step 5: Commit (スクリーンショットのみ。`.gitignore` 外なら)**

`.screenshots/` は `.gitignore` 配下なのでコミット不要。確認のみで完了。

---

### Task 20: 最終チェックと PR 作成準備

**Files:**
- なし (CI/CD と git 操作のみ)

- [ ] **Step 1: 最新 main と同期**

```bash
git fetch origin
git pull origin main --rebase
npm test
```

Expected: 全テスト PASS

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: Success

- [ ] **Step 3: Prettier / Lint**

```bash
npx prettier --check src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts src/features/editor/FlowEditor.tsx src/features/shared/SharedFlowViewer.tsx
```

差分があれば `--write` で修正してコミット。

- [ ] **Step 4: PR push**

```bash
git push -u origin <branch-name>
gh pr create --title "fix(#346): 斜め配置矢印の Z字パスが中間行ノードを貫通する問題を修正" --body "$(cat <<'EOF'
## Summary
- 斜め配置 (異行×異レーン) の Z字矢印が target 列の中間行ノードを貫通するバグを修正
- 新規 collectDiagonalObstacles / detectDiagonalDetour を arrow-routing.ts に追加
- Z字パス 3 セグメント (source 縦 / 中央水平 / target 縦) 全てに衝突判定
- 4 パターン (target-detour / source-detour / both-detour / shift-my) の迂回パスを生成
- FlowEditor / SharedFlowViewer の obstacles 組み立てに diagonal 分岐を追加

Spec: docs/superpowers/specs/2026-05-22-issue-346-diagonal-arrow-detour-design.md
Plan: docs/superpowers/plans/2026-05-22-issue-346-diagonal-arrow-detour-plan.md

Closes #346

## Test plan
- [ ] arrow-routing.test.ts 全 PASS (detector / collector / buildArrowPath 統合 / regression)
- [ ] ALLFIT-コンシェルジュ flow で ガイド → 店舗詳細 が 一覧ページを貫通しない (Playwright 目視)
- [ ] 既存 #314 (横方向) / #333 (縦方向) 迂回に regression なし
- [ ] LCP 1 秒以内

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI watch & review request**

```bash
gh pr checks --watch
```

CI 全 pass 後、`@claude` レビュー依頼コメントを投稿 (CLAUDE.md workflow §8 参照)。

---

## Self-Review Notes

- **Spec coverage**: §4 detector / §5 collector / §6 呼び出し側 / §7 buildArrowPath / §8 テスト — 全て Task 1-19 でカバー。受け入れ基準 §9 は Task 19/20 で検証。
- **Placeholder scan**: なし
- **Type consistency**: `DiagonalDetourResult` のフィールド名 (`my`, `detourX`, `approachY`, `departY`, `sourceDetourX`, `targetDetourX`) は Task 6-12 / 13-14 で一貫
- **Constants**: `DETOUR_MARGIN = 14`, `APPROACH_GAP = 14`, `DEPART_GAP = 14` は既存 (arrow-routing.ts:13-20) を流用
