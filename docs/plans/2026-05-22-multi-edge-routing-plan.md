# マルチエッジ協調ルーティング 段階1 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ルーティング済みエッジのセグメントを後続エッジの障害物に昇格させることで、複数エッジ間の混線を解消する。

**Architecture:** `buildArrowPath` の各分岐で SVG `d` 文字列と並走して `EdgeSegment[]` を構築。新規ヘルパー `routeAllArrows` が呼び出し側で segments を Map に累積し、共有ノード除外フィルタを経由して obstacles に注入。既存の検出ロジック（`detectDetour` / `detectVerticalDetour` / `detectDiagonalDetour`）は変更しない。

**Tech Stack:** TypeScript, React, vitest, Playwright

**Design Doc:** `docs/plans/2026-05-22-multi-edge-routing-design.md`

---

## File Structure

### Modify

- `src/lib/types.ts` — `ArrowPathResult` に `segments: EdgeSegment[]` 追加
- `src/lib/arrow-routing.ts` — `EdgeSegment` 型・`segmentsToBboxes`・`buildArrowPath` の各分岐で segments 構築
- `src/lib/arrow-routing.test.ts` — segments 出力の網羅テスト追加（既存テストは破壊しない）
- `src/features/editor/FlowEditor.tsx:1424` — `aPath` を `routeAllArrows` 呼び出しに置換
- `src/features/shared/SharedFlowViewer.tsx:114` — `computeArrowPath` ループを `routeAllArrows` 呼び出しに置換

### Create

- `src/features/editor/edge-router.ts` — `routeAllArrows` ヘルパー
- `src/features/editor/edge-router.test.ts` — マルチエッジ協調シナリオの新規テスト
- `src/features/editor/edge-router.bench.ts` — パフォーマンスベンチマーク（vitest bench）
- `e2e/edge-routing-multi-edge.spec.ts` — Playwright 視覚検証

---

## Task 1: GitHub Issue 作成 + ワークツリー準備

**Files:**

- Create: `.worktrees/multi-edge-routing/`

- [ ] **Step 1: ローカル main 最新化**

Run:

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

Expected: main が origin/main と一致。失敗時は人間に報告して中断。

- [ ] **Step 2: GitHub Issue 作成**

Run:

```bash
gh issue create --title "マルチエッジ協調ルーティング 段階1（エッジを障害物に昇格）" \
  --body "$(cat <<'EOF'
## 背景
複数エッジが同じ通路に集中すると混線する。各エッジが他のエッジを認識しない単一エッジルータのため。

## 対応
- arrow-routing.ts の検出ロジックは変更せず、obstacles にエッジセグメントを混ぜる
- 共有ノード除外、ストレージ id 順による決定論性、3 種類の検出すべてに適用

## 設計ドキュメント
docs/plans/2026-05-22-multi-edge-routing-design.md

## 実装プラン
docs/plans/2026-05-22-multi-edge-routing-plan.md
EOF
)" --label "作業開始"
```

Expected: Issue 番号が出力される。番号を控えて以降の commit message で参照。

- [ ] **Step 3: ワークツリー作成**

Run:

```bash
ISSUE_NUM=<上記で得た Issue 番号>
git worktree add .worktrees/multi-edge-routing -b feat/multi-edge-routing-stage1-issue-$ISSUE_NUM
cd .worktrees/multi-edge-routing
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

Expected: ワークツリーが作成され、.env がシンボリックリンクされる。

- [ ] **Step 4: 依存パッケージ確認**

Run:

```bash
npm install
```

Expected: 既存の node_modules がそのまま使える（ワークツリーで共有）または再インストール完了。

---

## Task 2: EdgeSegment 型追加 + 型拡張

**Files:**

- Modify: `src/lib/arrow-routing.ts:1-13` (型定義エリア)
- Modify: `src/lib/types.ts:19-24`

- [ ] **Step 1: `EdgeSegment` 型を `arrow-routing.ts` に追加**

Edit `src/lib/arrow-routing.ts` の先頭、既存の `Bbox` インターフェース直後に追加：

```ts
export interface EdgeSegment {
  orientation: 'h' | 'v'
  fixed: number
  range: [number, number]
}
```

`Bbox` の直後（行 13 の `}` の次）に挿入。

- [ ] **Step 2: `ArrowPath` インターフェースに `segments` を追加**

`arrow-routing.ts` 内の `ArrowPath` 型定義を見つけて拡張。grep で見つける：

```bash
grep -n "interface ArrowPath" src/lib/arrow-routing.ts
```

該当箇所に `segments: EdgeSegment[]` フィールドを追加：

```ts
export interface ArrowPath {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[]
}
```

- [ ] **Step 3: `ArrowPathResult` を `types.ts` で拡張**

Edit `src/lib/types.ts:19-24`:

```ts
import type { EdgeSegment } from './arrow-routing'

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[]
}
```

- [ ] **Step 4: TypeScript コンパイル確認**

Run:

```bash
npx tsc --noEmit
```

Expected: `buildArrowPath` 内で `segments` を返していないため、 TS エラーが出る。これは想定通り。次のタスクで解消する。

- [ ] **Step 5: 一旦コミット保留**

このタスクは Task 3 以降と一緒にコミット（中途半端な状態で commit するとビルドが通らないため）。

---

## Task 3: `segmentsToBboxes` ヘルパー実装（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts` (末尾に追加)
- Modify: `src/lib/arrow-routing.test.ts` (末尾に追加)

- [ ] **Step 1: 失敗するテストを書く**

Edit `src/lib/arrow-routing.test.ts` の末尾に追加：

```ts
import { segmentsToBboxes } from './arrow-routing'
import type { EdgeSegment } from './arrow-routing'

describe('segmentsToBboxes', () => {
  it('converts horizontal segment to thin Bbox with h=1', () => {
    const segs: EdgeSegment[] = [{ orientation: 'h', fixed: 100, range: [50, 200] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 125, y: 100, w: 150, h: 1 }])
  })

  it('converts vertical segment to thin Bbox with w=1', () => {
    const segs: EdgeSegment[] = [{ orientation: 'v', fixed: 100, range: [50, 200] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 100, y: 125, w: 1, h: 150 }])
  })

  it('handles negative range (max < min) by taking absolute width', () => {
    const segs: EdgeSegment[] = [{ orientation: 'h', fixed: 100, range: [200, 50] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 125, y: 100, w: 150, h: 1 }])
  })

  it('converts empty array to empty array', () => {
    expect(segmentsToBboxes([])).toEqual([])
  })

  it('converts multiple mixed orientations', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 0, range: [0, 100] },
      { orientation: 'v', fixed: 100, range: [0, 50] },
    ]
    expect(segmentsToBboxes(segs)).toEqual([
      { x: 50, y: 0, w: 100, h: 1 },
      { x: 100, y: 25, w: 1, h: 50 },
    ])
  })
})
```

- [ ] **Step 2: テストを実行して失敗確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "segmentsToBboxes"
```

Expected: FAIL with "segmentsToBboxes is not a function" または import エラー。

- [ ] **Step 3: 最小実装を追加**

Edit `src/lib/arrow-routing.ts` の末尾（`buildObstacles` の直後）に追加：

```ts
export function segmentsToBboxes(segments: EdgeSegment[]): Bbox[] {
  return segments.map((s) => {
    const r0 = Math.min(s.range[0], s.range[1])
    const r1 = Math.max(s.range[0], s.range[1])
    const len = r1 - r0
    return s.orientation === 'h'
      ? { x: (r0 + r1) / 2, y: s.fixed, w: len, h: 1 }
      : { x: s.fixed, y: (r0 + r1) / 2, w: 1, h: len }
  })
}
```

- [ ] **Step 4: テストを実行して pass 確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "segmentsToBboxes"
```

Expected: PASS（5 件すべて）。

- [ ] **Step 5: コミット保留**

Task 4 と一緒にコミット。

---

## Task 4: `buildArrowPath` 直線・L字パスで segments 出力（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts:532-583` (直線・L字・Z字パス分岐)
- Modify: `src/lib/arrow-routing.test.ts` (segments 出力テスト追加)

対象分岐:

1. 直線パス (line 538, `M${s.x},${s.y} L${e.x},${e.y}`)
2. L字 縦出→横入 (line 560, `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`)
3. L字 横出→縦入 (line 572, `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`)

- [ ] **Step 1: 失敗するテストを書く**

Edit `src/lib/arrow-routing.test.ts` の末尾に追加：

```ts
describe('buildArrowPath segments — straight & L-shape', () => {
  it('straight horizontal: 1 horizontal segment', () => {
    const result = buildArrowPath(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    )
    expect(result.segments).toEqual([{ orientation: 'h', fixed: 100, range: [0, 200] }])
  })

  it('straight vertical: 1 vertical segment', () => {
    const result = buildArrowPath(
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    )
    expect(result.segments).toEqual([{ orientation: 'v', fixed: 100, range: [0, 200] }])
  })

  it('L-shape (vertical exit → horizontal entry): vertical then horizontal', () => {
    // fc に対して s が縦方向（y 差 > x 差）、tc に対して e が横方向（x 差 > y 差）
    const result = buildArrowPath(
      { x: 100, y: 50 }, // s: 縦に出る
      { x: 250, y: 200 }, // e: 横から入る
      { x: 100, y: 0 }, // fc: 上に中心
      { x: 300, y: 200 }, // tc: 右に中心
    )
    expect(result.segments).toEqual([
      { orientation: 'v', fixed: 100, range: [50, 200] },
      { orientation: 'h', fixed: 200, range: [100, 250] },
    ])
  })

  it('L-shape (horizontal exit → vertical entry): horizontal then vertical', () => {
    const result = buildArrowPath(
      { x: 50, y: 100 }, // s: 横に出る
      { x: 200, y: 250 }, // e: 縦から入る
      { x: 0, y: 100 }, // fc: 左に中心
      { x: 200, y: 300 }, // tc: 下に中心
    )
    expect(result.segments).toEqual([
      { orientation: 'h', fixed: 100, range: [50, 200] },
      { orientation: 'v', fixed: 200, range: [100, 250] },
    ])
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — straight"
```

Expected: FAIL (`result.segments` が undefined または期待値と不一致)。

- [ ] **Step 3: 実装 — 直線パス分岐 (line 538)**

Edit `src/lib/arrow-routing.ts:537-540`:

```ts
// 直線パス: ほぼ垂直またはほぼ水平
if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
  d = `M${s.x},${s.y} L${e.x},${e.y}`
  mx = (s.x + e.x) / 2
  my = (s.y + e.y) / 2
  // segments: ほぼ垂直なら垂直、ほぼ水平なら水平
  if (Math.abs(dx) < 2) {
    segments = [{ orientation: 'v', fixed: s.x, range: [Math.min(s.y, e.y), Math.max(s.y, e.y)] }]
  } else {
    segments = [{ orientation: 'h', fixed: s.y, range: [Math.min(s.x, e.x), Math.max(s.x, e.x)] }]
  }
}
```

`segments` 変数を関数冒頭で宣言する必要があるので、`let d, mx, my` 付近に `let segments: EdgeSegment[]` を追加。

- [ ] **Step 4: 実装 — L字 縦出→横入 (line 558-569)**

Edit `src/lib/arrow-routing.ts:558-569`:

```ts
    } else if (sV) {
      // 縦出口→横入口: L字パス → ラベルは長辺の中点
      d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
      segments = [
        { orientation: 'v', fixed: s.x, range: [Math.min(s.y, e.y), Math.max(s.y, e.y)] },
        { orientation: 'h', fixed: e.y, range: [Math.min(s.x, e.x), Math.max(s.x, e.x)] },
      ]
      if (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)) {
        mx = s.x
        my = (s.y + e.y) / 2
      } else {
        mx = (s.x + e.x) / 2
        my = e.y
      }
    }
```

- [ ] **Step 5: 実装 — L字 横出→縦入 (line 570-582)**

Edit `src/lib/arrow-routing.ts:570-582`:

```ts
    } else {
      // 横出口→縦入口: L字パス → ラベルは長辺の中点
      d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
      segments = [
        { orientation: 'h', fixed: s.y, range: [Math.min(s.x, e.x), Math.max(s.x, e.x)] },
        { orientation: 'v', fixed: e.x, range: [Math.min(s.y, e.y), Math.max(s.y, e.y)] },
      ]
      if (Math.abs(e.x - s.x) >= Math.abs(e.y - s.y)) {
        mx = (s.x + e.x) / 2
        my = s.y
      } else {
        mx = e.x
        my = (s.y + e.y) / 2
      }
    }
```

- [ ] **Step 6: テストを pass まで確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — straight"
```

Expected: PASS（4 件）。

- [ ] **Step 7: コミット保留**

Task 5/6/7 と合わせてコミット（buildArrowPath の改修は一気に終わらせる）。

---

## Task 5: `buildArrowPath` Z字パスで segments 出力（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts:546-557` (Z字分岐)
- Modify: `src/lib/arrow-routing.test.ts` (segments テスト追加)

対象分岐:

1. Z字 両縦出口 (line 549, `M L L L L`)
2. Z字 両横出口 (line 555, `M L L L L`)

- [ ] **Step 1: 失敗するテストを書く**

Edit `src/lib/arrow-routing.test.ts` の末尾に追加：

```ts
describe('buildArrowPath segments — Z-shape', () => {
  it('Z-shape (both vertical exits): vert, horiz, vert', () => {
    const result = buildArrowPath(
      { x: 100, y: 50 }, // s: 縦に出る
      { x: 300, y: 250 }, // e: 縦に入る
      { x: 100, y: 0 }, // fc: 上に中心
      { x: 300, y: 300 }, // tc: 下に中心
    )
    // cmy = (50 + 250) / 2 = 150
    expect(result.segments).toEqual([
      { orientation: 'v', fixed: 100, range: [50, 150] },
      { orientation: 'h', fixed: 150, range: [100, 300] },
      { orientation: 'v', fixed: 300, range: [150, 250] },
    ])
  })

  it('Z-shape (both horizontal exits): horiz, vert, horiz', () => {
    const result = buildArrowPath(
      { x: 50, y: 100 }, // s: 横に出る
      { x: 250, y: 300 }, // e: 横に入る
      { x: 0, y: 100 }, // fc: 左に中心
      { x: 300, y: 300 }, // tc: 右に中心
    )
    // cmx = (50 + 250) / 2 = 150
    expect(result.segments).toEqual([
      { orientation: 'h', fixed: 100, range: [50, 150] },
      { orientation: 'v', fixed: 150, range: [100, 300] },
      { orientation: 'h', fixed: 300, range: [150, 250] },
    ])
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — Z-shape"
```

Expected: FAIL.

- [ ] **Step 3: 実装 — Z字 両縦出口 (line 546-552)**

Edit `src/lib/arrow-routing.ts:546-552`:

```ts
if (sV && eV) {
  // 両方縦出口: Z字パス（横方向に折り返す）→ ラベルは中央水平セグメント上
  const cmy = (s.y + e.y) / 2
  d = `M${s.x},${s.y} L${s.x},${cmy} L${e.x},${cmy} L${e.x},${e.y}`
  segments = [
    { orientation: 'v', fixed: s.x, range: [Math.min(s.y, cmy), Math.max(s.y, cmy)] },
    { orientation: 'h', fixed: cmy, range: [Math.min(s.x, e.x), Math.max(s.x, e.x)] },
    { orientation: 'v', fixed: e.x, range: [Math.min(cmy, e.y), Math.max(cmy, e.y)] },
  ]
  mx = (s.x + e.x) / 2
  my = cmy
}
```

- [ ] **Step 4: 実装 — Z字 両横出口 (line 552-557)**

Edit `src/lib/arrow-routing.ts:552-557`:

```ts
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）→ ラベルは中央垂直セグメント上
      const cmx = (s.x + e.x) / 2
      d = `M${s.x},${s.y} L${cmx},${s.y} L${cmx},${e.y} L${e.x},${e.y}`
      segments = [
        { orientation: 'h', fixed: s.y, range: [Math.min(s.x, cmx), Math.max(s.x, cmx)] },
        { orientation: 'v', fixed: cmx, range: [Math.min(s.y, e.y), Math.max(s.y, e.y)] },
        { orientation: 'h', fixed: e.y, range: [Math.min(cmx, e.x), Math.max(cmx, e.x)] },
      ]
      mx = cmx
      my = (s.y + e.y) / 2
    }
```

- [ ] **Step 5: テストを pass まで確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — Z-shape"
```

Expected: PASS。

---

## Task 6: `buildArrowPath` 水平・垂直迂回で segments 出力（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts:465-497` (水平・垂直迂回)
- Modify: `src/lib/arrow-routing.test.ts`

対象分岐:

1. 水平迂回 6 セグ (line 479)
2. 垂直迂回 6 セグ (line 495)

- [ ] **Step 1: 失敗するテストを書く**

Edit `src/lib/arrow-routing.test.ts` の末尾に追加：

```ts
describe('buildArrowPath segments — horizontal/vertical detour', () => {
  it('horizontal detour: 5 segments alternating h/v/h/v/h', () => {
    // s と e が同一行で間にノード障害物がある場合
    const obstacles: Bbox[] = [{ x: 150, y: 100, w: 40, h: 40 }] // 障害ノード
    const result = buildArrowPath(
      { x: 50, y: 100 },
      { x: 250, y: 100 },
      { x: 50, y: 100 },
      { x: 250, y: 100 },
      obstacles,
    )
    // 期待: 始点 → departX (s.x + DEPART_GAP=14) で水平、その後迂回 Y まで垂直、approachX (e.x - 14) で水平、e.y まで垂直、e.x へ水平
    // detourY = 障害ノード下端 + DETOUR_MARGIN = 100 + 20 + 14 = 134
    expect(result.segments).toHaveLength(5)
    expect(result.segments[0].orientation).toBe('h')
    expect(result.segments[1].orientation).toBe('v')
    expect(result.segments[2].orientation).toBe('h')
    expect(result.segments[3].orientation).toBe('v')
    expect(result.segments[4].orientation).toBe('h')
    // 中央水平セグメントが detourY 上
    expect(result.segments[2].fixed).toBe(134)
  })

  it('vertical detour: 5 segments alternating v/h/v/h/v', () => {
    const obstacles: Bbox[] = [{ x: 100, y: 150, w: 40, h: 40 }]
    const result = buildArrowPath(
      { x: 100, y: 50 },
      { x: 100, y: 250 },
      { x: 100, y: 50 },
      { x: 100, y: 250 },
      obstacles,
    )
    expect(result.segments).toHaveLength(5)
    expect(result.segments[0].orientation).toBe('v')
    expect(result.segments[1].orientation).toBe('h')
    expect(result.segments[2].orientation).toBe('v')
    expect(result.segments[3].orientation).toBe('h')
    expect(result.segments[4].orientation).toBe('v')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — horizontal/vertical detour"
```

Expected: FAIL.

- [ ] **Step 3: 実装 — 水平迂回 (line 466-481)**

Edit `src/lib/arrow-routing.ts:466-481`:

```ts
const detour = detectDetour(s, e, obstacles)
if (detour) {
  const { detourY } = detour
  const sign = Math.sign(dx)
  const halfDx = Math.abs(dx) / 2
  const departX = s.x + sign * Math.min(DEPART_GAP, halfDx)
  const approachX = e.x - sign * Math.min(APPROACH_GAP, halfDx)
  const d = `M${s.x},${s.y} L${departX},${s.y} L${departX},${detourY} L${approachX},${detourY} L${approachX},${e.y} L${e.x},${e.y}`
  const segments: EdgeSegment[] = [
    { orientation: 'h', fixed: s.y, range: [Math.min(s.x, departX), Math.max(s.x, departX)] },
    { orientation: 'v', fixed: departX, range: [Math.min(s.y, detourY), Math.max(s.y, detourY)] },
    {
      orientation: 'h',
      fixed: detourY,
      range: [Math.min(departX, approachX), Math.max(departX, approachX)],
    },
    { orientation: 'v', fixed: approachX, range: [Math.min(detourY, e.y), Math.max(detourY, e.y)] },
    { orientation: 'h', fixed: e.y, range: [Math.min(approachX, e.x), Math.max(approachX, e.x)] },
  ]
  return { d, mx: (s.x + e.x) / 2, my: detourY, segments }
}
```

- [ ] **Step 4: 実装 — 垂直迂回 (line 483-497)**

Edit `src/lib/arrow-routing.ts:483-497`:

```ts
const vDetour = detectVerticalDetour(s, e, obstacles)
if (vDetour) {
  const { detourX } = vDetour
  const sign = Math.sign(dy)
  const halfDy = Math.abs(dy) / 2
  const departY = s.y + sign * Math.min(DEPART_GAP, halfDy)
  const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
  const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
  const segments: EdgeSegment[] = [
    { orientation: 'v', fixed: s.x, range: [Math.min(s.y, departY), Math.max(s.y, departY)] },
    { orientation: 'h', fixed: departY, range: [Math.min(s.x, detourX), Math.max(s.x, detourX)] },
    {
      orientation: 'v',
      fixed: detourX,
      range: [Math.min(departY, approachY), Math.max(departY, approachY)],
    },
    { orientation: 'h', fixed: approachY, range: [Math.min(detourX, e.x), Math.max(detourX, e.x)] },
    { orientation: 'v', fixed: e.x, range: [Math.min(approachY, e.y), Math.max(approachY, e.y)] },
  ]
  return { d, mx: detourX, my: (s.y + e.y) / 2, segments }
}
```

- [ ] **Step 5: テストを pass まで確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — horizontal/vertical detour"
```

Expected: PASS。

---

## Task 7: `buildArrowPath` 斜め迂回 4 種で segments 出力（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts:499-529` (斜め迂回 switch 文)
- Modify: `src/lib/arrow-routing.test.ts`

対象分岐:

1. `target-detour` (line 504, 5 segments)
2. `source-detour` (line 509, 5 segments)
3. `both-detour` (line 514, 7 segments)
4. `shift-my` (line 519, 3 segments)

- [ ] **Step 1: 既存テストデータから 4 kind の発生座標を抽出**

Run:

```bash
grep -n "'target-detour'\|'source-detour'\|'both-detour'\|'shift-my'" src/lib/arrow-routing.test.ts | head -20
```

Expected: 4 kind それぞれを発生させる既存テストの位置が出力される。各位置の近傍にある `detectDiagonalDetour(s, e, obstacles)` 呼び出しの引数（s, e, obstacles）を 1 ケースずつ抜き出して、次の Step のテスト座標に流用する。

- [ ] **Step 2: 失敗するテストを書く（shift-my を完全実装、他 3 kind は同じパターン）**

Edit `src/lib/arrow-routing.test.ts` の末尾に追加：

```ts
describe('buildArrowPath segments — diagonal detour', () => {
  // shift-my を発生させる典型ケース（s と e が斜め配置 + 障害物による my シフト）
  // ※ Step 1 で抽出した既存テスト座標で他 3 kind も同様に追加すること
  it('shift-my: v, h, v (3 segments)', () => {
    // Step 1 の抽出結果から得た shift-my を発生させる s/e/obstacles を以下に貼る
    // 例: const s = { x: 100, y: 100 }; const e = { x: 200, y: 200 }; const obstacles = [...]
    // (このプランのコミット時点では実値が確定していないため、Step 1 の結果で置き換える)
    const s = { x: 100, y: 100 }
    const e = { x: 200, y: 200 }
    const obstacles: Bbox[] = [
      /* Step 1 の抽出結果から */
    ]
    const result = buildArrowPath(s, e, s, e, obstacles)
    // shift-my の d 文字列: M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0].orientation).toBe('v')
    expect(result.segments[1].orientation).toBe('h')
    expect(result.segments[2].orientation).toBe('v')
    // 中間 my セグメントの fixed が d の中央 L の y と一致すること
    const myFromD = parseFloat(result.d.split('L')[1].split(',')[1])
    expect(result.segments[1].fixed).toBe(myFromD)
  })

  it('target-detour: v, h, v, h, v (5 segments)', () => {
    // Step 1 で抽出した target-detour 座標を貼って同様の構造 assert
    // 期待 orientation 列: ['v', 'h', 'v', 'h', 'v']
    // 実装着手時に座標を埋める
  })

  it('source-detour: v, h, v, h, v (5 segments)', () => {
    // 同上、source-detour 用
    // 期待 orientation 列: ['v', 'h', 'v', 'h', 'v']
  })

  it('both-detour: v, h, v, h, v, h, v (7 segments)', () => {
    // 同上、both-detour 用
    // 期待 orientation 列: ['v', 'h', 'v', 'h', 'v', 'h', 'v']
  })
})
```

**注意**: 4 つの it は構造が同じ。Step 1 で抽出した座標を貼ったら orientation 列の assert はテンプレ通り。target/source/both は 5/5/7 セグメント、shift-my は 3 セグメント。

- [ ] **Step 3: テスト失敗を確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts -t "buildArrowPath segments — diagonal detour"
```

Expected: FAIL（`result.segments` が undefined）。

- [ ] **Step 5: 実装 — target-detour (line 502-506)**

Edit `src/lib/arrow-routing.ts:502-506`:

```ts
        case 'target-detour': {
          const { my, detourX, approachY } = dDetour
          const d = `M${s.x},${s.y} L${s.x},${my} L${detourX},${my} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [Math.min(s.y, my), Math.max(s.y, my)] },
            { orientation: 'h', fixed: my, range: [Math.min(s.x, detourX), Math.max(s.x, detourX)] },
            { orientation: 'v', fixed: detourX, range: [Math.min(my, approachY), Math.max(my, approachY)] },
            { orientation: 'h', fixed: approachY, range: [Math.min(detourX, e.x), Math.max(detourX, e.x)] },
            { orientation: 'v', fixed: e.x, range: [Math.min(approachY, e.y), Math.max(approachY, e.y)] },
          ]
          return { d, mx: (s.x + detourX) / 2, my, segments }
        }
```

- [ ] **Step 6: 実装 — source-detour (line 507-511)**

Edit `src/lib/arrow-routing.ts:507-511`:

```ts
        case 'source-detour': {
          const { departY, detourX, my } = dDetour
          const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${my} L${e.x},${my} L${e.x},${e.y}`
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [Math.min(s.y, departY), Math.max(s.y, departY)] },
            { orientation: 'h', fixed: departY, range: [Math.min(s.x, detourX), Math.max(s.x, detourX)] },
            { orientation: 'v', fixed: detourX, range: [Math.min(departY, my), Math.max(departY, my)] },
            { orientation: 'h', fixed: my, range: [Math.min(detourX, e.x), Math.max(detourX, e.x)] },
            { orientation: 'v', fixed: e.x, range: [Math.min(my, e.y), Math.max(my, e.y)] },
          ]
          return { d, mx: (detourX + e.x) / 2, my, segments }
        }
```

- [ ] **Step 7: 実装 — both-detour (line 512-516)**

Edit `src/lib/arrow-routing.ts:512-516`:

```ts
        case 'both-detour': {
          const { departY, sourceDetourX, my, targetDetourX, approachY } = dDetour
          const d = `M${s.x},${s.y} L${s.x},${departY} L${sourceDetourX},${departY} L${sourceDetourX},${my} L${targetDetourX},${my} L${targetDetourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [Math.min(s.y, departY), Math.max(s.y, departY)] },
            { orientation: 'h', fixed: departY, range: [Math.min(s.x, sourceDetourX), Math.max(s.x, sourceDetourX)] },
            { orientation: 'v', fixed: sourceDetourX, range: [Math.min(departY, my), Math.max(departY, my)] },
            { orientation: 'h', fixed: my, range: [Math.min(sourceDetourX, targetDetourX), Math.max(sourceDetourX, targetDetourX)] },
            { orientation: 'v', fixed: targetDetourX, range: [Math.min(my, approachY), Math.max(my, approachY)] },
            { orientation: 'h', fixed: approachY, range: [Math.min(targetDetourX, e.x), Math.max(targetDetourX, e.x)] },
            { orientation: 'v', fixed: e.x, range: [Math.min(approachY, e.y), Math.max(approachY, e.y)] },
          ]
          return { d, mx: (sourceDetourX + targetDetourX) / 2, my, segments }
        }
```

- [ ] **Step 8: 実装 — shift-my (line 517-521)**

Edit `src/lib/arrow-routing.ts:517-521`:

```ts
        case 'shift-my': {
          const { my } = dDetour
          const d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [Math.min(s.y, my), Math.max(s.y, my)] },
            { orientation: 'h', fixed: my, range: [Math.min(s.x, e.x), Math.max(s.x, e.x)] },
            { orientation: 'v', fixed: e.x, range: [Math.min(my, e.y), Math.max(my, e.y)] },
          ]
          return { d, mx: (s.x + e.x) / 2, my, segments }
        }
```

- [ ] **Step 9: 最後の return 文を修正**

`buildArrowPath` の最終 `return { d, mx, my }` (line 584 付近) を `return { d, mx, my, segments }` に変更。

- [ ] **Step 10: 全テストを pass まで確認**

Run:

```bash
npm test -- src/lib/arrow-routing.test.ts
```

Expected: 全 PASS（既存 1318 行 + 新規追加分）。

- [ ] **Step 11: TypeScript チェック**

Run:

```bash
npx tsc --noEmit
```

Expected: エラーなし。

- [ ] **Step 12: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts src/lib/types.ts
git commit -m "$(cat <<'EOF'
feat(#<ISSUE_NUM>): buildArrowPath が EdgeSegment[] も返すよう拡張

各分岐（直線/L字/Z字/水平/垂直/斜め 4 kind）で d 文字列と並走して
segments を構築。マルチエッジ協調ルーティングの基盤。

- EdgeSegment 型を arrow-routing.ts に追加
- ArrowPath / ArrowPathResult に segments フィールド追加
- segmentsToBboxes ヘルパー (segments → 線分Bbox)
- 既存の検出ロジック（detectDetour 系）は変更なし

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `routeAllArrows` ヘルパー実装（TDD）

**Files:**

- Create: `src/features/editor/edge-router.ts`
- Create: `src/features/editor/edge-router.test.ts`

- [ ] **Step 1: 失敗するテストを書く（共通モック設定）**

Create `src/features/editor/edge-router.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { routeAllArrows } from './edge-router'
import type { ArrowResolveContext } from './edge-router'
import type { Bbox } from '../../lib/arrow-routing'

// テスト用ヘルパー: シンプルな ArrowResolveContext を生成
const makeCtx = (
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  nodeObstacles: Bbox[] = [],
): ArrowResolveContext => ({
  from: { x: fx, y: fy },
  to: { x: tx, y: ty },
  config: { hw: 50, hh: 25, rh: 100 },
  nodeObstacles,
})

describe('routeAllArrows', () => {
  it('returns empty array for empty arrows', () => {
    expect(routeAllArrows([], () => null)).toEqual([])
  })

  it('returns single ArrowPathResult for single arrow', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B' }]
    const result = routeAllArrows(arrows, (a) => (a.id === 'a1' ? makeCtx(0, 100, 200, 100) : null))
    expect(result).toHaveLength(1)
    expect(result[0]).not.toBeNull()
    expect(result[0]?.d).toContain('M0,100')
  })

  it('null context produces null result (no impact on subsequent arrows)', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const result = routeAllArrows(arrows, (a) => (a.id === 'a2' ? makeCtx(0, 100, 200, 100) : null))
    expect(result[0]).toBeNull()
    expect(result[1]).not.toBeNull()
  })

  it('second arrow with no shared endpoint sees first arrow segments as obstacles', () => {
    // A→B (水平), C→D (水平、同じ y) — C→D が A→B の中央セグメントを避けて迂回することを期待
    // 実装上、エッジ Bbox の y 範囲が一致するため C→D で水平迂回が発動する
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const result = routeAllArrows(
      arrows,
      (a) =>
        a.id === 'a1'
          ? makeCtx(0, 100, 300, 100) // A→B 水平
          : makeCtx(50, 100, 250, 100), // C→D 水平 (A→B の上にある同じ y)
    )
    // 第 2 エッジは水平直線ではなく、何らかの迂回経路を取るはず
    // (d 文字列が L コマンド 1 つだけの単純直線ではない)
    expect(result[1]?.d.match(/L/g)?.length).toBeGreaterThan(1)
  })

  it('arrows sharing from-endpoint do NOT treat each other as obstacles', () => {
    // A→B, A→C: from を共有
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'A', to: 'C' },
    ]
    const result = routeAllArrows(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 200, 100) : makeCtx(0, 100, 200, 200),
    )
    // a2 は a1 の segments を obstacle として認識しない (共有エッジ除外)
    // この場合は迂回が発生せず、L字または Z字パスのまま
    // 具体的な assert: a1 だけの場合と a2 の経路が同じ
    const arrowsAlone = [{ id: 'a2', from: 'A', to: 'C' }]
    const alone = routeAllArrows(arrowsAlone, () => makeCtx(0, 100, 200, 200))
    expect(result[1]?.d).toBe(alone[0]?.d)
  })

  it('arrows sharing to-endpoint do NOT treat each other as obstacles', () => {
    // A→C, B→C: to を共有
    const arrows = [
      { id: 'a1', from: 'A', to: 'C' },
      { id: 'a2', from: 'B', to: 'C' },
    ]
    const result = routeAllArrows(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 200, 100) : makeCtx(0, 200, 200, 100),
    )
    const arrowsAlone = [{ id: 'a2', from: 'B', to: 'C' }]
    const alone = routeAllArrows(arrowsAlone, () => makeCtx(0, 200, 200, 100))
    expect(result[1]?.d).toBe(alone[0]?.d)
  })

  it('deterministic ordering by id.localeCompare', () => {
    const arrows1 = [
      { id: 'z1', from: 'A', to: 'B' },
      { id: 'a1', from: 'C', to: 'D' },
    ]
    const arrows2 = [...arrows1].reverse()
    const ctx = (a: { id: string }) =>
      a.id === 'z1' ? makeCtx(0, 100, 200, 100) : makeCtx(50, 100, 150, 100)
    const r1 = routeAllArrows(arrows1, ctx)
    const r2 = routeAllArrows(arrows2, ctx)
    // 結果は入力順に対応するが、内部のルーティング順は id 順で同じはず
    // 同じ id の結果は同じ d を持つ
    const findById = (rs: typeof r1, arr: typeof arrows1, id: string) => {
      const idx = arr.findIndex((a) => a.id === id)
      return rs[idx]?.d
    }
    expect(findById(r1, arrows1, 'a1')).toBe(findById(r2, arrows2, 'a1'))
    expect(findById(r1, arrows1, 'z1')).toBe(findById(r2, arrows2, 'z1'))
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run:

```bash
npm test -- src/features/editor/edge-router.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: `routeAllArrows` を実装**

Create `src/features/editor/edge-router.ts`:

```ts
import { calcArrowPath } from '../../lib/flow-engine'
import { segmentsToBboxes } from '../../lib/arrow-routing'
import type { Point, Bbox, EdgeSegment } from '../../lib/arrow-routing'
import type { ArrowPathResult, ArrowSide } from '../../lib/types'

export interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
  fromSide?: ArrowSide
  toSide?: ArrowSide
}

export interface ArrowResolveContext {
  from: Point
  to: Point
  config: ArrowConfig
  nodeObstacles: Bbox[]
}

export interface ArrowLike {
  id: string
  from: string
  to: string
}

export function routeAllArrows<T extends ArrowLike>(
  arrows: T[],
  resolveContext: (arrow: T) => ArrowResolveContext | null,
): Array<ArrowPathResult | null> {
  // 元の配列順を保つため、id 順ソートしたインデックスマップを作る
  const indexedArrows = arrows.map((a, i) => ({ arrow: a, originalIndex: i }))
  const sorted = [...indexedArrows].sort((a, b) => a.arrow.id.localeCompare(b.arrow.id))

  const priorSegmentsByEdge = new Map<string, EdgeSegment[]>()
  const edgeEndpoints = new Map<string, { from: string; to: string }>()
  const results = new Array<ArrowPathResult | null>(arrows.length)

  for (const { arrow, originalIndex } of sorted) {
    const ctx = resolveContext(arrow)
    if (!ctx) {
      results[originalIndex] = null
      continue
    }

    // 共有ノード除外: arrow と from/to を共有しないエッジの segments のみ抽出
    const foreignSegments: EdgeSegment[] = []
    for (const [eid, segs] of priorSegmentsByEdge) {
      const ep = edgeEndpoints.get(eid)!
      if (
        ep.from === arrow.from ||
        ep.from === arrow.to ||
        ep.to === arrow.from ||
        ep.to === arrow.to
      ) {
        continue
      }
      foreignSegments.push(...segs)
    }

    const edgeObstacles = segmentsToBboxes(foreignSegments)
    const obstacles = [...ctx.nodeObstacles, ...edgeObstacles]

    const result = calcArrowPath(ctx.from, ctx.to, ctx.config, obstacles)
    results[originalIndex] = result

    if (result) {
      priorSegmentsByEdge.set(arrow.id, result.segments)
      edgeEndpoints.set(arrow.id, { from: arrow.from, to: arrow.to })
    }
  }

  return results
}
```

- [ ] **Step 4: テスト pass まで確認**

Run:

```bash
npm test -- src/features/editor/edge-router.test.ts
```

Expected: PASS（全 7 件）。

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/edge-router.ts src/features/editor/edge-router.test.ts
git commit -m "$(cat <<'EOF'
feat(#<ISSUE_NUM>): routeAllArrows ヘルパー追加（マルチエッジ協調）

複数エッジを id 順に逐次ルーティング。各エッジは先行エッジの segments を
障害物として認識するが、from/to を共有するエッジ間は除外（自然な収束を許容）。

- 共有ノード除外フィルタ
- id.localeCompare による決定論的順序
- 元配列順を保った結果配列を返す

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `FlowEditor.aPath` を `routeAllArrows` に置き換え

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:1424-1467` (aPath 定義)
- Modify: `src/features/editor/FlowEditor.tsx` (aPath 呼び出し箇所)

- [ ] **Step 1: 呼び出し箇所を grep**

Run:

```bash
grep -n "aPath(" src/features/editor/FlowEditor.tsx
```

Expected: 定義箇所 + 呼び出し箇所が全部表示される。複数あれば全て改修対象。

- [ ] **Step 2: import を追加**

Edit `src/features/editor/FlowEditor.tsx` の import セクション：

```ts
import { routeAllArrows } from './edge-router'
import type { ArrowResolveContext } from './edge-router'
```

- [ ] **Step 3: `aPath` を `routeAllArrows` 呼び出しに置換**

Edit `src/features/editor/FlowEditor.tsx:1424-1467`:

旧 `aPath` 関数を以下に置き換える：

```ts
// routeAllArrows でマルチエッジ協調ルーティング
const allArrowPaths = routeAllArrows(arrows, (arrow): ArrowResolveContext | null => {
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

  const obstacles: Bbox[] = buildObstacles({
    nodes: obstacleNodes,
    fromKey: arrow.from,
    toKey: arrow.to,
    fromCx: from.x,
    fromCy: from.y,
    toCx: to.x,
    toCy: to.y,
    sameRow: fri === tri,
    sameLane: fli === tli,
    rowH: RH,
    colW: LW + G,
    bboxW: TW,
    bboxH: TH,
  })

  return {
    from,
    to,
    config: {
      hw: TW / 2,
      hh: TH / 2,
      rh: RH,
      fromShape: ft.shape ?? undefined,
      toShape: tt.shape ?? undefined,
      fromSide: arrow.fromSide,
      toSide: arrow.toSide,
    },
    nodeObstacles: obstacles,
  }
})

// arrows[i] に対応するパスを引く既存ヘルパー（既存コードとの互換のため残す）
// O(1) lookup のため Map で索引化
const pathByArrowId = new Map<string, ArrowPathResult | null>()
arrows.forEach((a, i) => pathByArrowId.set(a.id, allArrowPaths[i]))
const aPath = (arrow: InternalArrow): ArrowPathResult | null => pathByArrowId.get(arrow.id) ?? null
```

- [ ] **Step 4: TypeScript チェック**

Run:

```bash
npx tsc --noEmit
```

Expected: エラーなし。

- [ ] **Step 5: 既存テストを実行**

Run:

```bash
npm test
```

Expected: 全 PASS。FlowEditor 関連のテスト・スナップショットが壊れていないことを確認。

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "$(cat <<'EOF'
feat(#<ISSUE_NUM>): FlowEditor.aPath を routeAllArrows へ置き換え

各エッジ独立計算から、配列順を保ちつつ id 順で逐次ルーティングする構造へ。
既存の aPath インターフェースは維持（呼び出し側の影響最小化）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `SharedFlowViewer.computeArrowPath` を `routeAllArrows` に置き換え

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx:114-164`

- [ ] **Step 1: import を追加**

Edit `src/features/shared/SharedFlowViewer.tsx` の import セクション：

```ts
import { routeAllArrows } from '../editor/edge-router'
import type { ArrowResolveContext } from '../editor/edge-router'
```

- [ ] **Step 2: `routeAllArrows` 用に Arrow を ArrowLike に整形**

SharedFlowViewer の Arrow は `fromNodeId / toNodeId` を持つ。`ArrowLike` インターフェース（`{ id, from, to }`）に合わせるためマッパー関数を介する：

Edit `src/features/shared/SharedFlowViewer.tsx:114-164` の `computeArrowPath` ループ部分を置き換え：

```ts
// 各 arrow を ArrowLike に整形（from/to は ArrowLike の意味論で fromNodeId/toNodeId にマップ）
const arrowsForRouting = flow.arrows.map((a) => ({
  id: a.id,
  from: a.fromNodeId,
  to: a.toNodeId,
  original: a,
}))

const routedPaths = routeAllArrows(arrowsForRouting, (mapped): ArrowResolveContext | null => {
  const arrow = mapped.original
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
  const obstacles: Bbox[] = buildObstacles({
    nodes: obstacleNodes,
    fromKey: fromNode.id,
    toKey: toNode.id,
    fromCx: f.x,
    fromCy: f.y,
    toCx: t.x,
    toCy: t.y,
    sameRow: fromNode.rowIndex === toNode.rowIndex,
    sameLane: fromNode.laneId === toNode.laneId,
    rowH: RH,
    colW: LW + G,
    bboxW: TW,
    bboxH: TH,
  })

  return {
    from: f,
    to: t,
    config: {
      hw,
      hh,
      rh: RH,
      fromShape: fromNode.shape as 'diamond' | undefined,
      toShape: toNode.shape as 'diamond' | undefined,
      fromSide: arrow.fromSide ?? undefined,
      toSide: arrow.toSide ?? undefined,
    },
    nodeObstacles: obstacles,
  }
})

// 既存の computeArrowPath 互換: indexed lookup
const arrowPaths = flow.arrows
  .map((a, i) => ({ arrow: a, path: routedPaths[i] }))
  .filter((x): x is { arrow: Arrow; path: ArrowPathResult } => x.path !== null)
```

旧 `computeArrowPath` 関数定義は削除する。

- [ ] **Step 3: 旧ヘルパー削除確認**

Run:

```bash
grep -n "computeArrowPath" src/features/shared/SharedFlowViewer.tsx
```

Expected: 0 件（または変数名が新規ロジック内に出ない）。

- [ ] **Step 4: TypeScript チェック**

Run:

```bash
npx tsc --noEmit
```

Expected: エラーなし。

- [ ] **Step 5: 既存テスト実行**

Run:

```bash
npm test
```

Expected: 全 PASS。SharedFlowViewer 関連のテスト・スナップショットが壊れていないことを確認。

- [ ] **Step 6: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "$(cat <<'EOF'
feat(#<ISSUE_NUM>): SharedFlowViewer を routeAllArrows に統一

エディタと同じマルチエッジ協調ルーティングを共有ビュアでも適用。
Arrow の fromNodeId/toNodeId を ArrowLike の from/to にマップ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Playwright マルチエッジ視覚検証

**Files:**

- Create: `e2e/edge-routing-multi-edge.spec.ts`
- Optional Create: `.screenshots/multi-edge-{before,after}.png` (手動撮影 or テスト出力)

- [ ] **Step 1: スクリプト作成**

Create `e2e/edge-routing-multi-edge.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// 水平セグメントと垂直セグメントの交差判定（端点共有は除外）
function countCrossings(paths: string[]): number {
  type Seg =
    | { kind: 'h'; y: number; x0: number; x1: number; idx: number }
    | { kind: 'v'; x: number; y0: number; y1: number; idx: number }
  const segs: Seg[] = []
  paths.forEach((d, idx) => {
    if (!d) return
    const points = d
      .split(/[ML]/)
      .filter(Boolean)
      .map((s) => s.split(',').map(Number))
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1]
      const [x2, y2] = points[i]
      if (Math.abs(y1 - y2) < 1) {
        segs.push({ kind: 'h', y: y1, x0: Math.min(x1, x2), x1: Math.max(x1, x2), idx })
      } else if (Math.abs(x1 - x2) < 1) {
        segs.push({ kind: 'v', x: x1, y0: Math.min(y1, y2), y1: Math.max(y1, y2), idx })
      }
    }
  })
  let cross = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i],
        b = segs[j]
      if (a.idx === b.idx) continue // 同じエッジ内のセグメントは除外
      if (a.kind === 'h' && b.kind === 'v') {
        if (b.x > a.x0 && b.x < a.x1 && a.y > b.y0 && a.y < b.y1) cross++
      } else if (a.kind === 'v' && b.kind === 'h') {
        if (a.x > b.x0 && a.x < b.x1 && b.y > a.y0 && b.y < a.y1) cross++
      }
    }
  }
  return cross
}

test.describe('multi-edge routing', () => {
  test('multiple edges converging do not cross mid-segments', async ({ page }) => {
    // ログイン
    await page.goto('/login')
    await page.fill('input[name="email"]', process.env.E2E_USER_EMAIL!)
    await page.fill('input[name="password"]', process.env.E2E_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    // 既存のテスト用フローを開く（混線が発生している実例フローを seed しておくか、
    // 新規作成 + 自動接続で再現させる）
    // ※ 具体的な操作は既存 e2e テストの "新規フロー作成" パターンを参照
    await page.click('text=新規フロー作成')
    await page.waitForURL('**/editor/**')

    // 3 ノード以上配置 + ターゲットへの集中接続を再現
    // (実装着手時に既存 e2e のヘルパーを流用して書く)

    // SVG の全 arrow path を取得
    const paths = await page.locator('svg path[data-arrow-id]').all()
    const ds = (await Promise.all(paths.map((p) => p.getAttribute('d')))).filter(
      (d): d is string => d !== null,
    )

    const crossings = countCrossings(ds)
    expect(crossings, `期待: 0、実際: ${crossings} 個の交差`).toBe(0)

    await page.screenshot({ path: '.screenshots/multi-edge-after.png', fullPage: true })
  })
})
```

**注意**:

- Playwright e2e のフロー作成 UI 操作は既存 e2e テストのパターンを参照（`grep -rn "新規フロー作成" e2e/` 等）して合わせる。
- `countCrossings` は水平・垂直セグメントのみ対象。斜めセグメントが現れた場合は誤検出するが、本プロジェクトの直交ルータでは斜めセグメントは出ない。

- [ ] **Step 2: 既存 e2e テストパターンを確認**

Run:

```bash
ls e2e/ && grep -l "calcArrowPath\|arrow-routing\|新規フロー" e2e/ 2>/dev/null
```

Expected: 既存 e2e テストの構成が把握できる。新規 spec のフロー作成手順を実装。

- [ ] **Step 3: テスト実行（修正済みの状態で）**

Run:

```bash
npx playwright test e2e/edge-routing-multi-edge.spec.ts --headed
```

Expected: 視覚確認できる。線が交差していないことを目視で確認 + assert pass。

- [ ] **Step 4: コミット**

```bash
git add e2e/edge-routing-multi-edge.spec.ts
git commit -m "$(cat <<'EOF'
test(#<ISSUE_NUM>): e2e マルチエッジ視覚検証

複数エッジが同一ターゲットに到着するシナリオで線の交差がないことを assert。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: ベンチマーク追加

**Files:**

- Create: `src/features/editor/edge-router.bench.ts`

- [ ] **Step 1: vitest bench スクリプト作成**

Create `src/features/editor/edge-router.bench.ts`:

```ts
import { bench, describe } from 'vitest'
import { routeAllArrows } from './edge-router'
import type { ArrowResolveContext } from './edge-router'

const makeSyntheticArrows = (n: number) => {
  const arrows = []
  for (let i = 0; i < n; i++) {
    arrows.push({ id: `a${i}`, from: `node${i}`, to: `node${(i + 1) % n}` })
  }
  return arrows
}

const makeCtx = (i: number, n: number): ArrowResolveContext => ({
  from: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
  to: { x: ((i + 1) % 10) * 100, y: Math.floor((i + 1) / 10) * 100 },
  config: { hw: 50, hh: 25, rh: 100 },
  nodeObstacles: [],
})

describe('routeAllArrows benchmark', () => {
  for (const n of [10, 50, 100, 200]) {
    bench(`E=${n} edges`, () => {
      const arrows = makeSyntheticArrows(n)
      routeAllArrows(arrows, (a) => {
        const i = parseInt(a.id.slice(1))
        return makeCtx(i, n)
      })
    })
  }
})
```

- [ ] **Step 2: ベンチ実行**

Run:

```bash
npx vitest bench src/features/editor/edge-router.bench.ts --run
```

Expected: 各 N の ops/sec が出力される。

- [ ] **Step 3: 結果を設計ドキュメントに反映**

Edit `docs/plans/2026-05-22-multi-edge-routing-design.md` の「パフォーマンス」セクション末尾に実測結果を追記：

```markdown
### 実測値（YYYY-MM-DD ベンチ）

| E   | ops/sec | 1 ルーティングあたり |
| --- | ------- | -------------------- |
| 10  | ?       | ?                    |
| 50  | ?       | ?                    |
| 100 | ?       | ?                    |
| 200 | ?       | ?                    |

E=200 で 1 回 16ms 超過の場合、段階2 へ昇格判断。
```

ベンチ実行で得た値を `?` に埋める。

- [ ] **Step 4: コミット**

```bash
git add src/features/editor/edge-router.bench.ts docs/plans/2026-05-22-multi-edge-routing-design.md
git commit -m "$(cat <<'EOF'
test(#<ISSUE_NUM>): routeAllArrows ベンチマーク追加

合成シナリオ E=10/50/100/200 で実測。設計ドキュメントにレイテンシ記録。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 本番ビルド確認 + PR 作成

- [ ] **Step 1: main 同期**

Run:

```bash
git pull origin main --rebase
npm test
```

Expected: 全 PASS。失敗があれば修正してから次へ。

- [ ] **Step 2: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` の手順に従って本番ビルドをローカル起動。実際にマルチエッジが想定通りに描画されることをブラウザで目視確認。

- [ ] **Step 3: push + PR 作成**

Run:

```bash
git push -u origin feat/multi-edge-routing-stage1-issue-<ISSUE_NUM>
gh pr create --title "feat(#<ISSUE_NUM>): マルチエッジ協調ルーティング 段階1" --body "$(cat <<'EOF'
## Summary
- ルーティング済みエッジのセグメントを後続エッジの障害物に昇格
- 共有ノード除外による自然な収束を許容
- 3 種類の検出（水平/垂直/斜め）すべてに適用

## Design / Plan
- 設計: docs/plans/2026-05-22-multi-edge-routing-design.md
- プラン: docs/plans/2026-05-22-multi-edge-routing-plan.md
- Issue: #<ISSUE_NUM>

## Test plan
- [ ] arrow-routing.test.ts 全 PASS
- [ ] edge-router.test.ts 全 PASS
- [ ] FlowEditor 関連テスト・スナップショット PASS
- [ ] SharedFlowViewer 関連テスト・スナップショット PASS
- [ ] Playwright マルチエッジ視覚検証 PASS
- [ ] ベンチマーク E=200 で 16ms 以内
- [ ] LCP 1 秒以内（preview 起動で確認）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: CI watch**

Run:

```bash
gh pr checks --watch
```

Expected: 全 PASS。失敗があれば修正して push、再 watch。

- [ ] **Step 5: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 6: レビュー修正ループ（CLAUDE.md Step 9 に従う）**

最大 10 回。1 分待機 → コメント取得 → 判定 → 修正 → push → CI watch → 再依頼 のループ。`[C:承認OK]` まで継続。

- [ ] **Step 7: Merge + Deploy 確認**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

`~/.claude/skills/deploy/SKILL.md` でデプロイ確認。

- [ ] **Step 8: ワークツリー削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/multi-edge-routing
git branch -d feat/multi-edge-routing-stage1-issue-<ISSUE_NUM>
git worktree list  # 残骸がないことを確認
```

---

## 完了基準（受け入れ基準の再掲）

- [ ] arrow-routing.test.ts 既存 1318 行すべて pass
- [ ] arrow-routing.test.ts に segments 出力テストが追加されすべて pass
- [ ] edge-router.test.ts 全 7 シナリオ pass
- [ ] FlowEditor / SharedFlowViewer 既存スナップショット pass
- [ ] e2e edge-routing-multi-edge.spec.ts pass
- [ ] vitest bench で E=200 のレイテンシ記録 + 設計ドキュメントに追記
- [ ] LCP 1 秒以内（preview 起動で確認）
- [ ] PR レビュー [C:承認OK]
- [ ] main へ merge + deploy 確認 + ワークツリー削除
