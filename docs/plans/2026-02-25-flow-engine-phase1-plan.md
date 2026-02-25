# flow-engine Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** FlowEditor.tsx内のグラフ操作ロジックを `src/lib/flow-engine.ts` に純粋関数として切り出し、ユニットテストを追加する。

**Architecture:** `flow-engine.ts` に6つの純粋関数を配置。`arrow-routing.ts` の既存3関数（exitPt, entryPt, buildArrowPath）は変更せず、`calcArrowPath` がそれらを呼ぶラッパーとなる。FlowEditor.tsxからはインラインロジックをimportに差し替える。

**Tech Stack:** TypeScript, Vitest

---

### Task 1: `remapArrows` — テスト作成

**Files:**

- Create: `src/lib/flow-engine.test.ts`
- Create: `src/lib/flow-engine.ts`

**Step 1: 失敗するテストを書く**

`src/lib/flow-engine.test.ts` を作成:

```typescript
import { describe, it, expect } from 'vitest'
import { remapArrows } from './flow-engine'

describe('remapArrows', () => {
  it('should remap from field when oldKey matches', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = remapArrows(arrows, 'A', 'X')
    expect(result).toEqual([{ id: 'a1', from: 'X', to: 'B', comment: '' }])
  })

  it('should remap to field when oldKey matches', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = remapArrows(arrows, 'B', 'Y')
    expect(result).toEqual([{ id: 'a1', from: 'A', to: 'Y', comment: '' }])
  })

  it('should remap both from and to in multiple arrows simultaneously', () => {
    const arrows = [
      { id: 'a1', from: 'K', to: 'B', comment: '' },
      { id: 'a2', from: 'A', to: 'K', comment: '' },
      { id: 'a3', from: 'C', to: 'D', comment: '' },
    ]
    const result = remapArrows(arrows, 'K', 'Z')
    expect(result[0].from).toBe('Z')
    expect(result[1].to).toBe('Z')
    expect(result[2]).toEqual({ id: 'a3', from: 'C', to: 'D', comment: '' })
  })

  it('should return unchanged arrows when oldKey not found', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = remapArrows(arrows, 'NONE', 'X')
    expect(result).toEqual(arrows)
  })

  it('should preserve optional color and dash fields', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '', color: 'red', dash: '4 2' }]
    const result = remapArrows(arrows, 'A', 'X')
    expect(result[0].color).toBe('red')
    expect(result[0].dash).toBe('4 2')
  })

  it('should return empty array for empty input', () => {
    expect(remapArrows([], 'A', 'B')).toEqual([])
  })
})
```

**Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: FAIL — `remapArrows` が存在しない

---

### Task 2: `remapArrows` — 実装

**Files:**

- Create: `src/lib/flow-engine.ts`

**Step 3: 最小限の実装**

`src/lib/flow-engine.ts` を作成:

```typescript
import type { InternalArrow } from '../features/editor/types'

/**
 * 矢印配列内のキーを書き換える。
 * moveTask 時にタスクキーが変わった場合、from/to を新キーに差し替える。
 */
export function remapArrows(
  arrows: InternalArrow[],
  oldKey: string,
  newKey: string,
): InternalArrow[] {
  return arrows.map((a) => ({
    ...a,
    from: a.from === oldKey ? newKey : a.from,
    to: a.to === oldKey ? newKey : a.to,
  }))
}
```

**Step 4: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 6 tests PASS

---

### Task 3: `filterArrowsByDeletedKeys` — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 5: 失敗するテストを追加**

`flow-engine.test.ts` に追加:

```typescript
import { remapArrows, filterArrowsByDeletedKeys } from './flow-engine'

describe('filterArrowsByDeletedKeys', () => {
  it('should remove arrows where from is in deletedKeys', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'C', to: 'D', comment: '' },
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['A']))
    expect(result).toEqual([{ id: 'a2', from: 'C', to: 'D', comment: '' }])
  })

  it('should remove arrows where to is in deletedKeys', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'C', to: 'D', comment: '' },
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['B']))
    expect(result).toEqual([{ id: 'a2', from: 'C', to: 'D', comment: '' }])
  })

  it('should return all arrows when deletedKeys is empty', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'C', to: 'D', comment: '' },
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set())
    expect(result).toEqual(arrows)
  })

  it('should return empty array when all keys are deleted', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['A', 'B', 'C']))
    expect(result).toEqual([])
  })

  it('should return empty array for empty input', () => {
    expect(filterArrowsByDeletedKeys([], new Set(['A']))).toEqual([])
  })
})
```

**Step 6: テスト失敗を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: `filterArrowsByDeletedKeys` のテストが FAIL

---

### Task 4: `filterArrowsByDeletedKeys` — 実装

**Files:**

- Modify: `src/lib/flow-engine.ts`

**Step 7: 実装を追加**

`flow-engine.ts` に追加:

```typescript
/**
 * 削除されたキーに関連する矢印をフィルタリングする。
 * rmRow / rmLane 時に、削除対象ノードの矢印を除去する。
 */
export function filterArrowsByDeletedKeys(
  arrows: InternalArrow[],
  deletedKeys: Set<string>,
): InternalArrow[] {
  return arrows.filter((a) => !deletedKeys.has(a.from) && !deletedKeys.has(a.to))
}
```

**Step 8: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

**Step 9: コミット**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat: add remapArrows and filterArrowsByDeletedKeys to flow-engine"
```

---

### Task 5: `calcArrowPath` — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 10: 失敗するテストを追加**

`flow-engine.test.ts` に追加。テスト値は `arrow-routing.ts` の実際のロジックに基づく:

- `exitPt({x:200,y:100}, {x:200,y:300}, 76, 28, 84)`: dy=200 > 84\*0.3=25.2 → `{x:200, y:128}`
- `entryPt({x:200,y:300}, {x:200,y:100}, 76, 28, 84)`: dy=-200 < -25.2 → `{x:200, y:272}`
- `buildArrowPath({x:200,y:128}, {x:200,y:272}, {x:200,y:100}, {x:200,y:300})`: dx=0 < 2 → 直線 `M200,128 L200,272`

```typescript
import { remapArrows, filterArrowsByDeletedKeys, calcArrowPath } from './flow-engine'

describe('calcArrowPath', () => {
  const config = { hw: 76, hh: 28, rh: 84 }

  it('① should route same-lane downward: exit bottom, enter top', () => {
    const from = { x: 200, y: 100 }
    const to = { x: 200, y: 300 }
    const result = calcArrowPath(from, to, config)
    expect(result).not.toBeNull()
    // 直線パス（同一X座標）
    expect(result!.d).toBe('M200,128 L200,272')
    expect(result!.mx).toBe(200)
    expect(result!.my).toBe(200)
  })

  it('① should route cross-lane horizontal: exit right, enter left', () => {
    // dx=300, dy=0 → 水平方向: exitPt → 右端, entryPt → 左端
    const from = { x: 100, y: 200 }
    const to = { x: 400, y: 200 }
    const result = calcArrowPath(from, to, config)
    expect(result).not.toBeNull()
    // exit: {x:176, y:200}, entry: {x:324, y:200} → 直線
    expect(result!.d).toBe('M176,200 L324,200')
  })

  it('② should change exit direction when moving from same-lane to cross-lane', () => {
    // Same lane downward: exit from bottom
    const r1 = calcArrowPath({ x: 100, y: 100 }, { x: 100, y: 200 }, config)
    expect(r1).not.toBeNull()
    // dy=100 > 25.2 → exit bottom: y = 100 + 28 = 128
    expect(r1!.d).toContain('M100,128')

    // Cross lane: exit from side
    const r2 = calcArrowPath({ x: 100, y: 100 }, { x: 400, y: 200 }, config)
    expect(r2).not.toBeNull()
    // dy=100 > 25.2 → exit bottom: y = 100 + 28 = 128
    // BUT entry: dy from {x:400,y:200} perspective, o={x:100,y:100}: dy=-100 < -25.2 → top: y = 200 - 28 = 172
    // exit: {x:100, y:128}, entry: {x:400, y:172}
    // sV = |128-100| > |100-100| = 28 > 0 → true
    // eV = |172-200| > |400-400| = 28 > 0 → true
    // Both vertical → Z字: my = (128+172)/2 = 150
    expect(r2!.d).toBe('M100,128 L100,150 L400,150 L400,172')
  })

  it('③ diamond — test.todo: left-down exit from left vertex', () => {
    // Diamond support will be added in a future phase
  })

  it.todo('③ diamond — right-down exit from right vertex')
  it.todo('③ diamond — straight-down exit from bottom vertex')
})
```

**Step 11: テスト失敗を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: `calcArrowPath` のテストが FAIL

---

### Task 6: `calcArrowPath` — 実装

**Files:**

- Modify: `src/lib/flow-engine.ts`

**Step 12: 実装を追加**

`flow-engine.ts` に追加:

```typescript
import type { ArrowPathResult, Point } from '../features/editor/types'
import { exitPt, entryPt, buildArrowPath } from './arrow-routing'

export interface NodePos {
  x: number
  y: number
}

export interface ArrowConfig {
  hw: number
  hh: number
  rh: number
}

/**
 * 2ノード間の矢印パスを計算する。
 * arrow-routing.ts の exitPt → entryPt → buildArrowPath を順に呼ぶラッパー。
 * 座標解決はUI層で行い、解決済みの値を渡す。
 */
export function calcArrowPath(from: NodePos, to: NodePos, config: ArrowConfig): ArrowPathResult {
  const f: Point = { x: from.x, y: from.y }
  const t: Point = { x: to.x, y: to.y }
  const s = exitPt(f, t, config.hw, config.hh, config.rh)
  const e = entryPt(t, f, config.hw, config.hh, config.rh)
  return buildArrowPath(s, e, f, t)
}
```

**Step 13: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

**Step 14: コミット**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat: add calcArrowPath wrapper to flow-engine"
```

---

### Task 7: `findChain` — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 15: 失敗するテストを追加**

```typescript
import { ..., findChain } from './flow-engine'

describe('findChain', () => {
  it('should return linear chain A→B→C in order', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r1', to: 'l0_r2' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual(['l0_r0', 'l0_r1', 'l0_r2'])
  })

  it('should return only nodes in specified lane when branches exist', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r0', to: 'l1_r1' }, // branch to lane l1
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual(['l0_r0', 'l0_r1'])
  })

  it('should return empty array when no arrows exist', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findChain([], tasks, 'l0')
    expect(result).toEqual([])
  })

  it('should not infinite loop on circular reference A→B→C→A', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r1', to: 'l0_r2' },
      { from: 'l0_r2', to: 'l0_r0' }, // cycle
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
    }
    const result = findChain(arrows, tasks, 'l0')
    // Should contain all 3 nodes exactly once (cycle broken by visited set)
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
  })

  it('should return empty array when no nodes belong to specified lane', () => {
    const arrows = [{ from: 'l1_r0', to: 'l1_r1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual([])
  })
})
```

**Step 16: テスト失敗を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: `findChain` のテストが FAIL

---

### Task 8: `findChain` — 実装

**Files:**

- Modify: `src/lib/flow-engine.ts`

**Step 17: 実装を追加**

```typescript
/**
 * 指定レーン内の矢印チェーンをたどり、チェーン順のkey配列を返す。
 * チェーンの起点は「同レーン内で incoming がないノード」。
 * 循環参照は visited Set で安全に停止する。
 */
export function findChain(
  arrows: { from: string; to: string }[],
  tasks: Record<string, { lid: string; rid: string }>,
  laneId: string,
): string[] {
  // Collect keys in this lane
  const laneKeys = new Set(Object.keys(tasks).filter((k) => tasks[k].lid === laneId))
  if (laneKeys.size === 0) return []

  // Build adjacency: from → to[], filtering to same-lane nodes only
  const adj = new Map<string, string[]>()
  const hasIncoming = new Set<string>()
  for (const a of arrows) {
    if (!laneKeys.has(a.from) || !laneKeys.has(a.to)) continue
    if (!adj.has(a.from)) adj.set(a.from, [])
    adj.get(a.from)!.push(a.to)
    hasIncoming.add(a.to)
  }

  // Find chain heads: lane nodes with no incoming from same lane
  const heads = [...laneKeys].filter((k) => !hasIncoming.has(k))
  if (heads.length === 0) {
    // All nodes have incoming (cycle) — pick any node as start
    heads.push([...laneKeys][0])
  }

  // Walk from the first head
  const visited = new Set<string>()
  const chain: string[] = []
  let current: string | undefined = heads[0]
  while (current && !visited.has(current)) {
    visited.add(current)
    chain.push(current)
    const nexts = adj.get(current) || []
    current = nexts.find((n) => laneKeys.has(n) && !visited.has(n))
  }

  return chain
}
```

**Step 18: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

**Step 19: コミット**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat: add findChain with cycle safety to flow-engine"
```

---

### Task 9: `detectReorder` — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 20: 失敗するテストを追加**

```typescript
import { ..., detectReorder } from './flow-engine'

describe('detectReorder', () => {
  it('④ should detect reorder when node moved to different row', () => {
    // Chain order: k1, k2, k3, k4, k5
    // But k2 is now at r5 (moved down), physical order should be k1, k3, k4, k5, k2
    const chain = ['k1', 'k2', 'k3', 'k4', 'k5']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r1' },
      k2: { rid: 'r5' },
      k3: { rid: 'r2' },
      k4: { rid: 'r3' },
      k5: { rid: 'r4' },
    }
    const rows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(true)
    expect(result.current).toEqual(['k1', 'k2', 'k3', 'k4', 'k5'])
    expect(result.proposed).toEqual(['k1', 'k3', 'k4', 'k5', 'k2'])
  })

  it('should return changed=false when chain is already in row order', () => {
    const chain = ['k1', 'k2', 'k3']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r0' },
      k2: { rid: 'r1' },
      k3: { rid: 'r2' },
    }
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(false)
    expect(result.current).toEqual(['k1', 'k2', 'k3'])
    expect(result.proposed).toEqual(['k1', 'k2', 'k3'])
  })

  it('should return changed=false for empty chain', () => {
    const result = detectReorder([], {}, [])
    expect(result.changed).toBe(false)
    expect(result.current).toEqual([])
    expect(result.proposed).toEqual([])
  })

  it('should return changed=false for single-node chain', () => {
    const chain = ['k1']
    const tasks: Record<string, { rid: string }> = { k1: { rid: 'r0' } }
    const rows = [{ id: 'r0' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(false)
  })
})
```

**Step 21: テスト失敗を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: `detectReorder` のテストが FAIL

---

### Task 10: `detectReorder` — 実装

**Files:**

- Modify: `src/lib/flow-engine.ts`

**Step 22: 実装を追加**

```typescript
/**
 * チェーンの現在順と行位置順を比較し、並び替えが必要か判定する。
 */
export function detectReorder(
  chain: string[],
  tasks: Record<string, { rid: string }>,
  rows: { id: string }[],
): { changed: boolean; current: string[]; proposed: string[] } {
  if (chain.length <= 1) {
    return { changed: false, current: [...chain], proposed: [...chain] }
  }

  const rowIndex = new Map(rows.map((r, i) => [r.id, i]))
  const proposed = [...chain].sort((a, b) => {
    const riA = rowIndex.get(tasks[a]?.rid) ?? 0
    const riB = rowIndex.get(tasks[b]?.rid) ?? 0
    return riA - riB
  })

  const changed = chain.some((k, i) => k !== proposed[i])
  return { changed, current: [...chain], proposed }
}
```

**Step 23: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

---

### Task 11: `reconnectChain` — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 24: 失敗するテストを追加**

```typescript
import { ..., reconnectChain } from './flow-engine'

describe('reconnectChain', () => {
  it('④ should create arrows for adjacent pairs in sorted order', () => {
    const result = reconnectChain(['k1', 'k3', 'k4', 'k5', 'k2'])
    expect(result).toEqual([
      { from: 'k1', to: 'k3' },
      { from: 'k3', to: 'k4' },
      { from: 'k4', to: 'k5' },
      { from: 'k5', to: 'k2' },
    ])
  })

  it('should return empty array for single node', () => {
    expect(reconnectChain(['k1'])).toEqual([])
  })

  it('should return single arrow for two nodes', () => {
    expect(reconnectChain(['k1', 'k2'])).toEqual([{ from: 'k1', to: 'k2' }])
  })

  it('should return empty array for empty input', () => {
    expect(reconnectChain([])).toEqual([])
  })
})
```

**Step 25: テスト失敗を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: `reconnectChain` のテストが FAIL

---

### Task 12: `reconnectChain` — 実装

**Files:**

- Modify: `src/lib/flow-engine.ts`

**Step 26: 実装を追加**

```typescript
/**
 * 位置順のkey配列から隣接ペアの矢印配列を生成する。
 */
export function reconnectChain(sortedKeys: string[]): { from: string; to: string }[] {
  const arrows: { from: string; to: string }[] = []
  for (let i = 0; i < sortedKeys.length - 1; i++) {
    arrows.push({ from: sortedKeys[i], to: sortedKeys[i + 1] })
  }
  return arrows
}
```

**Step 27: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

**Step 28: コミット**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat: add detectReorder and reconnectChain to flow-engine"
```

---

### Task 13: 統合テスト — テスト作成

**Files:**

- Modify: `src/lib/flow-engine.test.ts`

**Step 29: 統合テストを追加**

```typescript
import { exitPt, entryPt } from './arrow-routing'
import { computeBridgeArrows } from '../features/editor/auto-connect'

describe('統合テスト', () => {
  it('⑤ should bridge A→C when B is deleted from A→B→C', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
    ]
    const bridges = computeBridgeArrows(new Set(['B']), arrows)
    expect(bridges).toHaveLength(1)
    expect(bridges[0].from).toBe('A')
    expect(bridges[0].to).toBe('C')

    // After filtering deleted keys and adding bridges
    const remaining = filterArrowsByDeletedKeys(arrows, new Set(['B']))
    expect(remaining).toHaveLength(0) // both arrows had B
    const newArrows = [
      ...remaining,
      ...bridges.map((b, i) => ({
        id: `bridge${i}`,
        from: b.from,
        to: b.to,
        comment: b.comment,
      })),
    ]
    expect(newArrows).toHaveLength(1)
    expect(newArrows[0].from).toBe('A')
    expect(newArrows[0].to).toBe('C')
  })

  it('⑥ should verify all arrow directions after chain reconnection', () => {
    // 5 nodes in same lane, chain needs reordering
    const chain = ['k1', 'k2', 'k3', 'k4', 'k5']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r0' },
      k2: { rid: 'r4' }, // moved to bottom
      k3: { rid: 'r1' },
      k4: { rid: 'r2' },
      k5: { rid: 'r3' },
    }
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]

    // Detect and reorder
    const reorder = detectReorder(chain, tasks, rows)
    expect(reorder.changed).toBe(true)
    expect(reorder.proposed).toEqual(['k1', 'k3', 'k4', 'k5', 'k2'])

    // Reconnect
    const newArrows = reconnectChain(reorder.proposed)

    // Verify all arrow routing directions
    // All nodes at same X (same lane), increasing Y
    const RH = 84,
      TM = 24,
      HH = 46
    const positions: Record<string, { x: number; y: number }> = {}
    for (const key of reorder.proposed) {
      const ri = rows.findIndex((r) => r.id === tasks[key].rid)
      positions[key] = { x: 200, y: TM + HH + ri * RH + RH / 2 }
    }

    for (const arrow of newArrows) {
      const fp = positions[arrow.from]
      const tp = positions[arrow.to]
      const exit = exitPt(fp, tp, 76, 28, RH)
      const entry = entryPt(tp, fp, 76, 28, RH)

      // Exit should be from bottom (y > center.y)
      expect(exit.y).toBeGreaterThan(fp.y)
      // Entry should be at top (y < center.y)
      expect(entry.y).toBeLessThan(tp.y)
      // Same lane → X should match
      expect(exit.x).toBe(entry.x)
    }
  })
})
```

**Step 30: テスト通過を確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS（統合テストは既存実装を組み合わせるだけ）

**Step 31: コミット**

```bash
git add src/lib/flow-engine.test.ts
git commit -m "test: add integration tests for bridge deletion and chain reconnection routing"
```

---

### Task 14: FlowEditor.tsx — import差し替え（remapArrows, filterArrowsByDeletedKeys）

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:37` (import追加)
- Modify: `src/features/editor/FlowEditor.tsx:999-1001` (moveTask内)
- Modify: `src/features/editor/FlowEditor.tsx:1089` (rmRow内)
- Modify: `src/features/editor/FlowEditor.tsx:1104` (rmLane内)

**Step 32: import を追加**

`FlowEditor.tsx` L37付近、既存importの後に追加:

```typescript
import { remapArrows, filterArrowsByDeletedKeys } from '../../lib/flow-engine'
```

**Step 33: moveTask内の矢印書き換えを差し替え**

L999-1001 を差し替え:

```typescript
// Before:
setArrows((p) =>
  p.map((a) => ({ ...a, from: a.from === fk ? nk : a.from, to: a.to === fk ? nk : a.to })),
)

// After:
setArrows((p) => remapArrows(p, fk, nk))
```

**Step 34: rmRow内の矢印フィルタを差し替え**

L1089 を差し替え:

```typescript
// Before:
setArrows((p) => p.filter((a) => !rm.includes(a.from) && !rm.includes(a.to)))

// After:
setArrows((p) => filterArrowsByDeletedKeys(p, new Set(rm)))
```

**Step 35: rmLane内の矢印フィルタを差し替え**

L1104 を差し替え:

```typescript
// Before:
setArrows((p) => p.filter((a) => !rm.includes(a.from) && !rm.includes(a.to)))

// After:
setArrows((p) => filterArrowsByDeletedKeys(p, new Set(rm)))
```

**Step 36: テスト通過を確認**

Run: `npm test`
Expected: 全テスト PASS

---

### Task 15: FlowEditor.tsx — aPath を calcArrowPath に差し替え

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:37` (import更新)
- Modify: `src/features/editor/FlowEditor.tsx:1108-1124` (aPath関数)

**Step 37: import に calcArrowPath を追加**

```typescript
import { remapArrows, filterArrowsByDeletedKeys, calcArrowPath } from '../../lib/flow-engine'
```

**Step 38: aPath 関数を差し替え**

L1108-1124 の `aPath` 関数を差し替え:

```typescript
// Before:
const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
  const ft = tasks[arrow.from],
    tt = tasks[arrow.to]
  if (!ft || !tt) return null
  const fli = liMap[ft.lid],
    fri = riMap[ft.rid],
    tli = liMap[tt.lid],
    tri = riMap[tt.rid]
  if ([fli, fri, tli, tri].some((v) => v === undefined)) return null
  const f = ct(fli, fri),
    t = ct(tli, tri),
    hw = TW / 2,
    hh = TH / 2
  const s = exitPt(f, t, hw, hh, RH),
    e = entryPt(t, f, hw, hh, RH)
  return buildArrowPath(s, e, f, t)
}

// After:
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
  return calcArrowPath(from, to, { hw: TW / 2, hh: TH / 2, rh: RH })
}
```

**Step 39: 未使用importを削除**

`exitPt`, `entryPt`, `buildArrowPath` の直接importが `aPath` でしか使われていなかった場合、importを削除。ただし他の箇所で使われている可能性があるので、grep で確認してから削除すること。

```bash
grep -n 'exitPt\|entryPt\|buildArrowPath' src/features/editor/FlowEditor.tsx
```

他に使用箇所がなければ L37 の import を削除:

```typescript
// 削除対象（他に使用箇所がない場合のみ）:
import { exitPt, entryPt, buildArrowPath } from '../../lib/arrow-routing'
```

**Step 40: テスト通過を確認**

Run: `npm test`
Expected: 全テスト PASS

**Step 41: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "refactor: replace inline arrow logic with flow-engine imports in FlowEditor"
```

---

### Task 16: 全テスト通過 & ブラウザ目視確認

**Step 42: 全テスト実行**

Run: `npm test`
Expected: 全テスト PASS

**Step 43: ビルド確認**

Run: `npm run build`
Expected: ビルド成功、エラーなし

**Step 44: ブラウザ目視確認**

Playwrightまたはchrome-devtoolsで以下を確認:

1. エディタ画面を開く
2. ノードを追加し、矢印で接続する → 矢印パスが正しく描画される
3. ノードを別セルに移動する → 矢印が追従する
4. 行を削除する → 関連矢印が消える
5. レーンを削除する → 関連矢印が消える

**Step 45: 最終コミット（必要な場合のみ）**

目視確認で問題が見つかった場合は修正してコミット。
