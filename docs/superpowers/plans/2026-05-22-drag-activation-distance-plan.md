# ノードドラッグの activation distance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ノードドラッグに 6px の activation distance を導入し、mousedown 後の微小な手ブレで意図せず順序が入れ替わる誤操作を防ぐ (Issue #347)。

**Architecture:** `DragState` 型に `startClientX / startClientY / activated` を追加。`onDragStart` でスクリーン座標を捕捉し、`onSvgMouseMove` で `Math.hypot` を用いた円形しきい値ゲートを single/multi 共通の前段に置く。一度しきい値（6px、screen 座標）を超えれば不可逆に activated となり、以降は従来通り `cellFromPos`→`dragOver` を更新する。

**Tech Stack:** TypeScript / React / Vitest / Playwright

**Spec:** `docs/superpowers/specs/2026-05-22-drag-activation-distance-design.md`

**Branch / Worktree:** `fix/issue-347-drag-activation-distance` (`.worktrees/fix-issue-347-drag-activation-distance`)

---

## File Structure

| ファイル                                  | 役割                                                                                                        | 変更種別 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| `src/features/editor/types.ts`            | `DragState` 拡張（`startClientX`, `startClientY`, `activated`）                                             | Modify   |
| `src/features/editor/FlowEditor.tsx`      | `DRAG_ACTIVATION_DISTANCE` 定数追加、`onDragStart` で座標捕捉、`onSvgMouseMove` 冒頭に activation gate 追加 | Modify   |
| `src/features/editor/FlowEditor.test.tsx` | 6px しきい値の振る舞いテスト追加                                                                            | Modify   |

新規ファイル追加なし。pure function 化はしない（spec 通り、ロジックがシンプルで再利用予定もないため）。

---

## 前提知識（実装者向け）

### 主要な座標系・定数（読み取り専用、変更不要）

`FlowEditor.tsx:679-685` で定義:

- `RH = 84` (row height), `HH = 46` (header height), `TM = 24` (top margin)
- `LM = 28` (left margin)

`cellFromPos`（`src/lib/flow-engine.ts:198`）の挙動:

- `riRaw = Math.floor((sy - (TM + HH)) / RH)` → 行は上端踏み込みで切替
- 範囲外は clamp で端のセルにスナップ

### `onSave` の発火条件

`FlowEditor.tsx:581-597`: `tasks`/`order`/`arrows`/`memos`/`lanes`/`rows` のいずれかが構造変化すると `onSave(buildPayload())` が呼ばれる。**ドラッグ操作で swap が発火しなければ `onSave` は呼ばれない**。テストではこの性質を「swap が発火したか」の判定に使う。

### jsdom 環境下での `getBoundingClientRect`

jsdom はレイアウト計算をしないので、`svg.getBoundingClientRect()` は `{ top: 0, left: 0, ... }` を返す。つまり `svgPt(clientX, clientY)` は `{ x: clientX, y: clientY }` を返す（zoom=1）。これにより `cellFromPos` の判定はスクリーン座標と同じ値で動くため、`clientY` を `TM + HH = 70` を境に配置するだけで row 0/1 を切替えられる。

### 既存テストヘルパー

`FlowEditor.test.tsx:790-807` に既存ヘルパー:

```ts
const findNodeRects = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
    (r) => r.getAttribute('width') === '152',
  )
```

ノードの矩形（rect 要素）を取得する関数。新規テストでもこれを使う。

---

## Task 1: 5px move では swap しないテスト (RED) → 実装 (GREEN)

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx` — 新規 describe ブロック追加
- Modify: `src/features/editor/types.ts:205-208` — `DragState` 拡張
- Modify: `src/features/editor/FlowEditor.tsx` — 定数追加、`onDragStart` 更新、`onSvgMouseMove` 冒頭に gate 追加

このタスクで activation distance の実装本体を完成させる。

- [ ] **Step 1: failing test を追記**

`src/features/editor/FlowEditor.test.tsx` の末尾（`describe('logo navigation (#83)', ...)` の前）に以下の新規 describe を追加する:

```tsx
describe('ノードドラッグの activation distance (#347)', () => {
  // 同一レーン内に縦に並ぶ2ノード（row 0 と row 1）。
  // 1px の手ブレで意図せず swap してしまうバグを再現するための最小フロー。
  const createFlowWith2VerticalNodes = (): Flow => {
    const flow = createMinimalFlow()
    flow.lanes = [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }]
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'タスクA', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'タスクB', note: null, orderIndex: 1 },
    ]
    return flow
  }

  const findNodeRects = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
      (r) => r.getAttribute('width') === '152',
    )

  it('しきい値未達 (5px) の move では swap が発火しない', () => {
    const onSave = vi.fn()
    const { container } = render(
      <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)
    expect(rects.length).toBe(2)
    const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

    // mousedown は row 0 セル付近 (clientY=65, < TM+HH=70 → row 0 にクランプ)、
    // mousemove で 5px だけ下に移動 (clientY=70 でちょうど row 1 境界)。
    // 距離 5 < 6 のため activation gate がブロックする想定。
    fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 70 })
    fireEvent.mouseUp(svg, { clientX: 100, clientY: 70 })

    // swap が発火しなければ tasks/order に変化なし → onSave は呼ばれない
    expect(onSave).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストを実行して fail を確認**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "しきい値未達"
```

Expected: FAIL。現状コードでは 5px move でも `dragOver` が立ち、mouseup で swap が走るため `onSave` が呼ばれる。

> もし PASS してしまったらレイアウト前提（`clientY=65, 70`）が想定通り `cellFromPos` で別セルを返していない可能性。`clientY=60` (row 0) → `clientY=72` (row 1) のように、確実に行境界をまたぐが距離 5px に収まる値（例: `clientY=66 → 71` で距離 5）に調整。距離だけは必ず `Math.hypot(0, 5) = 5 < 6` を維持する。

- [ ] **Step 3: `DragState` 型を拡張**

`src/features/editor/types.ts:205-208` を以下に書き換える:

```ts
export interface DragState {
  key: string
  multi?: boolean
  startClientX: number
  startClientY: number
  activated: boolean
}
```

- [ ] **Step 4: 定数を追加**

`src/features/editor/FlowEditor.tsx:678` の `const T = THEMES[themeId]` の直前（または既存の定数群の近傍）にトップレベル定数を追加。具体的には `FlowEditor.tsx` の import 群の直後、`const FlowEditor = (...) => {` の前に以下を追記:

```ts
const DRAG_ACTIVATION_DISTANCE = 6
```

import 群の終端を確認するには `grep -n "^import\|^const FlowEditor" src/features/editor/FlowEditor.tsx | head -5`。

- [ ] **Step 5: `onDragStart` を更新**

`src/features/editor/FlowEditor.tsx:941-954` の `onDragStart` を以下に置換:

```tsx
const onDragStart = (k: string, e: React.MouseEvent): void => {
  e.stopPropagation()
  e.preventDefault()
  if (connectFrom || editing) return
  const base = {
    startClientX: e.clientX,
    startClientY: e.clientY,
    activated: false,
  }
  if (multiSel.size > 0 && multiSel.has(k)) {
    setDragging({ key: k, multi: true, ...base })
  } else {
    setDragging({ key: k, ...base })
    setMultiSel(new Set())
  }
  setSelTask(null)
  setSelArrow(null)
  setSelLane(null)
}
```

- [ ] **Step 6: `onSvgMouseMove` に activation gate を追加**

`src/features/editor/FlowEditor.tsx:982-983` の以下の行:

```tsx
if (!dragging) return
const cell = cellFromPos(pt.x, pt.y)
```

を以下に置換:

```tsx
if (!dragging) return
if (!dragging.activated) {
  const dx = e.clientX - dragging.startClientX
  const dy = e.clientY - dragging.startClientY
  if (Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE) {
    return
  }
  setDragging({ ...dragging, activated: true })
}
const cell = cellFromPos(pt.x, pt.y)
```

ポイント: gate は `dragging.multi` 分岐の**前**に置くため single/multi 両方に適用される。同じ event 内で gate を通過した直後の `cellFromPos`→`setDragOver` も継続実行する。

- [ ] **Step 7: テストを再実行して PASS を確認**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "しきい値未達"
```

Expected: PASS。

- [ ] **Step 8: TypeScript の型エラーがないか確認**

Run:

```bash
npx tsc --noEmit
```

Expected: エラーなし。

> `DragState` の必須フィールドが増えたため、`setDragging({...})` の呼び出し箇所で型エラーが出る可能性。`grep -n "setDragging({" src/features/editor/FlowEditor.tsx` で全箇所を確認。`null` を渡している箇所と `onDragStart` 以外で `setDragging({ key: ..., ...prev })` のようなパターンがあれば、`activated`/`startClientX`/`startClientY` を含めるよう修正する（Step 6 の `setDragging({ ...dragging, activated: true })` は既存の `dragging` を展開しているので OK）。

- [ ] **Step 9: 全テストを実行**

Run:

```bash
npm test -- --run
```

Expected: 既存テスト含めて全て PASS。FAIL があれば原因を特定して修正してから次へ進む。

- [ ] **Step 10: Commit**

```bash
git add src/features/editor/types.ts src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(#347): add 6px drag activation distance to prevent accidental swap

Add startClientX/startClientY/activated to DragState. Gate dragOver
updates behind a 6px (screen-coords, Euclidean) activation threshold
in onSvgMouseMove, applied to both single and multi drag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 6px 超え move で swap が発火するテスト（正常系の確認）

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx` — 既存 `describe('ノードドラッグの activation distance (#347)', ...)` 内に追加

しきい値超過時の正常な swap 動作を保証する回帰防止テスト。

- [ ] **Step 1: テストを追記**

`describe('ノードドラッグの activation distance (#347)', ...)` 内に追加:

```tsx
it('しきい値超え (6px 以上) の move で swap が発火する', () => {
  const onSave = vi.fn()
  const { container } = render(
    <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
  )
  const rects = findNodeRects(container)
  const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

  // mousedown を row 0 に、mousemove で row 1 まで明確に大きく動かす (84px = RH 分)。
  // 距離 84 >> 6 のため gate を通過し、cellFromPos が row 1 セルを返す想定。
  fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
  fireEvent.mouseMove(svg, { clientX: 100, clientY: 200 })
  fireEvent.mouseUp(svg, { clientX: 100, clientY: 200 })

  // swap が発火 → tasks の構造変化 → onSave が呼ばれる
  expect(onSave).toHaveBeenCalled()
})
```

- [ ] **Step 2: テストを実行して PASS を確認**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "しきい値超え"
```

Expected: PASS。

> もし FAIL する場合、レイアウト前提（`clientY=200` で row 1 にクランプされる）を再確認。`clientY = TM + HH + RH = 24 + 46 + 84 = 154` 以上で row 1。240 にすれば確実。

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#347): add positive case for drag activation threshold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 累積移動でしきい値を超えるとゲート通過するテスト

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

`activated` フラグの不可逆性（一度 true になったら同じドラッグ中はずっと true）を保証。

- [ ] **Step 1: テストを追記**

`describe('ノードドラッグの activation distance (#347)', ...)` 内に追加:

```tsx
it('累積で 6px を超えた時点で gate が通過する', () => {
  const onSave = vi.fn()
  const { container } = render(
    <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
  )
  const rects = findNodeRects(container)
  const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

  // 3px の小さな move（gate 未達）の後、さらに大きく動かす。
  // 最終位置は mousedown 位置から十分離れているため累計 distance は明確に 6 超え。
  fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
  fireEvent.mouseMove(svg, { clientX: 100, clientY: 68 }) // 距離 3 → gate ブロック
  fireEvent.mouseMove(svg, { clientX: 100, clientY: 200 }) // 距離 135 → gate 通過
  fireEvent.mouseUp(svg, { clientX: 100, clientY: 200 })

  expect(onSave).toHaveBeenCalled()
})
```

- [ ] **Step 2: テストを実行**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "累積で 6px"
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#347): verify cumulative movement crosses activation threshold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 対角方向 (Euclidean) のしきい値判定テスト

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

軸別ではなくユークリッド円形しきい値であることを保証。

- [ ] **Step 1: テストを追記**

`describe('ノードドラッグの activation distance (#347)', ...)` 内に追加:

```tsx
it('対角方向の move は Euclidean 距離で評価される', () => {
  // dx=5, dy=5 → 距離 √50 ≈ 7.07 > 6 → gate 通過
  const onSave = vi.fn()
  const { container } = render(
    <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
  )
  const rects = findNodeRects(container)
  const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

  // 軸単位ではどちらも 5px だが Euclidean では √50 ≈ 7.07 > 6。
  // mousedown は row 0、移動先は row 1 寄り（clientY=70 で行 1 にクランプ）。
  fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
  fireEvent.mouseMove(svg, { clientX: 105, clientY: 70 }) // dx=5, dy=5
  fireEvent.mouseUp(svg, { clientX: 105, clientY: 70 })

  expect(onSave).toHaveBeenCalled()
})
```

- [ ] **Step 2: テストを実行**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "対角方向"
```

Expected: PASS。

> もし `clientY=70` で row 0 のままになる場合（`Math.floor((70-70)/84)=0`）、`clientY=71` に調整。dx=5, dy=6 → √61 ≈ 7.81 で同じく gate 通過。

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#347): verify Euclidean (not per-axis) distance evaluation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: マルチドラッグでも同じしきい値が適用されるテスト

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

`onSvgMouseMove` で gate を `dragging.multi` 分岐の前に置いたため、multi でも同じ閾値が効くことを確認。

- [ ] **Step 1: 抑止テスト（5px 未満は移動しない）を追記**

```tsx
it('マルチドラッグでも 5px 未満の move では位置変更が発火しない', () => {
  const onSave = vi.fn()
  const { container } = render(
    <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
  )
  const rects = findNodeRects(container)
  const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

  // Shift+click で 2 ノードを multi-select。onSave は呼ばれない（multiSel は struct ではない）。
  fireEvent.click(rects[0], { shiftKey: true })
  fireEvent.click(rects[1], { shiftKey: true })

  // multi-select 中の rect[0] をドラッグ開始（multi 経路）。
  // ここからの mousedown/mousemove/mouseup は gate でブロックされるはず。
  onSave.mockClear()
  fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
  fireEvent.mouseMove(svg, { clientX: 100, clientY: 70 }) // 5px
  fireEvent.mouseUp(svg, { clientX: 100, clientY: 70 })

  expect(onSave).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 通過テスト（6px 超えで移動発火）を追記**

```tsx
it('マルチドラッグでも 6px 以上の move で位置変更が発火する', () => {
  const onSave = vi.fn()
  const { container } = render(
    <FlowEditor flow={createFlowWith2VerticalNodes()} onSave={onSave} saveStatus="saved" />,
  )
  const rects = findNodeRects(container)
  const svg = container.querySelector('[data-testid="canvas-svg"]') as SVGSVGElement

  fireEvent.click(rects[0], { shiftKey: true })
  fireEvent.click(rects[1], { shiftKey: true })

  onSave.mockClear()
  // multi で 84px 下に移動 (RH 分) → gate 通過 → cellFromPos が別行を返す
  fireEvent.mouseDown(rects[0], { clientX: 100, clientY: 65 })
  fireEvent.mouseMove(svg, { clientX: 100, clientY: 200 })
  fireEvent.mouseUp(svg, { clientX: 100, clientY: 200 })

  expect(onSave).toHaveBeenCalled()
})
```

- [ ] **Step 3: 両テストを実行**

Run:

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx -t "マルチドラッグでも"
```

Expected: 両方 PASS。

> もし通過テストが FAIL する場合、multi-drag の `calcMultiDropTargets` が「全選択ノードが空セルに収まる必要がある」等の制約を持つ可能性あり。その場合は単体ドラッグの正常系テストと同等の信頼性を担保する目的で「`onSave` が呼ばれない」だけを抑止テストとして残し、通過テストは Playwright 検証に委ねる（実装の正しさは Task 1 で実装本体を完成させた時点で担保済み）。具体的な失敗内容を分析してから判断する。

- [ ] **Step 4: Commit**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#347): verify activation threshold applies to multi-drag

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 既存テストへの影響確認

**Files:** (確認のみ、変更が必要な場合は対応)

事前調査では既存に「ドラッグ swap を期待するテスト」は存在しないが、念のため確認する。

- [ ] **Step 1: 既存のドラッグ関連テストを検索**

Run:

```bash
grep -n "fireEvent\.mouseMove\|fireEvent\.mouseDown\|onDragStart\|setDragging" src/features/editor/FlowEditor.test.tsx
```

期待: Task 1〜5 で追加した箇所と、既存の `should not start drag when Shift+mouseDown on node (#88)` のみが出てくる。

- [ ] **Step 2: もし追加で「swap を期待する既存テスト」が見つかった場合**

- `mouseMove` の引数を 6px 以上動くよう調整 (`clientY=68` → `clientY=200` 等)
- それ以外のテストはそのまま

調整が必要なら個別に commit する。なければスキップ。

- [ ] **Step 3: 全テスト・lint・型チェックを実行**

```bash
npm test -- --run
npx tsc --noEmit
npm run lint 2>/dev/null || true
```

Expected: 全 PASS。

---

## Task 7: 実画面検証 (Playwright)

**Files:** (検証のみ)

ユーザ受け入れ条件 #7（実画面で縦並びノードのクリック微小ブレで順序維持）を確認する。

- [ ] **Step 1: dev サーバを起動**

```bash
npm run dev
```

別ターミナル/バックグラウンドで起動し、表示 URL を控える。

- [ ] **Step 2: Playwright で操作確認**

ログインは `.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` を使用。

シナリオ:

1. ログインしてフローエディタを開く（既存の任意のフローか新規作成）。
2. 同一レーン内に縦に並ぶノードを 2 つ以上配置。
3. いずれかのノードをクリックして 1〜3mm 程度ブレさせて mouseUp する。
4. **期待:** 順序が入れ替わらない（バッジ番号や DOM 順序が維持される）。
5. 次に、はっきりとドラッグして隣セルに移動 → mouseUp。
6. **期待:** 従来通り swap または move が発火する。

スクリーンショットを `.screenshots/` 下に保存（必要に応じて）。

- [ ] **Step 3: LCP 確認**

`~/.claude/CLAUDE.md` のワークフロー Step 6 に従い、エディタ画面の LCP が 1 秒以内であることを確認。chrome-devtools の Performance タブまたは Playwright の `page.evaluate(() => performance.getEntriesByType('largest-contentful-paint'))` で計測。

LCP 超過時はパフォーマンス改善を行ってから次へ。

- [ ] **Step 4: dev サーバを停止**

---

## Task 8: 最新 main 同期 → push → PR 作成

**Files:** (オペレーションのみ)

ワークフロー Step 7〜8 に従う。

- [ ] **Step 1: 最新 main を rebase**

```bash
git pull origin main --rebase
npm test -- --run
```

衝突や test 失敗があれば修正してから進む。

- [ ] **Step 2: push & PR 作成**

```bash
git push -u origin fix/issue-347-drag-activation-distance
gh pr create --title "fix(#347): ノードドラッグに 6px の activation distance を導入" --body "$(cat <<'EOF'
## Summary
- ノードドラッグに 6px の activation distance を導入し、mousedown 後の微小な手ブレで意図せず順序が入れ替わる誤操作を防止
- `DragState` 拡張 (`startClientX`/`startClientY`/`activated`)、`onDragStart` で screen 座標捕捉、`onSvgMouseMove` 冒頭に Euclidean しきい値ゲート追加
- single/multi ドラッグ両方に同じゲートを適用

Closes #347

## Spec / Plan
- Spec: `docs/superpowers/specs/2026-05-22-drag-activation-distance-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-drag-activation-distance-plan.md`

## Test plan
- [x] `FlowEditor.test.tsx` に追加: 5px 未達で swap しない / 6px 超で swap / 累積 / 対角 (Euclidean) / multi
- [x] `npm test` 全 pass
- [x] Playwright で縦並びノードのクリック微小ブレ → 順序維持を確認
- [x] LCP < 1s を維持

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI 待機**

```bash
gh pr checks --watch
```

全 pass 後にレビュー依頼コメント:

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 4: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` を参照して本番ビルドのローカル確認を行う。

- [ ] **Step 5: レビュー反映ループ → merge → deploy 確認 → worktree クリーンアップ**

`~/.claude/CLAUDE.md` のワークフロー Step 9〜11 に従う。Issue #347 を close。

---

## Self-Review チェック（実装者向けではなく計画作成者によるセルフレビュー）

✅ **Spec coverage:**

- 受け入れ条件 #1 (微小ブレで順序維持) → Task 1
- #2 (6px 超で従来通り swap) → Task 2
- #3 (zoom 非依存) → Task 1 で `clientX/Y` を使用、設計レベルで保証
- #4 (multi も同じ閾値) → Task 5
- #5 (taskClick 影響なし) → 設計上 onClick 経路は不変、Task 6 で既存テストへの影響を確認
- #6 (`npm test` 全 pass) → Task 1 Step 9 / Task 6 Step 3
- #7 (Playwright 検証) → Task 7

✅ **Placeholder scan:** "TBD" / "TODO" / "後で" / 未確定要素なし。`grep` した範囲内に該当なし。

✅ **Type consistency:** `DragState` の追加フィールド名 (`startClientX`/`startClientY`/`activated`) と `DRAG_ACTIVATION_DISTANCE` 定数名は Task 1〜5 で一貫使用。
