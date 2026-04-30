# 縦方向（同一レーン）の矢印迂回 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一レーン（縦方向）で A→C の直線パス上に他ノードがあるとき、右優先で迂回するロジックを実装する（issue #333、#314 の対称版）。

**Architecture:** 既存の横方向迂回ロジック (`detectDetour`, `collectObstacles`) の対称コピー。`arrow-routing.ts` に `detectVerticalDetour` と `collectVerticalObstacles` を追加し、`buildArrowPath` で水平/垂直直線を判別して dispatch。呼び出し側 (`FlowEditor.aPath`, `SharedFlowViewer.computeArrowPath`) は同一行/同一レーンで分岐。

**Tech Stack:** TypeScript / React / Vitest / Playwright。CSS Modules。

**Spec:** `docs/superpowers/specs/2026-04-30-vertical-arrow-detour-design.md`

**Branch:** `feat/vertical-arrow-detour-333`

---

## 事前準備（Workflow Step 0-1）

```bash
# main 最新化（必須。失敗したら中断して人間に報告）
git checkout main
git fetch origin
git merge --ff-only origin/main

# issue ラベル
gh issue edit 333 --add-label "作業開始"

# worktree 作成
git worktree add .worktrees/feat-vertical-arrow-detour-333 -b feat/vertical-arrow-detour-333
cd .worktrees/feat-vertical-arrow-detour-333

# .env シンボリックリンク
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done

# テストルール再読込
cat ~/.claude/rules/testing.md
```

以降の全タスクはこの worktree 内で実行する。

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/lib/arrow-routing.ts` | 矢印パス計算ロジック | Modify (追加: `detectVerticalDetour`, `collectVerticalObstacles`, `buildArrowPath` dispatch) |
| `src/lib/arrow-routing.test.ts` | ユニットテスト | Modify (追加: 縦方向テスト 14 件 + collectVerticalObstacles テスト 4 件) |
| `src/features/editor/FlowEditor.tsx` | エディタ本体 | Modify (`aPath` の obstacles 組み立て) |
| `src/features/shared/SharedFlowViewer.tsx` | 共有ビューア | Modify (`computeArrowPath` の obstacles 組み立て) |

---

## Task 1: detectVerticalDetour 基本ロジック（TDD）

**Files:**
- Test: `src/lib/arrow-routing.test.ts` (末尾に新 describe を追加)
- Modify: `src/lib/arrow-routing.ts`

縦方向の障害なし／障害あり（右迂回）の最小ケースから始める。

- [ ] **Step 1: 失敗テストを追加**

`src/lib/arrow-routing.test.ts` の末尾に以下の新 describe ブロックを追加:

```ts
describe('buildArrowPath - 縦方向迂回（同一レーン）', () => {
  // 共通の始終点（A→C 同一レーン、A=(200,200), C=(200,600) のときの exitPt/entryPt 後の値）
  // ノード TW=152, TH=56 → hh=28, exit Y=200+28=228, entry Y=600-28=572
  const s = { x: 200, y: 228 }
  const e = { x: 200, y: 572 }
  const fc = { x: 200, y: 200 }
  const tc = { x: 200, y: 600 }

  it('obstacles 省略 → 既存の直線パスを返す（垂直直線）', () => {
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('obstacles が空配列 → 既存の直線パスを返す', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('同一列・障害1個・左右空き → 右迂回パス（detourX = 障害右端 + 14）', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    // detourX = 200 + 76 + 14 = 290
    // sign=+1, halfDy=172, departY=228+14=242, approachY=572-14=558
    expect(r.d).toBe('M200,228 L200,242 L290,242 L290,558 L200,558 L200,572')
    expect(r.mx).toBe(290)
    expect(r.my).toBe(400)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm test -- arrow-routing.test
```

期待: 「障害1個・左右空き → 右迂回パス」が FAIL（直線パスが返るため）。最初の 2 件（直線ケース）は既存ロジックで PASS する可能性あり、それは想定どおり。

- [ ] **Step 3: detectVerticalDetour を実装**

`src/lib/arrow-routing.ts` の `detectDetour` 関数の **直後** に追加:

```ts
function detectVerticalDetour(
  s: Point,
  e: Point,
  obstacles: Bbox[],
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
      Math.abs(b.x - colX) < b.w / 2 + 2 && b.y - b.h / 2 < yHigh - 1 && b.y + b.h / 2 > yLow + 1,
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

- [ ] **Step 4: buildArrowPath に dispatch を追加**

`src/lib/arrow-routing.ts` の `buildArrowPath` 内、既存の水平迂回ブロック直後に追加。具体的には、既存の `if (obstacles && obstacles.length > 0)` ブロック内で、水平 detour が null だったら垂直 detour を試す形にする:

```ts
  // 迂回モード: 同一行/同一レーンで経路上に障害ノードがある場合
  if (obstacles && obstacles.length > 0) {
    const detour = detectDetour(s, e, obstacles)
    if (detour) {
      const { detourY } = detour
      const sign = Math.sign(dx)
      const halfDx = Math.abs(dx) / 2
      const departX = s.x + sign * Math.min(DEPART_GAP, halfDx)
      const approachX = e.x - sign * Math.min(APPROACH_GAP, halfDx)
      const d = `M${s.x},${s.y} L${departX},${s.y} L${departX},${detourY} L${approachX},${detourY} L${approachX},${e.y} L${e.x},${e.y}`
      return { d, mx: (s.x + e.x) / 2, my: detourY }
    }
    const vDetour = detectVerticalDetour(s, e, obstacles)
    if (vDetour) {
      const { detourX } = vDetour
      // |e.y - s.y| / 2 で clamp（横版と対称な防御コード）
      const sign = Math.sign(dy)
      const halfDy = Math.abs(dy) / 2
      const departY = s.y + sign * Math.min(DEPART_GAP, halfDy)
      const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
      // 6 セグメント: M → 垂直(departY まで) → 水平(detourX まで) → 垂直(approachY まで)
      //               → 水平(e.x まで=s.x なので戻る) → 垂直(e.y へ進入)
      const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
      return { d, mx: detourX, my: (s.y + e.y) / 2 }
    }
  }
```

- [ ] **Step 5: テスト pass を確認**

```bash
npm test -- arrow-routing.test
```

期待: 新規 3 件 + 既存全件 PASS。

- [ ] **Step 6: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
feat(#333): add detectVerticalDetour for same-lane arrow routing

Mirror of detectDetour for vertical straight lines. buildArrowPath
dispatches to vertical detour when e.x ≈ s.x and obstacles are present.
Right-priority by default (symmetric to horizontal's down-priority).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: detectVerticalDetour 塞がり判定（TDD）

直右にノードがあるとき左迂回、両塞がりで右優先になることを検証。

**Files:**
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: 失敗テストを追加**

Task 1 で追加した `describe('buildArrowPath - 縦方向迂回（同一レーン）', () => {...})` の中に追加:

```ts
  it('同一列・障害1個・直右塞がり → 左迂回（detourX = 障害左端 - 14）', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, Bright])
    // detourX = 200 - 76 - 14 = 110
    expect(r.d).toBe('M200,228 L200,242 L110,242 L110,558 L200,558 L200,572')
    expect(r.mx).toBe(110)
  })

  it('同一列・障害1個・両塞がり → 右優先で右迂回', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 400, w: 152, h: 56 }
    const Bleft: Bbox = { x: 116, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, Bright, Bleft])
    expect(r.mx).toBe(290)
  })
```

- [ ] **Step 2: テストを実行して PASS を確認**

```bash
npm test -- arrow-routing.test
```

期待: Task 1 で実装したロジックで PASS（実装変更不要）。FAIL する場合はロジック誤り — `rightBlocked` / `leftBlocked` の判定式を確認。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#333): add blocked-direction tests for vertical detour

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: detectVerticalDetour 複数障害・方向・エッジ（TDD）

**Files:**
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: 残りのテストケースを追加**

Task 1 で追加した describe 内に以下を追加:

```ts
  it('同一列・障害2個・右空き → まとめて右迂回（detourX は最右端の最大）', () => {
    const B: Bbox = { x: 200, y: 380, w: 152, h: 56 }
    const C2: Bbox = { x: 200, y: 480, w: 200, h: 56 }
    const sExt = { x: 200, y: 228 }
    const eExt = { x: 200, y: 624 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 200, y: 700 }, [B, C2])
    // 最右端: max(200+76, 200+100) = 300, +14 = 314
    expect(r.mx).toBe(314)
    expect(r.d).toBe('M200,228 L200,242 L314,242 L314,610 L200,610 L200,624')
  })

  it('同一列・障害2個・1つだけ直右塞がり → 左迂回', () => {
    const B: Bbox = { x: 200, y: 380, w: 152, h: 56 }
    const C2: Bbox = { x: 200, y: 480, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 380, w: 152, h: 56 }
    const sExt = { x: 200, y: 228 }
    const eExt = { x: 200, y: 624 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 200, y: 700 }, [B, C2, Bright])
    // 最左端: min(200-76, 200-76) = 124, -14 = 110
    expect(r.mx).toBe(110)
  })

  it('同一列・障害なし（経路上に bbox がない）→ 直線', () => {
    const farUp: Bbox = { x: 200, y: 100, w: 152, h: 56 }
    const farDown: Bbox = { x: 200, y: 700, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [farUp, farDown])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('斜め方向（dx >= 2）→ 既存の Z/L 字ロジック（縦迂回しない）', () => {
    const sDiag = { x: 200, y: 228 }
    const eDiag = { x: 300, y: 572 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sDiag, eDiag, { x: 200, y: 200 }, { x: 300, y: 600 }, [B])
    // 縦迂回特有のセグメント L${detourX},242 等が出ないことを確認
    expect(r.d).not.toContain('L290,242')
  })

  it('始終点が同じ Y（自己参照） → inCol 空 → 直線', () => {
    const B: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(
      { x: 200, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 200 },
      [B],
    )
    expect(r.d).toBe('M200,200 L200,200')
  })

  it('from/to 自身の bbox が混入しても Y±1 マージンで除外される', () => {
    const fromSelfBbox: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const toSelfBbox: Bbox = { x: 200, y: 600, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [fromSelfBbox, toSelfBbox])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('同一列・下→上方向でも右迂回する（s.y > e.y）', () => {
    // s と e を逆転
    const sR = { x: 200, y: 572 }
    const eR = { x: 200, y: 228 }
    const fcR = { x: 200, y: 600 }
    const tcR = { x: 200, y: 200 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sR, eR, fcR, tcR, [B])
    // sign=-1, departY=572-14=558, approachY=228+14=242
    expect(r.d).toBe('M200,572 L200,558 L290,558 L290,242 L200,242 L200,228')
    expect(r.mx).toBe(290)
  })
```

- [ ] **Step 2: テストを実行して PASS を確認**

```bash
npm test -- arrow-routing.test
```

期待: 全 PASS。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#333): add multi-obstacle and direction tests for vertical detour

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 6 セグメント形状＋自己交差防止 clamp（TDD）

**Files:**
- Test: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テスト追加**

Task 1 の describe ブロックの末尾に追加:

```ts
  describe('垂直進入＋垂直 depart（始終点とも垂直）', () => {
    it('右迂回パスは 6 セグメントで最初と最終セグメントが垂直', () => {
      const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
      const r = buildArrowPath(s, e, fc, tc, [B])
      const segments = r.d.match(/[ML][^ML]+/g) ?? []
      expect(segments).toHaveLength(6)
      // 最初のセグメント（M→L）は垂直: M の X と次の L の X が同じ
      const first = segments[0]
      const second = segments[1]
      const firstX = Number(first.slice(1).split(',')[0])
      const secondX = Number(second.slice(1).split(',')[0])
      expect(firstX).toBe(secondX)
      expect(firstX).toBe(s.x)
      // 最終セグメントは垂直
      const last = segments[segments.length - 1]
      const prev = segments[segments.length - 2]
      const lastX = Number(last.slice(1).split(',')[0])
      const prevX = Number(prev.slice(1).split(',')[0])
      expect(lastX).toBe(prevX)
      expect(lastX).toBe(e.x)
    })

    it('垂直距離が DEPART_GAP*2 未満の場合 departY/approachY は中央で接合し自己交差しない', () => {
      // 垂直距離=20, DEPART_GAP=APPROACH_GAP=14。Math.min(14, 10) で 10 に clamp される
      // s=(200,100), e=(200,120) で間に B (200,110) を置いて迂回を強制
      const sN = { x: 200, y: 100 }
      const eN = { x: 200, y: 120 }
      const fcN = { x: 200, y: 80 }
      const tcN = { x: 200, y: 140 }
      const B: Bbox = { x: 200, y: 110, w: 152, h: 16 }
      const r = buildArrowPath(sN, eN, fcN, tcN, [B])
      // departY = 100 + 1 * Math.min(14, 10) = 110
      // approachY = 120 - 1 * Math.min(14, 10) = 110
      // detourX = 200 + 76 + 14 = 290
      expect(r.d).toBe('M200,100 L200,110 L290,110 L290,110 L200,110 L200,120')
    })
  })
```

- [ ] **Step 2: テストを実行**

```bash
npm test -- arrow-routing.test
```

期待: PASS。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#333): verify 6-segment shape and clamp for vertical detour

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: collectVerticalObstacles ヘルパー（TDD）

**Files:**
- Test: `src/lib/arrow-routing.test.ts`
- Modify: `src/lib/arrow-routing.ts`

- [ ] **Step 1: 失敗テストを追加**

`src/lib/arrow-routing.test.ts` の末尾（`describe('collectObstacles', ...)` の **後** ）に追加。インポート行も必要なら更新:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
```

新 describe 追加:

```ts
describe('collectVerticalObstacles', () => {
  // A=(200,200), B=(200,400), C=(200,600) 同一レーン (colX=200)
  // D=(284,400) B 直右列, E=(116,400) B 直左列 (colW=84 → adjacent threshold)
  // F=(368,400) 2列右（除外対象）
  // 注: ここではテストしやすい colW=84 を使用。実際の運用では LW + G を渡す。
  const TW = 152,
    TH = 56,
    LANE_W = 84

  const baseNodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 200 },
    { key: 'B', cx: 200, cy: 400 },
    { key: 'C', cx: 200, cy: 600 },
    { key: 'D', cx: 284, cy: 400 },
    { key: 'E', cx: 116, cy: 400 },
    { key: 'F', cx: 368, cy: 400 },
  ]

  it('A→C: 同一列の B（from-to 間）と直左 E・直右 D を集める。F（2列右）は除外', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    // B (同一列・間), D (直右), E (直左) が含まれる
    expect(result).toHaveLength(3)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 200, 284])
    // F (cx=368) は除外
    expect(result.every((b) => b.x !== 368)).toBe(true)
  })

  it('from/to 自身は除外される', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    const xys = result.map((b) => `${b.x},${b.y}`)
    expect(xys).not.toContain('200,200') // A
    expect(xys).not.toContain('200,600') // C
  })

  it('A→B（隣接、間にノードなし）: 同一列は from-to 間限定なので空、直左/直右列は Y 制限なしで含む', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'B',
      fromCy: 200,
      toCy: 400,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    // 同一列: A=200, B=400 が from/to で除外。C=600 は Y 範囲外で除外。→ 0件
    // 直左/直右列: D, E のみ（F は 2列右で除外）。Y 制限なしなので cy=400 が含まれる
    expect(result).toHaveLength(2)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 284])
  })

  it('下→上方向（fromCy > toCy）でも同一列・隣接列を正しく抽出', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'C',
      toKey: 'A',
      fromCy: 600,
      toCy: 200,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toHaveLength(3)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 200, 284])
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm test -- arrow-routing.test
```

期待: collectVerticalObstacles が undefined のためインポートエラー or "is not a function"。

- [ ] **Step 3: collectVerticalObstacles を実装**

`src/lib/arrow-routing.ts` の末尾（既存 `collectObstacles` の後）に追加:

```ts
interface CollectVerticalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCy: number // 始点 Y
  toCy: number // 終点 Y
  colX: number // 同一列 X（始点・終点共通）
  colW: number // 列ピッチ（FlowEditor の LW + G を渡す）
  bboxW: number
  bboxH: number
}

/**
 * 矢印の同一列・直左列・直右列にあるノードを bbox 配列に変換する（縦版）。
 * 同一列は from-to 間レンジに限定。直左/直右列は Y 制限なしで含める（左右塞がり判定用）。
 * from/to 自身および 2 列以上離れたノードは除外する。
 *
 * 呼び出し側は同一レーン（fromLane === toLane）のときのみ本関数を呼ぶ想定。
 * colX には fromNode の X 座標を渡すこと（同一レーンなので toNode.x と等価）。
 *
 * collectObstacles の対称版。横版の rowH に相当するのが colW（レーンピッチ）。
 */
export function collectVerticalObstacles(args: CollectVerticalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCy, toCy, colX, colW, bboxW, bboxH } = args
  const yLow = Math.min(fromCy, toCy)
  const yHigh = Math.max(fromCy, toCy)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dx = Math.abs(n.cx - colX)
    const onCol = dx < bboxW / 2 + 2
    // 直左/直右列のみを採用（dx が colW に近い）。2列以上離れたノードは除外。
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

- [ ] **Step 4: テスト pass を確認**

```bash
npm test -- arrow-routing.test
```

期待: 全 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
feat(#333): add collectVerticalObstacles helper

Mirror of collectObstacles for vertical (same-lane) routing. Filters
nodes to same-column (from-to range) and adjacent columns (no Y limit).
colW takes lane pitch (LW + G).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: FlowEditor.aPath を縦方向対応

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: import 文を更新**

`src/features/editor/FlowEditor.tsx` の line 38 付近のインポートを更新:

```ts
import {
  DS,
  collectObstacles,
  collectVerticalObstacles,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
```

- [ ] **Step 2: aPath の obstacles 組み立てロジックを変更**

`src/features/editor/FlowEditor.tsx` の `aPath` 関数内（line 1384-1398 付近）を以下に置き換え:

```ts
    // 同一行/同一レーンのときに obstacles を組み立てる（迂回判定用）
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
    }
```

`LW` と `G` はこのスコープで利用可能（line 678: `const LW = ...`, line 677: `G = T.laneGap`）。

- [ ] **Step 3: 全テストを実行**

```bash
npm test
```

期待: 全 PASS（既存テストに regression なし）。

- [ ] **Step 4: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "$(cat <<'EOF'
feat(#333): wire FlowEditor aPath for vertical detour

Build vertical obstacles when from/to are in the same lane (fli === tli).
Lane pitch is LW + G (uniform).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: SharedFlowViewer.computeArrowPath を縦方向対応

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`

- [ ] **Step 1: import 文を更新**

`src/features/shared/SharedFlowViewer.tsx` の line 14 付近を更新:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  exitPt,
  entryPt,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
```

（注: 実際のインポート構造に合わせて調整。元の順番・他のインポートは維持）

- [ ] **Step 2: computeArrowPath の obstacles 組み立てを変更**

line 131-145 付近の `if (fromNode.rowIndex === toNode.rowIndex) { ... }` ブロックを以下に置き換え:

```ts
    // 同一行/同一レーンのときに obstacles を組み立てる（迂回判定用）
    let obstacles: Bbox[] | undefined
    if (fromNode.rowIndex === toNode.rowIndex) {
      obstacles = collectObstacles({
        nodes: obstacleNodes,
        fromKey: fromNode.id,
        toKey: toNode.id,
        fromCx: f.x,
        toCx: t.x,
        rowY: f.y,
        rowH: RH,
        bboxW: TW,
        bboxH: TH,
      })
    } else if (fromNode.laneId === toNode.laneId) {
      obstacles = collectVerticalObstacles({
        nodes: obstacleNodes,
        fromKey: fromNode.id,
        toKey: toNode.id,
        fromCy: f.y,
        toCy: t.y,
        colX: f.x,
        colW: LW + G,
        bboxW: TW,
        bboxH: TH,
      })
    }
```

`LW` と `G` はこのスコープで利用可能（line 81 付近: `const LW = ...`, `G = T.laneGap` 相当）。確認のため line 70-90 を読み、利用可能な変数名と一致するよう調整。

- [ ] **Step 3: 全テストを実行**

```bash
npm test
```

期待: 全 PASS。

- [ ] **Step 4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "$(cat <<'EOF'
feat(#333): wire SharedFlowViewer for vertical detour

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ブラウザ目視確認（Playwright + 本番ビルド）

**Files:** なし（確認のみ）

- [ ] **Step 1: dev サーバー起動と Playwright でエディタ確認**

`E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログインし、新規 flow を作成:

1. 同一レーン（縦並び）に A、B、C の 3 ノードを置く
2. A → C の矢印を引く
3. 矢印が B を **右へ迂回** することをスクリーンショットで確認 (`.screenshots/333-vertical-detour-right.png`)

- [ ] **Step 2: 直右ノードがある場合の左迂回確認**

1. 上記の B の **直右**（隣接レーン）にもう 1 ノード D を置く
2. A → C の矢印が **左へ迂回** に切り替わることを確認 (`.screenshots/333-vertical-detour-left.png`)

- [ ] **Step 3: Diamond ノード混在確認**

1. B を Diamond に変更
2. A → C 迂回が崩れないことを確認 (`.screenshots/333-vertical-detour-diamond.png`)

- [ ] **Step 4: 横方向 regression なし確認**

1. 同一行で A→C の間に B を置く（横方向）
2. 既存の下迂回挙動が維持されていることを確認 (`.screenshots/333-horizontal-regression.png`)

- [ ] **Step 5: 共有ビューアで同じ挙動を確認**

1. 上記 flow を共有 URL で開く
2. 同じ迂回挙動になっていることを確認 (`.screenshots/333-shared-viewer.png`)

- [ ] **Step 6: LCP 1秒以内を確認**

Chrome DevTools Performance タブで Largest Contentful Paint を測定。1 秒超過ならパフォーマンス改善してから再 commit。

問題があれば該当タスク（5/6/7）に戻って修正。

---

## Task 9: 最新 main 同期 → push → PR 作成

- [ ] **Step 1: main 最新化と全テスト**

```bash
git pull origin main --rebase
npm test
```

全 PASS 必須。

- [ ] **Step 2: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` の手順で本番ビルドをローカル起動して目視確認。

- [ ] **Step 3: push & PR 作成**

```bash
git push -u origin feat/vertical-arrow-detour-333
gh pr create --title "feat(#333): vertical (same-lane) arrow detour" --body "$(cat <<'EOF'
## Summary
- 同一レーン（縦方向）で A→C の間に B があるとき迂回するロジックを追加（issue #333）
- 横方向の迂回（#314）の対称版。右優先（横の下優先と対称）
- `arrow-routing.ts` に `detectVerticalDetour` と `collectVerticalObstacles` を追加
- `FlowEditor.aPath` と `SharedFlowViewer.computeArrowPath` で同一レーン時に dispatch

## Test plan
- [x] 縦方向迂回ユニットテスト 14 件追加
- [x] `collectVerticalObstacles` ユニットテスト 4 件追加
- [x] 既存横方向テスト全 PASS（regression なし）
- [x] エディタで A→C 迂回確認（右迂回・左迂回・Diamond）
- [x] 共有ビューアで同じ挙動確認
- [x] LCP 1秒以内

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: CI watch**

```bash
gh pr checks --watch
```

全 PASS まで待機。FAIL 時は修正→push→再 watch。

- [ ] **Step 5: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 6: review-loop**

Workflow Step 9 のレビューループを実行（最大 10 回）。

- [ ] **Step 7: Merge & Deploy 確認**

`gh pr merge --merge` 後、`~/.claude/skills/deploy/SKILL.md` を参照して deploy 確認。

- [ ] **Step 8: Worktree cleanup**

```bash
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
cd "$MAIN"
git worktree remove .worktrees/feat-vertical-arrow-detour-333
git branch -d feat/vertical-arrow-detour-333
git worktree list
```
