# cellFromPos 最近接セル化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ノードドラッグ中の候補セル判定 (`cellFromPos`) を「カーソル位置から最寄りセル（範囲外は端にクランプ）」方式に変更し、破線インジケータがカーソルの行境界踏み込みと同時に切り替わるようにする (Issue #344)。

**Architecture:** 現在 `FlowEditor.tsx` のクロージャである `cellFromPos` を `src/lib/flow-engine.ts` にピュア関数として切り出し、`Math.floor` (行) / `Math.round` (レーン) で最近接セルを返す。React 側は薄いラッパで呼び出す。テストは Vitest でユニット化。

**Tech Stack:** TypeScript / React / Vitest / Playwright

**Spec:** `docs/superpowers/specs/2026-05-12-drag-cell-nearest-design.md`

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/lib/flow-engine.ts` | `cellFromPos` ピュア関数を追加 export | Modify |
| `src/lib/flow-engine.test.ts` | `cellFromPos` のユニットテスト追加 | Modify |
| `src/features/editor/FlowEditor.tsx` | クロージャ実装を削除し、ライブラリ関数の呼び出しに置換 | Modify (`923-932` 行、import 文) |
| `src/features/editor/types.ts` | `CellInfo` は既存 export を再利用（変更なし） | — |

`GridGeometry` 型は `flow-engine.ts` 内で新規定義（外部公開 export）。`CellInfo` は既に `features/editor/types.ts` に export 済みのため、`flow-engine.ts` から既存パターン（`TaskData`, `MemoData` のインポートと同様）で参照する。

---

## Task 1: cellFromPos のユニットテストを追加（Red）

**Files:**
- Modify: `src/lib/flow-engine.test.ts`

固定ジオメトリ `{ TM: 24, HH: 46, RH: 84, LM: 28, LW: 200, G: 12 }` でテストを書く。この値での座標:
- 行上端 y: R0=70, R1=154, R2=238
- レーン中心 x: L0=128, L1=340, L2=552
- レーン中心の中点 x: L0/L1=234, L1/L2=446

- [ ] **Step 1: failing test を追記**

`src/lib/flow-engine.test.ts` の末尾に以下を追記する（既存 import 行に `cellFromPos` を追加）:

ファイル冒頭の `import` ブロック:

```ts
import {
  remapArrows,
  remapArrowsBatch,
  filterArrowsByDeletedKeys,
  calcArrowPath,
  findChain,
  detectReorder,
  reconnectChain,
  detectCrossLaneRewire,
  swapKeys,
  calcMultiDropTargets,
  cellFromPos,
} from './flow-engine'
```

ファイル末尾に追加:

```ts
/* ========================================================= */
/* cellFromPos                                               */
/* ========================================================= */

describe('cellFromPos', () => {
  const geom = { TM: 24, HH: 46, RH: 84, LM: 28, LW: 200, G: 12 }
  const lanes = [{ id: 'L0' }, { id: 'L1' }, { id: 'L2' }]
  const rows = [{ id: 'R0' }, { id: 'R1' }, { id: 'R2' }]

  it('returns the cell when cursor is at the center of a cell', () => {
    expect(cellFromPos(128, 112, lanes, rows, geom)).toEqual({
      lid: 'L0',
      rid: 'R0',
      li: 0,
      ri: 0,
      key: 'L0_R0',
    })
  })

  it('returns row 0 cell when cursor is exactly at row 0 top boundary', () => {
    expect(cellFromPos(128, 70, lanes, rows, geom)?.rid).toBe('R0')
  })

  it('returns row 0 cell when cursor is 1px before row 1 top boundary', () => {
    expect(cellFromPos(128, 153, lanes, rows, geom)?.rid).toBe('R0')
  })

  it('returns row 1 cell at the moment cursor crosses row 1 top boundary (issue #344 regression)', () => {
    expect(cellFromPos(128, 154, lanes, rows, geom)?.rid).toBe('R1')
  })

  it('returns row 1 cell when cursor is 1px into row 1', () => {
    expect(cellFromPos(128, 155, lanes, rows, geom)?.rid).toBe('R1')
  })

  it('clamps to last row when cursor is below the grid', () => {
    expect(cellFromPos(128, 10000, lanes, rows, geom)?.rid).toBe('R2')
  })

  it('clamps to first row when cursor is above the grid', () => {
    expect(cellFromPos(128, 0, lanes, rows, geom)?.rid).toBe('R0')
  })

  it('clamps to first lane when cursor is left of the grid', () => {
    expect(cellFromPos(-100, 112, lanes, rows, geom)?.lid).toBe('L0')
  })

  it('clamps to last lane when cursor is right of the grid', () => {
    expect(cellFromPos(10000, 112, lanes, rows, geom)?.lid).toBe('L2')
  })

  it('returns lane 0 just before L0/L1 center-midpoint', () => {
    // L0 center = 128, L1 center = 340, midpoint = 234. -1px → still L0.
    expect(cellFromPos(233, 112, lanes, rows, geom)?.lid).toBe('L0')
  })

  it('returns lane 1 just after L0/L1 center-midpoint', () => {
    expect(cellFromPos(235, 112, lanes, rows, geom)?.lid).toBe('L1')
  })

  it('returns lane 1 just before L1/L2 center-midpoint', () => {
    // L1 center = 340, L2 center = 552, midpoint = 446. -1px → still L1.
    expect(cellFromPos(445, 112, lanes, rows, geom)?.lid).toBe('L1')
  })

  it('returns lane 2 just after L1/L2 center-midpoint', () => {
    expect(cellFromPos(447, 112, lanes, rows, geom)?.lid).toBe('L2')
  })

  it('returns null when lanes is empty', () => {
    expect(cellFromPos(128, 112, [], rows, geom)).toBeNull()
  })

  it('returns null when rows is empty', () => {
    expect(cellFromPos(128, 112, lanes, [], geom)).toBeNull()
  })

  it('returns the correct composite key', () => {
    expect(cellFromPos(340, 196, lanes, rows, geom)?.key).toBe('L1_R1')
  })
})
```

- [ ] **Step 2: テストを実行して失敗確認**

Run: `npx vitest run src/lib/flow-engine.test.ts -t "cellFromPos"`
Expected: TS コンパイルエラー（`cellFromPos` が flow-engine.ts に存在しないため `import` 解決不可）

- [ ] **Step 3: コミット**

```bash
git add src/lib/flow-engine.test.ts
git commit -m "test(#344): add failing tests for cellFromPos pure function"
```

---

## Task 2: cellFromPos をピュア関数として実装（Green）

**Files:**
- Modify: `src/lib/flow-engine.ts`

- [ ] **Step 1: import を更新**

`src/lib/flow-engine.ts` の冒頭 import を以下に置換:

```ts
import type { InternalArrow, ArrowPathResult } from './types'
import type { TaskData, MemoData, CellInfo } from '../features/editor/types'
import { exitPt, entryPt, buildArrowPath } from './arrow-routing'
import type { Point, Bbox } from './arrow-routing'
```

差分は `CellInfo` を追加するだけ。

- [ ] **Step 2: GridGeometry 型と cellFromPos 関数を追加**

`flow-engine.ts` の `calcMultiDropTargets` 関数（185 行付近、`/* calcMultiDropTargets */` セクション）の直前に以下を挿入する:

```ts
/* --------------------------------------------------------- */
/* cellFromPos                                               */
/* --------------------------------------------------------- */

export interface GridGeometry {
  TM: number
  HH: number
  RH: number
  LM: number
  LW: number
  G: number
}

/**
 * カーソル座標 (sx, sy) からドロップ候補セルを返す。
 *
 * 行はカーソルが行上端を踏み込んだ瞬間に次行へ切り替わるよう Math.floor を、
 * レーンは隣レーン中心の中点を越えた瞬間に切り替わるよう Math.round を用いる。
 * グリッド範囲外（最下行より下、最上行より上、両端レーンの外側）では端のセルにクランプ。
 *
 * lanes または rows が空のときのみ null を返す。
 */
export function cellFromPos(
  sx: number,
  sy: number,
  lanes: { id: string }[],
  rows: { id: string }[],
  geom: GridGeometry,
): CellInfo | null {
  if (lanes.length === 0 || rows.length === 0) return null

  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

  const riRaw = Math.floor((sy - (geom.TM + geom.HH)) / geom.RH)
  const ri = clamp(riRaw, 0, rows.length - 1)

  const liRaw = Math.round((sx - geom.LM - geom.LW / 2) / (geom.LW + geom.G))
  const li = clamp(liRaw, 0, lanes.length - 1)

  return {
    lid: lanes[li].id,
    rid: rows[ri].id,
    li,
    ri,
    key: `${lanes[li].id}_${rows[ri].id}`,
  }
}
```

- [ ] **Step 3: テスト実行して全 pass 確認**

Run: `npx vitest run src/lib/flow-engine.test.ts -t "cellFromPos"`
Expected: 全 15 ケース PASS

- [ ] **Step 4: コミット**

```bash
git add src/lib/flow-engine.ts
git commit -m "feat(#344): add cellFromPos as pure function in flow-engine"
```

---

## Task 3: FlowEditor.tsx のクロージャを新関数の呼び出しに置換

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx:54-61` (import 文)
- Modify: `src/features/editor/FlowEditor.tsx:923-932` (cellFromPos クロージャ)

- [ ] **Step 1: import に cellFromPos を追加**

`FlowEditor.tsx` の `flow-engine` インポート (`54-61` 行) を以下に置換:

```ts
import {
  remapArrows,
  swapKeys,
  remapArrowsBatch,
  filterArrowsByDeletedKeys,
  calcArrowPath,
  calcMultiDropTargets,
  cellFromPos as cellFromPosLib,
} from '../../lib/flow-engine'
```

- [ ] **Step 2: クロージャ実装を新関数の呼び出しに置換**

`FlowEditor.tsx` の `cellFromPos` 関数定義 (`923-932` 行) を以下に置換:

置換前:

```ts
  const cellFromPos = (sx: number, sy: number): CellInfo | null => {
    for (let li = 0; li < lanes.length; li++)
      for (let ri = 0; ri < rows.length; ri++) {
        const cx = laneX(li),
          cy = TM + HH + ri * RH
        if (sx >= cx && sx < cx + LW && sy >= cy && sy < cy + RH)
          return { lid: lanes[li].id, rid: rows[ri].id, li, ri, key: ky(lanes[li].id, rows[ri].id) }
      }
    return null
  }
```

置換後:

```ts
  const cellFromPos = (sx: number, sy: number): CellInfo | null =>
    cellFromPosLib(sx, sy, lanes, rows, { TM, HH, RH, LM, LW, G })
```

- [ ] **Step 3: 型チェックと既存テスト全 pass を確認**

Run: `npm test`
Expected: 全テスト PASS（既存テスト + 新規 cellFromPos 15 ケース）

- [ ] **Step 4: lint / typecheck**

Run: `npm run lint 2>/dev/null || npx eslint src/features/editor/FlowEditor.tsx src/lib/flow-engine.ts src/lib/flow-engine.test.ts`
Expected: エラーなし（warning 既存分を除き新規エラーなし）

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#344): use nearest-cell cellFromPos in FlowEditor drag handling"
```

---

## Task 4: 実画面検証

**Files:** （変更なし、動作確認のみ）

- [ ] **Step 1: dev サーバ起動**

Run: `npm run dev`（バックグラウンド起動可）
Expected: localhost で起動。

- [ ] **Step 2: ブラウザで以下を確認**

1. 既存フローを開き、1つのノードを下方向にドラッグ:
   - **カーソルが目標行の上端を踏み込んだ瞬間** に紫の破線インジケータが当該行に表示されること
2. 上方向にドラッグでも同様に切り替わること
3. 左右レーン間にドラッグし、隣レーンの中心線を越えた瞬間に破線が切り替わること
4. 複数選択（Shift+クリック または ドラッグ選択）してまとめてドラッグし、滑らかに追従すること
5. カーソルをグリッド外（最下行より下の余白）に出したとき、最下行が候補化され破線が表示されること
6. 異レーンの占有セルにカーソルがクランプされた場合、`dragOver` が立たない（破線が出ない）こと

スクリーンショットは `.screenshots/` に保存（ルートに保存しない）。

- [ ] **Step 3: LCP 確認**

DevTools の Performance タブで LCP を計測。1秒以内であることを確認。超過時は原因調査後 Task 2/3 のロジックを見直す（本変更で LCP に影響が出ることは原則ないが念のため）。

- [ ] **Step 4: 確認 OK ならそのまま（コミット不要）**

問題があれば該当 Task に戻る。

---

## Final Verification

- [ ] **Step 1: 全テスト最終 pass 確認**

Run: `npm test`
Expected: 全テスト PASS。FAIL ゼロ件。

- [ ] **Step 2: git status クリーン確認**

Run: `git status`
Expected: 未コミット変更なし（`.screenshots/` の新規ファイルは除く）。

- [ ] **Step 3: コミットログ確認**

Run: `git log --oneline -5`
Expected: 以下 3 件のコミットが順に並ぶ:
1. `test(#344): add failing tests for cellFromPos pure function`
2. `feat(#344): add cellFromPos as pure function in flow-engine`
3. `feat(#344): use nearest-cell cellFromPos in FlowEditor drag handling`

---

## 受け入れ条件チェック（Spec再掲）

- [ ] ノードを下方向にドラッグした際、カーソルが目標行の上端を超えた時点で破線候補が表示される（Task 1 Step 1 の regression テスト + Task 4 Step 2-1 で確認）
- [ ] 上方向ドラッグでも同様にスムーズに候補が切り替わる（Task 4 Step 2-2）
- [ ] レーン間（左右）の移動でも同様に最近接で追従する（Task 1 のレーン境界テスト + Task 4 Step 2-3）
- [ ] マルチドラッグでも候補追従が同じ滑らかさで動く（Task 4 Step 2-4: `calcMultiDropTargets` がアンカーとして同じ `cellFromPos` を参照するため）
- [ ] 既存テスト全pass（Task 3 Step 3, Final Verification Step 1）
