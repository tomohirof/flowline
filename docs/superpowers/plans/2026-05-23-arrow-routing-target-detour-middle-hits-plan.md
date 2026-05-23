# Arrow Routing target-detour symmetric middle-hits 対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** target-detour と both-detour.targetDetourX で `pickDetourX(opts)` API に source 方向 push の `targetDirection` を渡し、中央水平 H が middle-row 障害を貫通する症状を symmetric に解消する。

**Architecture:** issue #374 で導入済みの `pickDetourX(opts)` API を、target-detour 側からは **逆符号** の `targetDirection` で呼び出す。中央 H = `[s.x, detourX]` が obstacles の source 側を通るように detourX を push する。middleRowHits 空時は opts 省略で旧ロジック維持 (regression guard、 issue #374 と同パターン)。

**Tech Stack:** TypeScript, Vitest, React (FlowEditor/SharedFlowViewer), Cloudflare Pages (deploy target)

---

## File Structure

**Modify:**

- `src/lib/arrow-routing.ts` — target-detour 分岐 (L420) と both-detour.targetDetourX (L409) で opts を渡す。コメント更新 (L416-L418)。
- `src/lib/arrow-routing.test.ts` — 新規 5 ケース追加 + 既存 1 ケース (L1110-L1112) の expected 値更新。

**No new files.**

---

### Task 1: failing test #1 — target-detour に middle-row hit (左→右 diagonal)

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (L1036-L1056 の issue #374 ブロック直後に追加。新ブロック `// --- issue #375: target-detour にも middle-row 障害認識を追加 ---` を作成)

- [ ] **Step 1: 新規セクションヘッダ + テスト #1 を追加**

挿入位置: `src/lib/arrow-routing.test.ts` の現行 L1113 (`should pick sourceDetourX past middle-row hit in both-detour` テストの終了 `})` の直後、L1115 (`should avoid middle-row obstacle in issue #366 reproduction case`) の直前。

挿入コード:

```typescript
// --- issue #375: target-detour にも middle-row 障害認識を追加 (対称対応) ---

it('should pick detourX past middle-row hit when target-detour selected and middle-row hit exists', () => {
  // issue #375 再現 (source-detour の対称): target-col blocker + middle-row hit。
  // s=(100, 100), e=(300, 300), my=200。target は右 (e.x > s.x → targetDirection_normal = +1)。
  // targetColHit: (300, 200) → target col=300
  // middleRowHit: (200, 200) → middle col
  // 期待: 新ロジック (符号反転) で detourX = min(targetCol.left=260, middleRow.left=160) - 14 = 146
  // (source-detour とは符号が逆: target-detour 中央 H [s.x, detourX] を obstacles の source 側に通す)
  const obstacles: Bbox[] = [
    { x: 300, y: 200, w: 80, h: 40 }, // targetColHit, left=260
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit, left=160
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('target-detour')
  if (r?.kind === 'target-detour') {
    // detourX = min(260, 160) - 14 = 146 (source 方向 push)
    expect(r.detourX).toBe(146)
    // shift-my: 200 + 20 + 14 = 234 (h=40, range 内)
    expect(r.my).toBe(234)
  }
})
```

- [ ] **Step 2: 失敗確認**

```bash
cd /Volumes/SSD4TB/DevCode/flowline/.worktrees/feat-arrow-routing-target-detour-375
npx vitest run src/lib/arrow-routing.test.ts -t "should pick detourX past middle-row hit when target-detour selected"
```

期待: FAIL。
理由: 現行 target-detour 分岐は opts を渡していないので、旧ロジックで `detourX = max(targetCol=300+40, ...) + 14 = 354` (rightBlocked により左迂回なら 260-14=246) が出る。146 にはならない。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): target-detour に middle-row 障害認識を追加するテスト #1 (red)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: failing test #2 — 右→左 diagonal (target left)

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (Task 1 で追加したブロックの直後)

- [ ] **Step 1: テスト #2 を追加**

Task 1 の `})` 直後に挿入:

```typescript
it('should mirror correctly for right-to-left diagonal target-detour with middle-row hit on right', () => {
  // source.x > target.x: target は左 (targetDirection_normal=-1 → 渡す値は +1)。
  // s=(300, 100), e=(100, 300), my=200
  // targetColHit: (100, 200) → target col=100
  // middleRowHit: (200, 200) → middle col
  // 期待: detourX = max(targetCol.right=140, middleRow.right=240) + 14 = 254 (右 = source 方向 push)
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // targetColHit, right=140
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit, right=240
  ]
  const r = detectDiagonalDetour({ x: 300, y: 100 }, { x: 100, y: 300 }, obstacles)
  expect(r?.kind).toBe('target-detour')
  if (r?.kind === 'target-detour') {
    // detourX = max(140, 240) + 14 = 254
    expect(r.detourX).toBe(254)
  }
})
```

- [ ] **Step 2: 失敗確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should mirror correctly for right-to-left diagonal target-detour"
```

期待: FAIL。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): 右→左 diagonal target-detour のミラーテスト #2 (red)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: failing test #3 — both-detour で targetDetourX も新ロジック適用

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (Task 2 の直後)

- [ ] **Step 1: テスト #3 を追加**

Task 2 の `})` 直後に挿入:

```typescript
it('should pick targetDetourX past middle-row hit in both-detour when middle-row hit exists', () => {
  // both-detour で sourceDetourX (新ロジック target 方向) + targetDetourX (新ロジック source 方向) 両方適用。
  // s=(100, 100), e=(300, 300), my=200
  // sourceColHit: (100, 200), targetColHit: (300, 200), middleRowHit: (200, 200)
  // 期待: sourceDetourX = max(140, 240) + 14 = 254 (既存)
  //       targetDetourX = min(260, 160) - 14 = 146 (新ロジック適用)
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // sourceColHit
    { x: 300, y: 200, w: 80, h: 40 }, // targetColHit
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('both-detour')
  if (r?.kind === 'both-detour') {
    expect(r.sourceDetourX).toBe(254) // 既存
    expect(r.targetDetourX).toBe(146) // 新ロジック適用 (旧来は 354)
  }
})
```

- [ ] **Step 2: 失敗確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should pick targetDetourX past middle-row hit"
```

期待: FAIL (targetDetourX が 354 のまま)。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): both-detour.targetDetourX 新ロジック適用テスト #3 (red)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: failing test #4 — middleRowHits 空 fallback (target-detour regression guard)

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (Task 3 の直後)

- [ ] **Step 1: テスト #4 を追加**

Task 3 の `})` 直後に挿入:

```typescript
it('should fall back to blocker-aware logic when middle-row hit is empty (target-detour regression guard)', () => {
  // issue #374 と対称のリグレッションガード: target-detour で middleRowHits が空 のとき
  // opts を渡すと隣接列 blocker を貫通する。期待: 空 → 旧ロジック (binary blocker) に戻る。
  // s=(200,128), e=(600,372): targetColHit (600, 330) + additionalBlocker (450, 330, 隣接列)。
  // additionalBlocker は y=330 → my=250 から |330-250|=80 で middle row 圏外 (h/2+2=30)。
  const obstacles: Bbox[] = [
    { x: 600, y: 330, w: 152, h: 56 }, // targetColHit, left=524
    { x: 450, y: 330, w: 152, h: 56 }, // 隣接列 blocker, range [374, 526]
  ]
  const r = detectDiagonalDetour({ x: 200, y: 128 }, { x: 600, y: 372 }, obstacles)
  expect(r?.kind).toBe('target-detour')
  if (r?.kind === 'target-detour') {
    // 旧ロジック: leftBlocked (450 が 600 の左、Y 重なり) → 右迂回 = 600+76+14 = 690
    // 新ロジック (バグ): targetDirection=-1 強制 → min(524, 374) - 14 = 360 (additionalBlocker 中心 450 を貫通する位置)
    expect(r.detourX).toBe(690)
  }
})
```

- [ ] **Step 2: 失敗確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should fall back to blocker-aware logic when middle-row hit is empty .target-detour"
```

期待: このテスト自体は現行コードでも PASS する可能性がある (現状の target-detour は opts を渡さないので)。**確実に red にするため、 Task 5 の実装 (opts を無条件で渡す版を一旦書く) で初めて fail する想定だが、 plan としては middleRowHits 空時は opts 渡さない実装で最初から green**。

ここで挙動を厳密に確認: 現状の `pickDetourX(targetColHits, obstacles, [my, e.y], obstacles)` (opts 無し) で

- targetColHits = [(600,330,152,56)] → my=250 から |330-250|=80 > 56/2+2=30 → middle 行圏外
- 実際 targetColHits の filter: targetColHit at (600,330) → `Math.abs(b.x - e.x=600) < 76+2=78` ✓ && `b.y±h/2 = [302, 358]` と `[my=250, e.y=372]` の重なり: `302 < 371 && 358 > 251` ✓ → targetColHits 含む
- middleRowHits: (450, 330) → `Math.abs(b.y - my=250) < 28+2=30` → `|330-250|=80 > 30` → middleRowHits 圏外
- 結果: middleRowHits 空、旧ロジックで detourX 算出。leftBlocked = (600 の左 450 が Y 重なり) → 右迂回 detourX = 600+76+14 = 690 ✓

このテストは Task 5 の実装で middleRowHits 空時に opts を渡さない設計を堅持する **regression guard**。実装後も PASS が期待される。

`vitest run` を実行し、PASS することを確認 (red ではなく green で OK)。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): middleRowHits 空時の旧ロジック fallback ガード (target-detour)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 実装 — target-detour 分岐で opts を渡す

**Files:**

- Modify: `src/lib/arrow-routing.ts` L416-L424

- [ ] **Step 1: コメント更新 + opts 渡し**

現行 L416-L424:

```typescript
// 注: target-detour の detourX 計算は対称的に opts { targetDirection, middleHitsToClear } を
// 渡せる API を持つが、本 PR (issue #374) では source-detour のみに適用してリグレッションリスクを
// 抑える。target-detour / both-detour.tgtDetourX の対称対応は issue #375 でフォローアップ予定。
if (targetColHits.length > 0 && sourceColHits.length === 0) {
  const detourX = pickDetourX(targetColHits, obstacles, [my, e.y], obstacles)
  const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
  const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
  return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
}
```

を以下に置換:

```typescript
// target-detour の opts.targetDirection は source-detour とは符号が逆。
// 中央 H = [s.x, detourX] を middleRowHits の source 側に通すため detourX を -targetDirection
// (= source) 方向に push する。middleRowHits 空時は旧ロジック (binary blocker) に fallback
// して隣接列 blocker 貫通リグレッションを防ぐ (issue #374 と同パターン)。
if (targetColHits.length > 0 && sourceColHits.length === 0) {
  const detourX = pickDetourX(
    targetColHits,
    obstacles,
    [my, e.y],
    obstacles,
    middleRowHits.length > 0
      ? {
          targetDirection: (e.x > s.x ? -1 : 1) as 1 | -1,
          middleHitsToClear: middleRowHits,
        }
      : undefined,
  )
  const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
  const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
  return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
}
```

Edit ツール使用:

```
old_string:
  // 注: target-detour の detourX 計算は対称的に opts { targetDirection, middleHitsToClear } を
  // 渡せる API を持つが、本 PR (issue #374) では source-detour のみに適用してリグレッションリスクを
  // 抑える。target-detour / both-detour.tgtDetourX の対称対応は issue #375 でフォローアップ予定。
  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    const detourX = pickDetourX(targetColHits, obstacles, [my, e.y], obstacles)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
  }

new_string:
  // target-detour の opts.targetDirection は source-detour とは符号が逆。
  // 中央 H = [s.x, detourX] を middleRowHits の source 側に通すため detourX を -targetDirection
  // (= source) 方向に push する。middleRowHits 空時は旧ロジック (binary blocker) に fallback
  // して隣接列 blocker 貫通リグレッションを防ぐ (issue #374 と同パターン)。
  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    const detourX = pickDetourX(
      targetColHits,
      obstacles,
      [my, e.y],
      obstacles,
      middleRowHits.length > 0
        ? {
            targetDirection: (e.x > s.x ? -1 : 1) as 1 | -1,
            middleHitsToClear: middleRowHits,
          }
        : undefined,
    )
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
  }
```

- [ ] **Step 2: テスト #1, #2 が green になることを確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should pick detourX past middle-row hit when target-detour selected"
npx vitest run src/lib/arrow-routing.test.ts -t "should mirror correctly for right-to-left diagonal target-detour"
```

両方 PASS。

- [ ] **Step 3: 他のテストへのリグレッション確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts
```

期待: Task 3 のテストはまだ FAIL (both-detour.targetDetourX 未対応)。他は全 PASS。

具体的に Task 3 が FAIL する想定:

- `should pick targetDetourX past middle-row hit in both-detour`: targetDetourX=146 vs 実際の 354

それ以外の既存テストはすべて PASS であること。

- [ ] **Step 4: コミット**

```bash
git add src/lib/arrow-routing.ts
git commit -m "feat(#375): target-detour 分岐で pickDetourX(opts) を呼び出す (-targetDirection)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 実装 — both-detour.targetDetourX で opts を渡す

**Files:**

- Modify: `src/lib/arrow-routing.ts` L390-L414 周辺の both-detour ブロック

- [ ] **Step 1: targetDetourX に opts を渡す**

現行コード (L407-L409 付近):

```typescript
// targetDetourX: 旧ロジック維持。target-detour 系の対称対応は issue #375 で別途。
const targetDetourX = pickDetourX(targetColHits, tgtBlockers, [my, e.y], obstacles)
```

を以下に置換:

```typescript
// targetDetourX: source-detour とは符号が逆の targetDirection で symmetric に対応 (issue #375)。
const targetDetourX = pickDetourX(
  targetColHits,
  tgtBlockers,
  [my, e.y],
  obstacles,
  middleRowHits.length > 0
    ? {
        targetDirection: (e.x > s.x ? -1 : 1) as 1 | -1,
        middleHitsToClear: middleRowHits,
      }
    : undefined,
)
```

Edit ツール使用:

```
old_string:
    // targetDetourX: 旧ロジック維持。target-detour 系の対称対応は issue #375 で別途。
    const targetDetourX = pickDetourX(targetColHits, tgtBlockers, [my, e.y], obstacles)

new_string:
    // targetDetourX: source-detour とは符号が逆の targetDirection で symmetric に対応 (issue #375)。
    const targetDetourX = pickDetourX(
      targetColHits,
      tgtBlockers,
      [my, e.y],
      obstacles,
      middleRowHits.length > 0
        ? {
            targetDirection: (e.x > s.x ? -1 : 1) as 1 | -1,
            middleHitsToClear: middleRowHits,
          }
        : undefined,
    )
```

- [ ] **Step 2: テスト #3 が green になることを確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should pick targetDetourX past middle-row hit"
```

PASS。

- [ ] **Step 3: 既存テストのリグレッション確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts
```

期待される FAIL は **`should pick sourceDetourX past middle-row hit in both-detour when middle-row hit exists on target side`** (L1110 の `expect(r.targetDetourX).toBe(354)` が 146 に変わるため)。これは Task 7 で update する想定。他は全 PASS。

- [ ] **Step 4: コミット**

```bash
git add src/lib/arrow-routing.ts
git commit -m "feat(#375): both-detour.targetDetourX で pickDetourX(opts) を呼び出す

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 既存テストの expected 値更新

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` L1096-L1113 付近

- [ ] **Step 1: 既存テストの expected 更新**

現行 L1110-L1112 付近 (`should pick sourceDetourX past middle-row hit in both-detour`):

```typescript
expect(r.sourceDetourX).toBe(254) // 新ロジック適用
expect(r.targetDetourX).toBe(354) // 旧ロジック維持 (issue #375 で対応)
```

を以下に置換:

```typescript
expect(r.sourceDetourX).toBe(254) // 新ロジック適用 (source-detour, +targetDirection)
expect(r.targetDetourX).toBe(146) // 新ロジック適用 (target-detour, -targetDirection, issue #375)
```

Edit ツール使用:

```
old_string:      expect(r.sourceDetourX).toBe(254) // 新ロジック適用
      expect(r.targetDetourX).toBe(354) // 旧ロジック維持 (issue #375 で対応)

new_string:      expect(r.sourceDetourX).toBe(254) // 新ロジック適用 (source-detour, +targetDirection)
      expect(r.targetDetourX).toBe(146) // 新ロジック適用 (target-detour, -targetDirection, issue #375)
```

- [ ] **Step 2: 全テスト pass を確認**

```bash
npx vitest run src/lib/arrow-routing.test.ts
```

すべて PASS。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): both-detour 既存テストの expected.targetDetourX を新ロジック値に更新

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 統合テスト — buildArrowPath での target-detour 検証

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (`buildArrowPath - 斜め迂回（異行×異レーン）` describe ブロック内、L1595 付近を探す)

- [ ] **Step 1: 統合テスト追加**

該当箇所を確認:

```bash
grep -n "斜め迂回" src/lib/arrow-routing.test.ts | head
```

例えば `target-detour: v, h, v, h, v (5 segments)` (L1595) があるブロック。同じ describe 内の最後に以下を追加:

```typescript
it('should not cross middle-row obstacles in target-detour central H (issue #375)', () => {
  // target-detour で中央 H が middleRowHit を貫通しない構成。
  // s=(100, 100), e=(300, 300), my=200
  // targetColHit (300, 200, w=80) + middleRowHit (200, 200, w=80)
  // 期待 path: 中央 H = [s.x=100, detourX=146] at y=shiftedMy=234
  const obstacles: Bbox[] = [
    { x: 300, y: 200, w: 80, h: 40 }, // targetColHit
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit
  ]
  const result = buildArrowPath(
    { x: 100, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 100 },
    { x: 300, y: 300 },
    obstacles,
  )
  // 中央 H が x=200 (middleRowHit center) を貫通しないこと。
  // SVG path: M100,100 L100,234 L146,234 L146,... なら 中央 H range [100, 146] で x=200 を跨がない。
  expect(result.d).toContain('L146,234') // 中央 H の終点 (detourX, shiftedMy)
  // mx は中央 H 中点 = (s.x + detourX) / 2 = (100 + 146) / 2 = 123
  expect(result.mx).toBe(123)
  expect(result.my).toBe(234)
})
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run src/lib/arrow-routing.test.ts -t "should not cross middle-row obstacles in target-detour"
```

PASS 確認。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "test(#375): buildArrowPath で target-detour 中央 H が middleRow を貫通しないこと

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 全テスト + lint + typecheck 通過確認

**Files:** なし (検証のみ)

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

期待: 全件 PASS (1750+5=1755 程度。skipped を除く)。

1件でも FAIL したら原因を調査し、修正コミットを追加。プランの先には進まない。

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

エラーなし。

- [ ] **Step 3: lint**

```bash
npx eslint src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
```

エラーなし。

- [ ] **Step 4: フォーマット**

```bash
npx prettier --write src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts docs/superpowers/specs/2026-05-23-arrow-routing-target-detour-middle-hits-design.md docs/superpowers/plans/2026-05-23-arrow-routing-target-detour-middle-hits-plan.md
```

差分があれば確認:

```bash
git diff
```

差分があればコミット:

```bash
git add -u
git commit -m "chore(#375): apply prettier formatting

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: 実画面検証 (Playwright + /dev/render)

**Files:** なし (検証のみ)

- [ ] **Step 1: dev サーバー起動**

```bash
npm run dev
```

(別ターミナルでバックグラウンド実行)

- [ ] **Step 2: /dev/render?fixture=grupura-phone で source-detour 系の非回帰確認**

playwright で http://localhost:5173/dev/render?fixture=grupura-phone を開き、スクリーンショットを `.screenshots/375-grupura-phone-after.png` に保存。

issue #374 の修正後 path:
`M597.5,1400 L597.5,1414 L920,1414 L920,1456 L1060,1456 L1060,1512`

このパスが変わらないことを目視確認。target-detour 系の変更が source-detour ルートに影響しないこと。

- [ ] **Step 3: LCP 確認**

`/` をブラウザで開き、Performance パネルで LCP ≤ 1000ms を確認。超過したら再 commit 前に改善。

- [ ] **Step 4: dev サーバー停止**

バックグラウンドプロセスを終了。

- [ ] **Step 5: 確認結果を PR コメント用にメモ**

`.screenshots/375-grupura-phone-after.png` を残し、PR 作成時に「target-detour パターンの再現フィクスチャは未作成のため目視検証は source-detour 非回帰のみ」とコメントする旨を控える。

---

### Task 11: 最新 main 同期 + 全テスト

**Files:** なし

- [ ] **Step 1: main rebase**

```bash
git pull origin main --rebase
```

コンフリクトがあれば解決。

- [ ] **Step 2: 全テスト再実行**

```bash
npm test
```

全件 PASS。失敗があれば修正してから次へ。

---

### Task 12: PR 作成 + CI watch + レビュー依頼

**Files:** なし

- [ ] **Step 1: push**

```bash
git push -u origin feat/arrow-routing-target-detour-375
```

- [ ] **Step 2: PR 作成**

```bash
gh pr create --title "fix(#375): target-detour にも middle-row 障害認識を symmetric 適用" --body "$(cat <<'EOF'
## Summary

issue #375 の対応。issue #374 で source-detour と both-detour.sourceDetourX に導入した \`pickDetourX(opts)\` API を、target-detour と both-detour.targetDetourX にも対称的に適用する。

target-detour の中央水平 H = \`[s.x, detourX]\` を middle-row 障害の **source 側** に通すため、source-detour とは **符号が逆** の \`targetDirection\` (e.x > s.x なら -1) を渡す。これにより detourX が \`min(extent.left) - DETOUR_MARGIN\` に push され、中央 H が obstacles の手前で終端する。

### 変更内容

- target-detour 分岐 (\`detectDiagonalDetour\`) で \`pickDetourX\` に \`opts\` を渡す
- both-detour の \`targetDetourX\` 計算でも同様
- middleRowHits 空時は opts 省略 → 旧ロジック (binary blocker) fallback
- 既存コメント (L416-L418) を更新

### 修正前後 (target-detour ケース)

```

旧: M100,100 L100,234 L354,234 L354,286 L300,286 L300,300 (中央 H が x=200 を貫通)
新: M100,100 L100,234 L146,234 L146,286 L300,286 L300,300 (detourX=146 で source 側を通る)

```

詳細設計: \`docs/superpowers/specs/2026-05-23-arrow-routing-target-detour-middle-hits-design.md\`
実装計画: \`docs/superpowers/plans/2026-05-23-arrow-routing-target-detour-middle-hits-plan.md\`

## Test plan

- [x] 新規ユニットテスト 4 ケース (target-detour 系)
- [x] 新規統合テスト 1 ケース (buildArrowPath target-detour)
- [x] 既存テスト 1 ケースの expected 値更新 (both-detour.targetDetourX)
- [x] 全テスト 1755+ PASS
- [x] lint + typecheck エラーなし
- [x] \`/dev/render?fixture=grupura-phone\` で source-detour 非回帰目視確認
- [x] LCP ≤ 1s 達成
- [ ] target-detour パターン専用フィクスチャは未作成 (issue #375 自体が予防的 symmetric fix のため)

Closes #375
Related: #374

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI watch**

```bash
gh pr checks --watch
```

FAIL したら修正 → push → 再 watch。

- [ ] **Step 4: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` を参照して実行。

- [ ] **Step 5: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

### Task 13: レビュー対応ループ (最大 10 回)

**Files:** レビュー指摘により変動

レビュー判定は **必ず claude のコメントのみを対象** にする。再レビュー後は再依頼コメントの `created_at` より後の `claude[bot]` コメントだけを判定対象にする。

- [ ] **Step 1: 1 分待機**

```bash
sleep 60
```

- [ ] **Step 2: レビュー取得**

```bash
gh pr view --json comments
```

- [ ] **Step 3: 判定**

- **[A:要修正]** / **[B:条件つき承認]**: 修正 → push → CI pass → 再レビュー依頼 → Step 1 に戻る
- **[C:承認OK]**: Task 14 へ進む

10 回超過したら人間にエスカレーション。

---

### Task 14: Merge + Deploy 確認 + Cleanup

**Files:** なし

- [ ] **Step 1: Merge**

```bash
gh pr merge --merge
```

- [ ] **Step 2: main 更新**

```bash
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 3: Deploy 確認**

`~/.claude/skills/deploy/SKILL.md` を参照。Cloudflare Pages デプロイ完了を確認。

- [ ] **Step 4: Worktree cleanup**

```bash
git worktree remove .worktrees/feat-arrow-routing-target-detour-375
git branch -d feat/arrow-routing-target-detour-375
git worktree list
```

残骸がないこと確認。

---

## Self-Review

### Spec coverage

- [x] target-detour 分岐に opts 適用 → Task 5
- [x] both-detour.targetDetourX に opts 適用 → Task 6
- [x] middleRowHits 空時の fallback → Task 5, 6 のロジックで担保
- [x] コメント更新 → Task 5
- [x] 新規ユニットテスト 4 ケース → Task 1, 2, 3, 4
- [x] 統合テスト 1 ケース → Task 8
- [x] 既存テスト更新 1 ケース → Task 7
- [x] middle-only fallback (L475) はスコープ外と明記済み (設計書)

### Placeholder scan

- [x] TBD/TODO なし
- [x] すべてのテスト/実装/コミットコマンドが具体的
- [x] エラー処理や validation の「適切に」表記なし

### Type consistency

- [x] `pickDetourX` の opts シグネチャは issue #374 で導入済み、本 plan で変更なし
- [x] `targetDirection: 1 | -1` 型キャストは Task 5, 6, テストで一貫
- [x] `detectDiagonalDetour` の返り値型 `DiagonalDetourResult` は変更なし
