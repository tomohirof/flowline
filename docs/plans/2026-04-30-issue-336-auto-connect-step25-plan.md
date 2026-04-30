# Issue #336: 自動接続 Step 2.5 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `findClosestUpstream` に「経路通過矢印への割り込み」(Step 2.5) を追加し、新ノードを既存矢印の経路上に挿入したとき、その矢印1本だけを `from → new → to` にスプライスする。

**Architecture:**

- `findClosestUpstream` の戻り値を `{ key, splitArrowId? } | null` に拡張し、Step 2 と Step 3 の間に Step 2.5 を挿入。
- `autoConnectOnCreate` は `splitArrowId` がある場合のみ「対象1本だけ」をスプライス、無い場合は既存の broad splice を維持。

**Tech Stack:** TypeScript, Vitest (`npm test` = `vitest run`), React (hooks via `@testing-library/react`)

**Spec:** [`docs/plans/2026-04-30-issue-336-auto-connect-step25-design.md`](./2026-04-30-issue-336-auto-connect-step25-design.md)

---

## File Structure

| File                                          | Role                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `src/features/editor/auto-connect.ts`         | `UpstreamResult` 型・Step 2.5 ロジックを追加     |
| `src/features/editor/auto-connect.test.ts`    | 既存テストの戻り値形式更新 + Step 2.5 ケース追加 |
| `src/features/editor/hooks/useArrows.ts`      | `splitArrowId` を使ったターゲット限定スプライス  |
| `src/features/editor/hooks/useArrows.test.ts` | 通過矢印スプライス時の他 outgoing 不変テスト追加 |

---

## Task 1: `findClosestUpstream` 戻り値型のリファクタ

**Files:**

- Modify: `src/features/editor/auto-connect.ts:1-97`
- Modify: `src/features/editor/auto-connect.test.ts` (16〜18 箇所のアサーション形式変更)
- Modify: `src/features/editor/hooks/useArrows.ts:24-25`

挙動変更なしの純粋なリファクタ。型変更とテスト更新を1コミットで完結させる。

- [ ] **Step 1: `auto-connect.ts` に型を追加し、戻り値を変更**

`src/features/editor/auto-connect.ts` を以下に書き換える（Step 2.5 はまだ入れない）：

```ts
/**
 * Result of upstream lookup. `splitArrowId` is set only when matched via
 * Step 2.5 (the new node lies on an existing arrow's path), telling the
 * caller to splice that specific arrow rather than all outgoing arrows.
 */
export type UpstreamResult = {
  key: string
  splitArrowId?: string
}

/**
 * Find the closest upstream node key for auto-connection.
 *
 * Priority:
 * 1. Same-row nodes: closest by lane distance (bidirectional),
 *    with tail nodes preferred over non-tails at equal distance.
 * 2. Same-lane upstream: closest row in the same lane (tail or non-tail).
 *    Handles insertions between already-linked nodes within the same lane.
 * 3. Upstream tails (previous rows): closest by row index,
 *    with flow-connected tails preferred over isolated at same row.
 *
 * @returns The upstream lookup result, or null if none found.
 */
export function findClosestUpstream(
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
  lanes: { id: string }[],
  newRi: number,
  newLi: number,
  arrows: { id: string; from: string; to: string }[],
): UpstreamResult | null {
  const outgoing = new Set(arrows.map((a) => a.from))
  const incoming = new Set(arrows.map((a) => a.to))
  const allKeys = Object.keys(tasks)
  const tails = allKeys.filter((k) => !outgoing.has(k))

  // 1. Same-row: closest by lane distance (bidirectional)
  //    Tiebreaker: prefer tails over non-tails
  {
    let bestKey: string | null = null
    let bestDist = Infinity
    let bestIsTail = false
    for (const key of allKeys) {
      const task = tasks[key]
      const tRi = rows.findIndex((r) => r.id === task.rid)
      if (tRi !== newRi) continue
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tLi < 0 || tLi === newLi) continue
      const dist = Math.abs(tLi - newLi)
      const isTail = !outgoing.has(key)
      if (dist < bestDist || (dist === bestDist && isTail && !bestIsTail)) {
        bestKey = key
        bestDist = dist
        bestIsTail = isTail
      }
    }
    if (bestKey) return { key: bestKey }
  }

  // 2. Same-lane upstream: pick the closest (largest tRi < newRi) node in the same lane.
  //    A same-lane predecessor is the natural upstream even when it already has outgoing
  //    arrows, because the user is inserting a new step into an existing chain.
  {
    let bestKey: string | null = null
    let bestRi = -1
    for (const key of allKeys) {
      const task = tasks[key]
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tLi !== newLi) continue
      const tRi = rows.findIndex((r) => r.id === task.rid)
      if (tRi < 0 || tRi >= newRi) continue
      if (tRi > bestRi) {
        bestKey = key
        bestRi = tRi
      }
    }
    if (bestKey) return { key: bestKey }
  }

  // 3. Upstream tails: closest by row, flow-connected as tiebreaker
  {
    let bestKey: string | null = null
    let bestRi = -1
    let bestLi = -1
    let bestIsFlow = false
    for (const key of tails) {
      const task = tasks[key]
      const tRi = rows.findIndex((r) => r.id === task.rid)
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tRi < 0 || tLi < 0) continue
      if (tRi >= newRi) continue

      const isFlow = incoming.has(key)
      if (
        tRi > bestRi ||
        (tRi === bestRi && isFlow && !bestIsFlow) ||
        (tRi === bestRi && isFlow === bestIsFlow && tLi > bestLi)
      ) {
        bestKey = key
        bestRi = tRi
        bestLi = tLi
        bestIsFlow = isFlow
      }
    }
    return bestKey ? { key: bestKey } : null
  }
}
```

注: `arrows` パラメータの型に `id: string` を追加。呼び出し側はもとから `InternalArrow`（`id` 必須）を渡しているので破壊的変更ではない。`findCrossingArrows` と `computeBridgeArrows` はそのまま。

- [ ] **Step 2: `useArrows.ts` の呼び出し側を更新**

`src/features/editor/hooks/useArrows.ts:22-32` を以下に書き換える：

```ts
const autoConnectOnCreate = (taskKey: string, ri: number, li: number): void => {
  if (!autoConnect || Object.keys(tasks).length < 1) return
  const result = findClosestUpstream(tasks, rows, lanes, ri, li, arrows)
  if (!result) return
  const bestKey = result.key

  // If the chosen upstream lives in a row above the new node, re-route any arrow
  // from it to a downstream node (row > ri) through the new node, splitting
  // `bestKey → downstream` into `bestKey → new → downstream`.
  const bestTask = tasks[bestKey]
  const bestRi = bestTask ? rows.findIndex((r) => r.id === bestTask.rid) : -1
```

それ以下（`splitArrows` 計算〜末尾）はこの段階では変更しない。

- [ ] **Step 3: `auto-connect.test.ts` の既存アサーションを機械的更新**

`src/features/editor/auto-connect.test.ts` 全体で `findClosestUpstream(...)` の戻り値を扱う行を以下のように書き換える：

| 旧                          | 新                                       |
| --------------------------- | ---------------------------------------- |
| `expect(result).toBe('X')`  | `expect(result?.key).toBe('X')`          |
| `expect(result).toBeNull()` | `expect(result).toBeNull()` （変更なし） |

対象行（line 12, 23, 33, 43, 51, 61, 72, 88, 101, 113, 130, 150, 165, 187, 198, 211, 226, 263, 276, 287 付近）。`expect(result).toBeNull()` の行は変更不要。

`findCrossingArrows` と `computeBridgeArrows` のテストは触らない。

- [ ] **Step 4: テスト実行 → 全パス確認**

```bash
npx vitest run src/features/editor/auto-connect.test.ts src/features/editor/hooks/useArrows.test.ts
```

期待: 全テストパス。挙動を変えていないので失敗ゼロ。

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/auto-connect.ts src/features/editor/auto-connect.test.ts src/features/editor/hooks/useArrows.ts
git commit -m "$(cat <<'EOF'
refactor(#336): change findClosestUpstream return type to UpstreamResult

Pure refactor in preparation for Step 2.5. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Step 2.5 を TDD で実装（基本ケース）

**Files:**

- Modify: `src/features/editor/auto-connect.ts` (Step 2 と Step 3 の間に Step 2.5 ブロック追加)
- Modify: `src/features/editor/auto-connect.test.ts` (新規テスト追加)

- [ ] **Step 1: 失敗テストを書く（RED）**

`src/features/editor/auto-connect.test.ts` の `describe('findClosestUpstream', () => { ... })` の末尾、最後の `it(...)` の後ろに以下を追加：

```ts
it('should return crossing arrow upstream when new node is on its path (Step 2.5)', () => {
  // A(l0,r0) → C(l1,r2). New node at (r1, l1).
  // Step 1: same-row r1 — none.
  // Step 2: same-lane l1 upstream — none (C is downstream).
  // Step 2.5: arrow A→C, fromRi=0 < newRi=1 < toRi=2, toLi=l1 === newLi=l1 (タイプ①).
  //          → returns A + splitArrowId.
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    A: { lid: 'l0', rid: 'r0' },
    C: { lid: 'l1', rid: 'r2' },
  }
  const arrows = [{ id: 'a1', from: 'A', to: 'C', comment: '' }]
  const result = findClosestUpstream(tasks, rows, lanes, 1, 1, arrows)
  expect(result?.key).toBe('A')
  expect(result?.splitArrowId).toBe('a1')
})
```

- [ ] **Step 2: テスト失敗を確認（RED）**

```bash
npx vitest run src/features/editor/auto-connect.test.ts -t "Step 2.5"
```

期待: FAIL — 現状 Step 3 で `null` が返るため `result?.key` は `undefined`。

- [ ] **Step 3: Step 2.5 を実装（GREEN）**

`src/features/editor/auto-connect.ts` の Step 2 ブロック直後（既存の Step 3 ブロック直前）に以下を挿入：

```ts
// 2.5. Crossing arrow at cell: if an arrow's path passes through (newRi, newLi),
//      use its `from` node as upstream and tag the arrow ID for targeted splice.
//      Inserted between Step 2 and Step 3 so same-row / same-lane upstream wins,
//      but a crossing arrow beats an unrelated tail.
{
  type Candidate = { id: string; from: string; toLiMatches: boolean; fromRiDist: number }
  let best: Candidate | null = null
  for (const arrow of arrows) {
    const fromTask = tasks[arrow.from]
    const toTask = tasks[arrow.to]
    if (!fromTask || !toTask) continue
    const fromRi = rows.findIndex((r) => r.id === fromTask.rid)
    const toRi = rows.findIndex((r) => r.id === toTask.rid)
    const fromLi = lanes.findIndex((l) => l.id === fromTask.lid)
    const toLi = lanes.findIndex((l) => l.id === toTask.lid)
    if (fromRi < 0 || toRi < 0 || fromLi < 0 || toLi < 0) continue
    if (!(fromRi < newRi && toRi > newRi)) continue

    const toLiMatches = toLi === newLi
    const minLi = Math.min(fromLi, toLi)
    const maxLi = Math.max(fromLi, toLi)
    const passesLaneRange = minLi <= newLi && newLi <= maxLi
    if (!toLiMatches && !passesLaneRange) continue

    const fromRiDist = newRi - fromRi
    if (
      !best ||
      (toLiMatches && !best.toLiMatches) ||
      (toLiMatches === best.toLiMatches && fromRiDist < best.fromRiDist)
    ) {
      best = { id: arrow.id, from: arrow.from, toLiMatches, fromRiDist }
    }
  }
  if (best) return { key: best.from, splitArrowId: best.id }
}
```

- [ ] **Step 4: テスト成功を確認（GREEN）**

```bash
npx vitest run src/features/editor/auto-connect.test.ts -t "Step 2.5"
```

期待: PASS。

- [ ] **Step 5: 全関連テストでリグレッションなしを確認**

```bash
npx vitest run src/features/editor/auto-connect.test.ts src/features/editor/hooks/useArrows.test.ts
```

期待: 全テストパス。

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/auto-connect.ts src/features/editor/auto-connect.test.ts
git commit -m "$(cat <<'EOF'
feat(#336): add Step 2.5 crossing-arrow upstream detection

When a new node sits on an existing arrow's path (row crossing + lane match),
findClosestUpstream returns the arrow's `from` node and tags the matched
arrow ID for the caller to splice.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Step 2.5 のカバレッジテスト追加

**Files:**

- Modify: `src/features/editor/auto-connect.test.ts`

Task 2 で実装は完了しているので、本タスクは挙動を網羅するテストを追加するだけ。すべて初回からパスするはず。

- [ ] **Step 1: タイプ①優先のテストを追加**

`describe('findClosestUpstream', ...)` の末尾に追加：

```ts
it('should prefer toLi===newLi (タイプ①) over lane-range match (タイプ②) in Step 2.5', () => {
  // Two crossing arrows:
  //   - A(l0,r0) → B(l4,r2): タイプ② (newLi=l2 in [l0..l4])
  //   - X(l1,r0) → Y(l2,r2): タイプ① (toLi=l2=newLi)
  // New at (r1, l2). Both pass row crossing. タイプ① must win.
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    A: { lid: 'l0', rid: 'r0' },
    B: { lid: 'l4', rid: 'r2' },
    X: { lid: 'l1', rid: 'r0' },
    Y: { lid: 'l2', rid: 'r2' },
  }
  const arrows = [
    { id: 'aAB', from: 'A', to: 'B', comment: '' },
    { id: 'aXY', from: 'X', to: 'Y', comment: '' },
  ]
  const result = findClosestUpstream(tasks, rows, lanes, 1, 2, arrows)
  expect(result?.key).toBe('X')
  expect(result?.splitArrowId).toBe('aXY')
})
```

- [ ] **Step 2: fromRi 近接タイブレークのテストを追加**

```ts
it('should prefer closer fromRi when both candidates are タイプ① in Step 2.5', () => {
  // Two タイプ① arrows landing in newLi=l1:
  //   - A(l0,r0) → C(l1,r5)  fromRi=0, dist=2
  //   - D(l0,r1) → E(l1,r5)  fromRi=1, dist=1 ← closer
  // New at (r2, l1).
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    A: { lid: 'l0', rid: 'r0' },
    C: { lid: 'l1', rid: 'r5' },
    D: { lid: 'l0', rid: 'r1' },
    E: { lid: 'l1', rid: 'r5' },
  }
  const arrows = [
    { id: 'aAC', from: 'A', to: 'C', comment: '' },
    { id: 'aDE', from: 'D', to: 'E', comment: '' },
  ]
  const result = findClosestUpstream(tasks, rows, lanes, 2, 1, arrows)
  expect(result?.key).toBe('D')
  expect(result?.splitArrowId).toBe('aDE')
})
```

- [ ] **Step 3: Step 2 が Step 2.5 より優先されるテストを追加**

```ts
it('should prefer same-lane upstream (Step 2) over crossing arrow (Step 2.5)', () => {
  // Same-lane upstream P(l1,r1) and crossing arrow A→C exist.
  // Step 2 must return P, splitArrowId must be undefined.
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    P: { lid: 'l1', rid: 'r1' },
    A: { lid: 'l0', rid: 'r0' },
    C: { lid: 'l1', rid: 'r3' },
  }
  const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
  const result = findClosestUpstream(tasks, rows, lanes, 2, 1, arrows)
  expect(result?.key).toBe('P')
  expect(result?.splitArrowId).toBeUndefined()
})
```

- [ ] **Step 4: Step 1 が Step 2.5 より優先されるテストを追加**

```ts
it('should prefer same-row node (Step 1) over crossing arrow (Step 2.5)', () => {
  // Same-row node SR(l0,r1) and crossing arrow A→C through (r1,l1).
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    SR: { lid: 'l0', rid: 'r1' },
    A: { lid: 'l0', rid: 'r0' },
    C: { lid: 'l1', rid: 'r2' },
  }
  const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
  const result = findClosestUpstream(tasks, rows, lanes, 1, 1, arrows)
  expect(result?.key).toBe('SR')
  expect(result?.splitArrowId).toBeUndefined()
})
```

- [ ] **Step 5: レーン条件不一致のとき Step 3 へフォールスルーするテストを追加**

```ts
it('should fall through to Step 3 when crossing arrow does not match lane criteria', () => {
  // Arrow A(l0,r0) → C(l1,r2). New at (r1, l3).
  // Row crossing OK, but neither toLi(l1)===newLi(l3) nor newLi in [l0..l1] range.
  // → Step 2.5 misses, Step 3 picks tail T.
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
  const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    A: { lid: 'l0', rid: 'r0' },
    C: { lid: 'l1', rid: 'r2' },
    T: { lid: 'l3', rid: 'r0' }, // isolated tail in upstream row
  }
  const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
  const result = findClosestUpstream(tasks, rows, lanes, 1, 3, arrows)
  expect(result?.key).toBe('T')
  expect(result?.splitArrowId).toBeUndefined()
})
```

- [ ] **Step 6: issue 再現シナリオのテストを追加**

```ts
it('should reproduce issue #336 scenario (案件情報登録 → 正式登録 with new node on path)', () => {
  // 案件情報登録 (l_sharepoint, r12) → 正式登録 (l_input, r14)
  // 情報提供依頼 (l_sales, r10) is an isolated tail — must NOT be picked.
  // New node at (r13, l_input). Step 2.5 must intercept.
  const rows = Array.from({ length: 16 }, (_, i) => ({ id: `r${i}` }))
  const lanes = [{ id: 'l_sales' }, { id: 'l_sharepoint' }, { id: 'l_input' }]
  const tasks: Record<string, { lid: string; rid: string }> = {
    info_request: { lid: 'l_sales', rid: 'r10' }, // 情報提供依頼 (tail)
    sp_register: { lid: 'l_sharepoint', rid: 'r12' }, // 案件情報登録
    formal_register: { lid: 'l_input', rid: 'r14' }, // 正式登録
  }
  const arrows = [{ id: 'a_sp_to_formal', from: 'sp_register', to: 'formal_register', comment: '' }]
  const result = findClosestUpstream(tasks, rows, lanes, 13, 2, arrows)
  expect(result?.key).toBe('sp_register')
  expect(result?.splitArrowId).toBe('a_sp_to_formal')
})
```

- [ ] **Step 7: テスト実行 → 全パス確認**

```bash
npx vitest run src/features/editor/auto-connect.test.ts
```

期待: 追加した5件含めて全パス。

- [ ] **Step 8: コミット**

```bash
git add src/features/editor/auto-connect.test.ts
git commit -m "$(cat <<'EOF'
test(#336): cover Step 2.5 priority, tiebreakers, fallthrough, repro

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `useArrows` のターゲット限定スプライスを TDD で実装

**Files:**

- Modify: `src/features/editor/hooks/useArrows.ts:30-44`
- Modify: `src/features/editor/hooks/useArrows.test.ts`

- [ ] **Step 1: 失敗テストを書く（RED）**

`src/features/editor/hooks/useArrows.test.ts` の `describe('autoConnectOnCreate', ...)` の末尾、最後の `it(...)` の後ろに追加：

```ts
it('should splice only the crossing arrow (Step 2.5), not unrelated outgoing from same upstream', () => {
  // A(l0,r0) → C(l1,r2): タイプ① crossing arrow through (r1, l1)
  // A(l0,r0) → D(l2,r3): unrelated downstream, NOT on path of (r1, l1)
  //   But min(l0,l2)=0, max=2, newLi=1 → タイプ② would also match for A→D.
  //   タイプ① (A→C) must win, and only A→C must be spliced.
  const tasks: Record<string, TaskData> = {
    A: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
    C: { label: 'C', lid: 'l1', rid: 'r2', nodeId: 'n3' },
    D: { label: 'D', lid: 'l2', rid: 'r3', nodeId: 'n4' },
    l1_r1: { label: 'B', lid: 'l1', rid: 'r1', nodeId: 'n2' },
  }
  const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
  const lanes: InternalLane[] = [
    { id: 'l0', name: 'L0', ci: 0 },
    { id: 'l1', name: 'L1', ci: 1 },
    { id: 'l2', name: 'L2', ci: 2 },
  ]
  const arrows: InternalArrow[] = [
    { id: 'aAC', from: 'A', to: 'C', comment: 'orig' },
    { id: 'aAD', from: 'A', to: 'D', comment: '' },
  ]
  const { result } = renderHook(() =>
    useArrows({
      ...defaultOptions(),
      tasks,
      rows,
      lanes,
      initialArrows: arrows,
    }),
  )
  act(() => {
    result.current.autoConnectOnCreate('l1_r1', 1, 1)
  })

  // A→C is spliced into A→B + B→C; A→D is untouched.
  const pairs = result.current.arrows.map((a) => `${a.from}->${a.to}`).sort()
  expect(pairs).toEqual(['A->D', 'A->l1_r1', 'l1_r1->C'])
  // Original A→D arrow ID preserved (not removed and re-added)
  expect(result.current.arrows.find((a) => a.id === 'aAD')).toBeDefined()
  // Original A→C arrow is removed
  expect(result.current.arrows.find((a) => a.id === 'aAC')).toBeUndefined()
  // Comment from A→C carries to B→C
  const bToC = result.current.arrows.find((a) => a.from === 'l1_r1' && a.to === 'C')
  expect(bToC?.comment).toBe('orig')
})
```

- [ ] **Step 2: テスト失敗を確認（RED）**

```bash
npx vitest run src/features/editor/hooks/useArrows.test.ts -t "splice only the crossing arrow"
```

期待: FAIL — 現状の broad splice では `A→D` も `A→l1_r1 → l1_r1→D` に書き換えられてしまう（または `A→D` の id が変わる）ため `pairs` が一致しない。

- [ ] **Step 3: ターゲット限定スプライスを実装（GREEN）**

`src/features/editor/hooks/useArrows.ts:22-53` の `autoConnectOnCreate` 全体を以下に書き換える：

```ts
const autoConnectOnCreate = (taskKey: string, ri: number, li: number): void => {
  if (!autoConnect || Object.keys(tasks).length < 1) return
  const result = findClosestUpstream(tasks, rows, lanes, ri, li, arrows)
  if (!result) return
  const bestKey = result.key
  const splitArrowId = result.splitArrowId

  // Step 2.5 hit: splice only the matched arrow (targeted).
  // Otherwise (Step 1/2/3): if upstream is in a row above, splice all of its
  // outgoing arrows whose target is below the new node (broad — preserves
  // existing same-lane chain insertion behavior).
  let splitArrows: InternalArrow[]
  if (splitArrowId) {
    splitArrows = arrows.filter((a) => a.id === splitArrowId)
  } else {
    const bestTask = tasks[bestKey]
    const bestRi = bestTask ? rows.findIndex((r) => r.id === bestTask.rid) : -1
    splitArrows =
      bestRi >= 0 && bestRi < ri
        ? arrows.filter((a) => {
            if (a.from !== bestKey) return false
            const toTask = tasks[a.to]
            if (!toTask) return false
            const toRi = rows.findIndex((r) => r.id === toTask.rid)
            return toRi > ri
          })
        : []
  }

  const splitIds = new Set(splitArrows.map((a) => a.id))
  autoSplitHandledRef.current = splitIds
  setArrows((prev) => {
    const filtered = prev.filter((a) => !splitIds.has(a.id))
    const additions: InternalArrow[] = [{ id: uid(), from: bestKey, to: taskKey, comment: '' }]
    for (const s of splitArrows) {
      additions.push({ id: uid(), from: taskKey, to: s.to, comment: s.comment })
    }
    return [...filtered, ...additions]
  })
}
```

注: ロジック差分は冒頭の `result` 受け取りと `splitArrowId` 分岐のみ。それ以降の `splitIds` 管理 / `setArrows` の差分計算 / `autoSplitHandledRef` 連携は据え置き。

- [ ] **Step 4: テスト成功を確認（GREEN）**

```bash
npx vitest run src/features/editor/hooks/useArrows.test.ts -t "splice only the crossing arrow"
```

期待: PASS。

- [ ] **Step 5: useArrows.test.ts 全体のリグレッションなしを確認**

特に line 99-126 の「同レーン上流での broad splice」テスト、line 158-191 の「複数 outgoing の broad splice」テスト、line 334-369 の「auto-split された矢印はトーストに出さない」テストが落ちないこと。

```bash
npx vitest run src/features/editor/hooks/useArrows.test.ts
```

期待: 全テストパス。

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/hooks/useArrows.ts src/features/editor/hooks/useArrows.test.ts
git commit -m "$(cat <<'EOF'
feat(#336): targeted splice for Step 2.5 crossing-arrow case

When findClosestUpstream returns splitArrowId (Step 2.5 hit), splice only
that one arrow. Step 1/2/3 paths keep the existing broad splice for same-lane
chain insertion.

Closes #336

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テストスイート実行**

```bash
npm test
```

期待: 全テストパス。FAIL ゼロ。

- [ ] **Step 2: TypeScript / Lint チェック**

```bash
npm run typecheck 2>/dev/null || npx tsc --noEmit
npm run lint 2>/dev/null || true
```

期待: 型エラーゼロ。lint エラーゼロ。

- [ ] **Step 3: ブラウザ目視確認**

`~/.claude/CLAUDE.md` の Workflow Step 6 に従い、Playwright または手動でフローエディタを起動し以下を確認：

1. 既存：縦に通過する矢印 `A → C` を含むフローを開く（または作る）
2. 矢印の経路上のセル（A〜C 中間行 / C と同レーン）に新ノード B を追加
3. 自動接続が `A → B → C` のスプライスを実行することを確認
4. 別の outgoing がある場合（A→D 等）、その矢印が無傷で残ることを確認
5. LCP が 1秒以内であることを確認

スクリーンショットは `.screenshots/` に保存。

- [ ] **Step 4: 検証合格でコミットなし**

検証のみで新規ファイル変更なし。次は Workflow Step 7（main 同期）→ Step 8（PR 作成）へ進む。

---

## 完了条件

- [ ] Task 1 〜 4 のすべての commit が main にマージ可能な状態
- [ ] `npm test` 全パス
- [ ] `npx tsc --noEmit` 型エラーなし
- [ ] ブラウザで issue #336 のシナリオが解決していることを確認
- [ ] Step 2.5 が原因で既存テスト・既存挙動にリグレッションがないことを確認
