# Diamond ノードの fromSide 対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ひし形ノードのドラッグ起点ハンドルを `fromSide` として永続化し、再描画時にその頂点から矢印が出るようにする。プロパティパネルで編集可能。

**Architecture:** 矢印データに optional な `fromSide: 'top'|'right'|'bottom'|'left'` を追加。新規矢印作成時にドラッグ起点座標から自動導出し、`exitPt` が `fromSide` を尊重して頂点座標を返す。未指定（NULL/undefined）の矢印は従来ロジック（自動）にフォールバックして後方互換を保つ。エディタ・共有ビュー・PNG エクスポート全てで一貫した描画。

**Tech Stack:** React, TypeScript, Vitest, Hono, Cloudflare D1, SVG

**Issue:** #349
**Spec:** `docs/superpowers/specs/2026-05-22-diamond-fromside-design.md`

---

## File Structure

### Created

- `migrations/0013_arrow_from_side.sql` — DB column 追加

### Modified

- `src/lib/types.ts` — `ArrowSide` 型 + `InternalArrow.fromSide`
- `src/features/editor/types.ts` — `Arrow.fromSide`
- `src/lib/arrow-routing.ts` — `deriveFromSide` 新設、`exitPt` 引数追加
- `src/lib/flow-engine.ts` — `ArrowConfig.fromSide` 追加
- `src/features/editor/FlowEditor.tsx` — ドラッグ完了時の `fromSide` 導出、`aPath` で `arrow.fromSide` を渡す
- `src/features/shared/SharedFlowViewer.tsx` — `exitPt` 呼び出しに `arrow.fromSide`
- `src/features/editor/components/RightPanel.tsx` — 「出口側」セクション追加
- `api/lib/flow-transform.ts` — `ArrowRow.from_side` + `toArrow` で `fromSide` をマップ
- `api/routes/flows.ts` — INSERT 文 2 箇所と SELECT 経路で `from_side` を扱う
- `src/locales/ja/editor.json`, `src/locales/en/editor.json` — 「出口側」「自動」「上」「右」「下」「左」キー
- `src/lib/arrow-routing.test.ts` — `deriveFromSide` / `exitPt` のテスト追加
- `src/lib/flow-engine.test.ts` — `calcArrowPath` の `fromSide` テスト追加
- `tests/api/routes/flows.test.ts` — round-trip テスト追加

### Verification only (no code change)

- `src/features/editor/png-export.ts` — SVG クローン経由なので自動的に直る

---

## Task 1: 型定義に ArrowSide を追加

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/features/editor/types.ts`

- [ ] **Step 1: `src/lib/types.ts` を編集**

`InternalArrow` の上に型を追加し、`fromSide` フィールドを追加する。最終形:

```ts
/** ひし形ノードの接続元として使う頂点/辺。未指定なら自動（ターゲット方向から推定）。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'

/** 内部矢印データ（DOM/React非依存） */
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
  /** 接続元ノードのどの頂点/辺から線を出すか。diamond ノードのみ意味を持つ。 */
  fromSide?: ArrowSide
}

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
}
```

- [ ] **Step 2: `src/features/editor/types.ts` を編集**

冒頭の re-export 部分に `ArrowSide` を追加:

```ts
import type { InternalArrow, ArrowPathResult, ArrowSide } from '../../lib/types'
export type { InternalArrow, ArrowPathResult, ArrowSide }
```

そして `Arrow` interface に `fromSide` を追加:

```ts
export interface Arrow {
  id: string
  fromNodeId: string
  toNodeId: string
  comment: string | null
  color?: string | null
  dash?: string | null
  bidirectional?: boolean
  /** 接続元 diamond ノードの出口頂点。null/undefined なら自動。 */
  fromSide?: ArrowSide | null
}
```

- [ ] **Step 3: TypeScript の型チェックが通ることを確認**

Run: `npx tsc --noEmit`
Expected: 既存の `noEmit` チェックが pass（型追加だけなので壊さない）

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/features/editor/types.ts
git commit -m "feat(#349): add ArrowSide type and fromSide to arrow types"
```

---

## Task 2: deriveFromSide 純関数 + テスト

**Files:**

- Modify: `src/lib/arrow-routing.ts`
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テストを `src/lib/arrow-routing.test.ts` の末尾に追加**

ファイル冒頭の import を更新:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  deriveFromSide,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
```

そしてファイル末尾に describe ブロックを追加:

```ts
describe('deriveFromSide', () => {
  const c = { x: 100, y: 100 }

  it('右側にドラッグ起点 → right', () => {
    expect(deriveFromSide({ x: 134, y: 100 }, c)).toBe('right')
  })

  it('左側にドラッグ起点 → left', () => {
    expect(deriveFromSide({ x: 66, y: 100 }, c)).toBe('left')
  })

  it('下側にドラッグ起点 → bottom', () => {
    expect(deriveFromSide({ x: 100, y: 134 }, c)).toBe('bottom')
  })

  it('上側にドラッグ起点 → top', () => {
    expect(deriveFromSide({ x: 100, y: 66 }, c)).toBe('top')
  })

  it('右下斜め（横優位）→ right', () => {
    expect(deriveFromSide({ x: 130, y: 110 }, c)).toBe('right')
  })

  it('右下斜め（縦優位）→ bottom', () => {
    expect(deriveFromSide({ x: 110, y: 130 }, c)).toBe('bottom')
  })

  it('中心と一致（dx=dy=0）→ bottom フォールバック', () => {
    expect(deriveFromSide(c, c)).toBe('bottom')
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts -t deriveFromSide`
Expected: FAIL `deriveFromSide is not exported`

- [ ] **Step 3: `src/lib/arrow-routing.ts` に `deriveFromSide` を実装**

`exitPt` の export の **直前** に挿入:

```ts
/**
 * ドラッグ起点座標 (origin) とノード中心 (center) の位置関係から
 * どの side （頂点/辺）から線を出すかを判定する。
 *
 * |dx| > |dy| → 水平軸（left/right）、それ以外 → 垂直軸（top/bottom）。
 * dx=dy=0 のエッジケースは 'bottom' に決定的にフォールバックする。
 */
export const deriveFromSide = (
  origin: { x: number; y: number },
  center: { x: number; y: number },
): 'top' | 'right' | 'bottom' | 'left' => {
  const dx = origin.x - center.x
  const dy = origin.y - center.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}
```

- [ ] **Step 4: テストを実行して PASS を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts -t deriveFromSide`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#349): add deriveFromSide pure function"
```

---

## Task 3: exitPt に fromSide 引数を追加 + テスト

**Files:**

- Modify: `src/lib/arrow-routing.ts`
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テストを `src/lib/arrow-routing.test.ts` 末尾に追加**

冒頭の import に `exitPt` と `ArrowSide` 型を追加:

```ts
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  deriveFromSide,
  exitPt,
  DS,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'
import type { ArrowSide } from './types'
```

末尾に describe を追加:

```ts
describe('exitPt with explicit fromSide (diamond)', () => {
  const c = { x: 200, y: 200 }
  const o = { x: 500, y: 500 } // ターゲット（自動ロジックなら dx>0 で 'right' になる位置）
  const hw = 76
  const hh = 28
  const rh = 84

  it('fromSide=top → 上頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'top')).toEqual({ x: 200, y: 200 - DS })
  })

  it('fromSide=right → 右頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'right')).toEqual({ x: 200 + DS, y: 200 })
  })

  it('fromSide=bottom → 下頂点（dxに関係なく）', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'bottom')).toEqual({ x: 200, y: 200 + DS })
  })

  it('fromSide=left → 左頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'left')).toEqual({ x: 200 - DS, y: 200 })
  })

  it('fromSide 未指定 → 既存の自動ロジック（後方互換）', () => {
    // dx>0, dy>0 → right
    expect(exitPt(c, o, hw, hh, rh, 'diamond')).toEqual({ x: 200 + DS, y: 200 })
  })

  it('shape が diamond でないとき fromSide は無視される', () => {
    // 通常ノードは fromSide を受けてもサイド出口の自動ロジックに従う
    const result = exitPt(c, o, hw, hh, rh, undefined, 'top' as ArrowSide)
    // dx>0, dy>0 → サイド出口（上方向）→ 下方向出口（dy>rh*0.3）
    expect(result).toEqual({ x: 200, y: 200 + hh })
  })
})
```

注: `DS` が現在 export されているか確認し、されていない場合は `export` を付ける必要がある。確認方法:

Run: `grep -n "export const DS" src/lib/arrow-routing.ts`
Expected: `export const DS = 34`（既に export されているはず。されていなければ Step 2 で export を追加）

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts -t "exitPt with explicit fromSide"`
Expected: FAIL（既存の exitPt は fromSide 引数を受け取らない）

- [ ] **Step 3: `src/lib/arrow-routing.ts` の `exitPt` を拡張**

シグネチャに `fromSide?: ArrowSide` を末尾追加。`shape === 'diamond'` 分岐の冒頭で fromSide があれば該当頂点を返す。

冒頭の import に追加:

```ts
import type { ArrowSide } from './types'
```

`exitPt` を以下に置き換え:

```ts
export const exitPt = (
  c: Point,
  o: Point,
  hw: number,
  hh: number,
  rh: number,
  shape?: 'diamond',
  fromSide?: ArrowSide,
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (fromSide === 'top') return { x: c.x, y: c.y - DS }
    if (fromSide === 'right') return { x: c.x + DS, y: c.y }
    if (fromSide === 'bottom') return { x: c.x, y: c.y + DS }
    if (fromSide === 'left') return { x: c.x - DS, y: c.y }
    if (Math.abs(dx) < 1 && dy > 0) return { x: c.x, y: c.y + DS }
    if (Math.abs(dx) < 1 && dy <= 0) return { x: c.x, y: c.y - DS }
    if (dx >= 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 同位置
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y + hh }
  // 下方向: 下部から出る
  if (dy > rh * 0.3) return { x: c.x, y: c.y + hh }
  // 上方向: 横から出る（dx の符号で左右を決定）
  if (dy < -rh * 0.3) return { x: c.x + (dx >= 0 ? hw : -hw), y: c.y }
  // 水平方向
  if (Math.abs(dx) > 1) return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  // フォールバック
  return { x: c.x, y: c.y + hh }
}
```

- [ ] **Step 4: テストを実行して全 PASS を確認**

Run: `npx vitest run src/lib/arrow-routing.test.ts`
Expected: 全テスト PASS（既存テストも引き続き通る）

- [ ] **Step 5: Commit**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#349): extend exitPt with fromSide arg for diamond nodes"
```

---

## Task 4: calcArrowPath / ArrowConfig に fromSide を追加

**Files:**

- Modify: `src/lib/flow-engine.ts`
- Modify: `src/lib/flow-engine.test.ts`

- [ ] **Step 1: `src/lib/flow-engine.test.ts` にテストを追加**

ファイル冒頭の既存 describe `calcArrowPath` の末尾 `})` の直前に以下を挿入:

```ts
it('diamond の fromSide を尊重する（右下ターゲットでも fromSide=bottom なら下頂点から出る）', () => {
  const config = {
    hw: 76,
    hh: 28,
    rh: 84,
    fromShape: 'diamond' as const,
    fromSide: 'bottom' as const,
  }
  const r = calcArrowPath({ x: 200, y: 200 }, { x: 500, y: 500 }, config)
  // exitPt(diamond, 'bottom') → {200, 234}
  // path の冒頭 M が始点
  expect(r.d.startsWith('M200,234')).toBe(true)
})

it('diamond で fromSide 未指定なら従来の自動ロジック', () => {
  const config = {
    hw: 76,
    hh: 28,
    rh: 84,
    fromShape: 'diamond' as const,
  }
  const r = calcArrowPath({ x: 200, y: 200 }, { x: 500, y: 500 }, config)
  // dx>0 → right 頂点 {234, 200}
  expect(r.d.startsWith('M234,200')).toBe(true)
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `npx vitest run src/lib/flow-engine.test.ts -t "fromSide"`
Expected: FAIL（`fromSide` プロパティが ArrowConfig にない）

- [ ] **Step 3: `src/lib/flow-engine.ts` の `ArrowConfig` と `calcArrowPath` を拡張**

冒頭の import に追加:

```ts
import type { ArrowSide } from './types'
```

`ArrowConfig` インターフェース更新:

```ts
interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
  fromSide?: ArrowSide
}
```

`calcArrowPath` の `exitPt` 呼び出しを更新:

```ts
const s = exitPt(f, t, config.hw, config.hh, config.rh, config.fromShape, config.fromSide)
```

- [ ] **Step 4: テスト全パスを確認**

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 全テスト PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat(#349): forward fromSide through calcArrowPath"
```

---

## Task 5: DB マイグレーションを追加

**Files:**

- Create: `migrations/0013_arrow_from_side.sql`

- [ ] **Step 1: 既存のマイグレーション末尾を確認**

Run: `ls migrations/ | sort -n | tail -3`
Expected: `0012_lane_groups.sql` が最新

- [ ] **Step 2: マイグレーションファイルを作成**

ファイル `migrations/0013_arrow_from_side.sql`:

```sql
-- Issue #349: 矢印に出口側 (fromSide) を持たせる
-- diamond ノードのみ意味を持つ。NULL は自動（既存ロジック）。
ALTER TABLE arrows ADD COLUMN from_side TEXT;
```

- [ ] **Step 3: ローカル DB に適用してスキーマを確認**

Run: `sqlite3 ./local.sqlite3 ".schema arrows" 2>/dev/null | head -5 || echo "local db not present, skipping"`

ローカル DB がある場合は手動適用:

```bash
sqlite3 ./local.sqlite3 < migrations/0013_arrow_from_side.sql
sqlite3 ./local.sqlite3 ".schema arrows" | grep from_side
```

Expected: `from_side TEXT` が含まれる

ローカル DB が無い場合はスキップ（CI で別途検証される）。

- [ ] **Step 4: Commit**

```bash
git add migrations/0013_arrow_from_side.sql
git commit -m "feat(#349): add from_side column to arrows table"
```

---

## Task 6: API 層に from_side のシリアライズを追加

**Files:**

- Modify: `api/lib/flow-transform.ts`
- Modify: `api/routes/flows.ts`

- [ ] **Step 1: `api/lib/flow-transform.ts` の `ArrowRow` と `toArrow` を更新**

`ArrowRow` interface に追加:

```ts
export interface ArrowRow {
  id: string
  flow_id: string
  from_node_id: string
  to_node_id: string
  comment: string | null
  color: string | null
  dash: string | null
  bidirectional: number | null
  from_side: string | null
  created_at: string
  updated_at: string
}
```

`toArrow` 関数を更新:

```ts
export function toArrow(row: ArrowRow) {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    comment: row.comment,
    color: row.color,
    dash: row.dash,
    bidirectional: row.bidirectional === 1,
    fromSide: row.from_side,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 2: `api/routes/flows.ts` の INSERT 文 2 箇所を更新**

**1 箇所目（line 291 近辺、POST `/api/flows`）**:

```ts
db
  .prepare(
    'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment, color, dash, bidirectional, from_side) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  .bind(
    arrow.id,
    flowId,
    arrow.fromNodeId,
    arrow.toNodeId,
    arrow.comment ?? null,
    arrow.color ?? null,
    arrow.dash ?? null,
    arrow.bidirectional ? 1 : 0,
    arrow.fromSide ?? null,
  ),
```

**2 箇所目（line 446 近辺、PUT `/api/flows/:id`）**: 同様に `from_side` カラムと `arrow.fromSide ?? null` バインドを追加。

- [ ] **Step 3: API の型を確認**

`arrow.fromSide` の型は `ArrowSide | null | undefined` として扱えること。`safeArrows` などの中間型がある場合はそこも追従。

Run: `grep -n "fromNodeId\|fromSide" api/routes/flows.ts | head -10`

`arrow` の型推論で `fromSide` プロパティが認識されない場合、`arrow as { fromSide?: string }` で受けるか、`api/routes/` 内で payload 型を更新する。実装時にコンパイルエラーが出れば対応する。

- [ ] **Step 4: TypeScript 型チェック**

Run: `npx tsc --noEmit -p api/tsconfig.json 2>&1 || npx tsc --noEmit 2>&1 | grep -E "error|fromSide" | head -20`
Expected: `fromSide` 関連のエラーなし

- [ ] **Step 5: Commit**

```bash
git add api/lib/flow-transform.ts api/routes/flows.ts
git commit -m "feat(#349): persist arrow.fromSide via API"
```

---

## Task 7: API round-trip テスト

**Files:**

- Modify: `tests/api/routes/flows.test.ts`

- [ ] **Step 1: テストを追加**

`should round-trip bidirectional arrow flag` の it ブロックの直後（line 559 後）に新しい it を挿入:

```ts
it('should round-trip arrow fromSide field', async () => {
  const payload = {
    title: 'FromSide Flow',
    themeId: 'cloud',
    lanes: [{ id: 'lane-1', name: 'L', colorIndex: 0, position: 0 }],
    nodes: [
      {
        id: 'node-1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: 'D',
        note: null,
        orderIndex: 0,
        shape: 'diamond',
      },
      { id: 'node-2', laneId: 'lane-1', rowIndex: 1, label: 'T', note: null, orderIndex: 1 },
    ],
    arrows: [
      {
        id: 'arrow-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        comment: null,
        fromSide: 'bottom',
      },
      {
        id: 'arrow-2',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        comment: null,
      },
    ],
  }
  const createRes = await postJson('/api/flows', payload, env, cookie)
  expect(createRes.status).toBe(201)
  const created = (await createRes.json()) as {
    flow: { id: string; arrows: Array<{ id: string; fromSide?: string | null }> }
  }
  expect(created.flow.arrows.find((a) => a.id === 'arrow-1')?.fromSide).toBe('bottom')
  expect(created.flow.arrows.find((a) => a.id === 'arrow-2')?.fromSide ?? null).toBe(null)

  const getRes = await getWithCookie(`/api/flows/${created.flow.id}`, env, cookie)
  expect(getRes.status).toBe(200)
  const got = (await getRes.json()) as typeof created
  expect(got.flow.arrows.find((a) => a.id === 'arrow-1')?.fromSide).toBe('bottom')
  expect(got.flow.arrows.find((a) => a.id === 'arrow-2')?.fromSide ?? null).toBe(null)
})
```

- [ ] **Step 2: テストを実行して PASS を確認**

Run: `npx vitest run tests/api/routes/flows.test.ts -t fromSide`
Expected: PASS

Note: テスト用 DB のスキーマがマイグレーションを自動適用していない場合は FAIL する。その場合は `tests/api/routes/flows.test.ts` で使われている `Database` helper（`tests/helpers/` 配下）を確認し、マイグレーション 0013 が適用されるようにする。テストの fixture 構築箇所を探す:

Run: `grep -rn "0012\|migrations" tests/helpers/ tests/api/ 2>/dev/null | head -10`

- [ ] **Step 3: Commit**

```bash
git add tests/api/routes/flows.test.ts
git commit -m "test(#349): round-trip arrow.fromSide via API"
```

---

## Task 8: FlowEditor で arrow.fromSide を描画に渡す

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: `aPath` 関数の `calcArrowPath` 呼び出しに `fromSide` を渡す**

`src/features/editor/FlowEditor.tsx:1425` の `calcArrowPath(...)` 呼び出しを以下に変更:

```ts
return calcArrowPath(
  from,
  to,
  {
    hw: TW / 2,
    hh: TH / 2,
    rh: RH,
    fromShape: ft.shape ?? undefined,
    toShape: tt.shape ?? undefined,
    fromSide: arrow.fromSide,
  },
  obstacles,
)
```

- [ ] **Step 2: 既存のエディタテストが壊れていないことを確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#349): pass arrow.fromSide through aPath in FlowEditor"
```

---

## Task 9: ドラッグ完了時に fromSide を導出

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: import を追加**

`FlowEditor.tsx` 冒頭、`arrow-routing` からの import に `deriveFromSide` を追加。既存:

```ts
// arrow-routing の import 行を探して deriveFromSide を追加
```

Run: `grep -n "from '\.\./\.\./lib/arrow-routing'" src/features/editor/FlowEditor.tsx`

該当 import を編集して `deriveFromSide` を追加。

- [ ] **Step 2: `FlowEditor.tsx:1044` のドラッグ完了処理を更新**

該当箇所:

```ts
if (Math.abs(pt.x - c.x) < snapX && Math.abs(pt.y - c.y) < snapY && k !== connectFrom) {
  setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
  break
}
```

を以下に変更:

```ts
if (Math.abs(pt.x - c.x) < snapX && Math.abs(pt.y - c.y) < snapY && k !== connectFrom) {
  const srcTask = tasks[connectFrom]
  let fromSide: ArrowSide | undefined
  if (srcTask?.shape === 'diamond' && connectFromPt) {
    const srcLi = liMap[srcTask.lid]
    const srcRi = riMap[srcTask.rid]
    if (srcLi !== undefined && srcRi !== undefined) {
      const sc = ct(srcLi, srcRi)
      fromSide = deriveFromSide(connectFromPt, sc)
    }
  }
  setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '', fromSide }])
  break
}
```

`ArrowSide` 型の import が必要。同じファイル冒頭で `types` から import している場所に追加:

```ts
import type { ..., ArrowSide } from './types'
```

(具体的なファイル内 import 位置は実装時に `grep -n "from './types'" src/features/editor/FlowEditor.tsx` で確認)

- [ ] **Step 3: 既存テストが壊れていないことを確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全テスト PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#349): derive fromSide on connect drag completion"
```

---

## Task 10: SharedFlowViewer で fromSide を渡す

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx`

- [ ] **Step 1: `exitPt` の呼び出しに `arrow.fromSide` を渡す**

`SharedFlowViewer.tsx:130` 近辺を確認:

Run: `sed -n '125,135p' src/features/shared/SharedFlowViewer.tsx`

該当行:

```ts
const s = exitPt(f, t, hw, hh, RH, fromNode.shape as 'diamond' | undefined)
```

を以下に変更:

```ts
const s = exitPt(
  f,
  t,
  hw,
  hh,
  RH,
  fromNode.shape as 'diamond' | undefined,
  arrow.fromSide ?? undefined,
)
```

注: SharedFlowViewer 側で `arrow` 変数が指す型を確認。`InternalArrow` または `Arrow` のどちらか。`Arrow.fromSide` は `string | null | undefined` なので `?? undefined` で正規化。

- [ ] **Step 2: 共有ビューア起動して確認は Task 13（Playwright）で行うので、ここではビルドだけ確認**

Run: `npx tsc --noEmit 2>&1 | grep -E "fromSide|SharedFlowViewer" | head -10`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#349): honor arrow.fromSide in SharedFlowViewer"
```

---

## Task 11: i18n キー追加

**Files:**

- Modify: `src/locales/ja/editor.json`
- Modify: `src/locales/en/editor.json`

- [ ] **Step 1: 日本語キーを `src/locales/ja/editor.json` に追加**

`"arrowStyle": "線の種類",` の **直後** に以下を挿入（既存の Bidirectional より前）:

```json
    "arrowFromSide": "出口側",
    "arrowSideAuto": "自動",
    "arrowSideTop": "上",
    "arrowSideRight": "右",
    "arrowSideBottom": "下",
    "arrowSideLeft": "左",
```

- [ ] **Step 2: 英語キーを `src/locales/en/editor.json` に追加**

`"arrowStyle": "Line style",` の直後:

```json
    "arrowFromSide": "Exit side",
    "arrowSideAuto": "Auto",
    "arrowSideTop": "Top",
    "arrowSideRight": "Right",
    "arrowSideBottom": "Bottom",
    "arrowSideLeft": "Left",
```

- [ ] **Step 3: JSON 構文が valid なことを確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/ja/editor.json'))" && node -e "JSON.parse(require('fs').readFileSync('src/locales/en/editor.json'))" && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/locales/ja/editor.json src/locales/en/editor.json
git commit -m "feat(#349): add i18n keys for arrow fromSide selector"
```

---

## Task 12: プロパティパネルに「出口側」UI を追加

**Files:**

- Modify: `src/features/editor/components/RightPanel.tsx`

- [ ] **Step 1: 現在の arrow 編集パネルの該当位置を確認**

Run: `grep -n "rightPanel.arrowStyle\|rightPanel.operations" src/features/editor/components/RightPanel.tsx`

`arrowStyle` の PanelSection と `operations` の PanelSection の **間** に、新しい PanelSection を挿入する。

- [ ] **Step 2: `RightPanel.tsx` の該当箇所に UI を追加**

`<PanelSection label={t('rightPanel.arrowStyle')}>` のクローズタグ `</PanelSection>` の **直後**、`<PanelSection label={t('rightPanel.operations')}>` の **直前** に以下を挿入:

```tsx
{
  tasks[selArrowData.from]?.shape === 'diamond' && (
    <PanelSection label={t('rightPanel.arrowFromSide')}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[
          { id: 'auto', value: undefined, label: t('rightPanel.arrowSideAuto') },
          { id: 'top', value: 'top' as const, label: t('rightPanel.arrowSideTop') },
          { id: 'right', value: 'right' as const, label: t('rightPanel.arrowSideRight') },
          { id: 'bottom', value: 'bottom' as const, label: t('rightPanel.arrowSideBottom') },
          { id: 'left', value: 'left' as const, label: t('rightPanel.arrowSideLeft') },
        ].map((opt) => {
          const isActive =
            opt.value === undefined ? !selArrowData.fromSide : selArrowData.fromSide === opt.value
          return (
            <div
              key={opt.id}
              onClick={() =>
                setArrows((p) =>
                  p.map((a) => (a.id === selArrow ? { ...a, fromSide: opt.value } : a)),
                )
              }
              style={{
                flex: 1,
                minWidth: 36,
                height: 30,
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive ? (isDark ? '#333' : '#F0EBFF') : 'transparent',
                border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: isActive ? T.accent : T.panelText,
                transition: 'all 0.1s',
              }}
            >
              {opt.label}
            </div>
          )
        })}
      </div>
    </PanelSection>
  )
}
```

注: `isDark`, `T` (theme) は既に同 `RightPanel.tsx` のスコープで使われている。使えない場合は周囲のコードを参考に同じ書き方で取り出す。

- [ ] **Step 3: 型を確認**

`selArrowData.fromSide` の型が `ArrowSide | undefined` として扱えること。`InternalArrow.fromSide` が optional になっているので OK のはず。

Run: `npx tsc --noEmit 2>&1 | grep -E "RightPanel|fromSide" | head -10`
Expected: エラーなし

- [ ] **Step 4: 既存のテストが壊れていないことを確認**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/components/RightPanel.tsx
git commit -m "feat(#349): add fromSide selector to arrow property panel"
```

---

## Task 13: 実画面検証（Playwright / Chrome DevTools）

**Files:**

- (なし、目視検証のみ)

- [ ] **Step 1: ローカル dev を起動**

Run: `npm run dev` （または `~/.claude/skills/preview/SKILL.md` 参照）
Expected: dev server 起動

- [ ] **Step 2: ログインしてエディタへ**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン。
新規フローを作成し、エディタを開く。

- [ ] **Step 3: 検証ケース 1 - 下ハンドルから引いた線が下頂点から出る**

1. ひし形ノード（shape を diamond に切り替え可能。既存 UI で shape 設定）を作成
2. 別ノードを右下のセルに作成
3. ひし形ノードを選択し、表示された 4 つの接続ハンドルのうち **下のハンドル** をドラッグ
4. 右下ノードまでドラッグして接続
5. 矢印が **下頂点** から出ていることを目視確認

スクリーンショットを `.screenshots/issue-349-bottom.png` に保存。

- [ ] **Step 4: 検証ケース 2 - 右ハンドルから引いた線が右頂点から出る**

同じソースから今度は **右のハンドル** をドラッグして別の右下ノードへ接続。
矢印が **右頂点** から出ていることを目視確認。
スクリーンショットを `.screenshots/issue-349-right.png` に保存。

- [ ] **Step 5: 検証ケース 3 - プロパティパネルで「自動」に戻す**

下ハンドルから引いた矢印を選択し、右ペインの「出口側」セレクタで「自動」をクリック。
矢印の起点が自動ロジック（dx>0 で右頂点）に戻ることを確認。

- [ ] **Step 6: 検証ケース 4 - 共有ビューで一致**

「共有」を有効化して共有 URL を取得。新タブで開き、エディタと矢印の起点が **完全一致** することを確認。

- [ ] **Step 7: 検証ケース 5 - PNG エクスポート**

エディタからエクスポート→PNG。生成された PNG で矢印起点が画面表示と一致することを確認。

- [ ] **Step 8: 検証ケース 6 - 既存矢印は影響なし**

別のフローでひし形を使わない既存矢印が従来通り描画されることを軽くチェック。

- [ ] **Step 9: LCP 確認**

エディタを開いたときの LCP が 1 秒以内に収まることを Chrome DevTools の Performance で確認（CLAUDE.md ルール）。

- [ ] **Step 10: バグがあれば該当 Task に戻って修正、テストを更新**

- [ ] **Step 11: 検証メモを残す**

スクリーンショット 3-4 枚を `.screenshots/` に残し、サマリーをコミットメッセージに残す（必要ならコミット）。

---

## Task 14: 全テスト & ビルド最終確認

**Files:**

- (確認のみ)

- [ ] **Step 1: 全テスト実行**

Run: `npm test`
Expected: 全テスト PASS

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: エラーなし（既存 warning は許容）

- [ ] **Step 4: 本番ビルドが通ることを確認**

`~/.claude/skills/preview/SKILL.md` 参照。

Run: `npm run build`
Expected: ビルド成功

---

## Task 15: 最新 main 同期 & PR

**Files:**

- (なし)

- [ ] **Step 1: main を fetch & rebase**

```bash
git fetch origin
git pull origin main --rebase
npm test
```

Expected: 全テスト PASS

- [ ] **Step 2: push & PR**

```bash
git push -u origin fix/issue-349-diamond-fromside
gh pr create --title "fix(#349): diamond ノードの fromSide を保存して描画に反映" --body "$(cat <<'EOF'
## Summary
- ひし形ノードのドラッグ起点ハンドルを `fromSide` として永続化
- `exitPt` を拡張し、`fromSide` 指定時はその頂点から線を出す
- プロパティパネルに「出口側」セレクタ（自動 / 上 / 右 / 下 / 左）を追加
- 既存矢印は `fromSide` 未指定で従来動作を維持（後方互換）
- 共有ビュー & PNG エクスポートでも一貫

Closes #349

## Test plan
- [x] `deriveFromSide` 単体テスト
- [x] `exitPt(fromSide=...)` 単体テスト
- [x] `calcArrowPath` の fromSide round-trip
- [x] API round-trip テスト
- [x] ひし形 → 右下ノード（下/右ハンドル）の挙動を Playwright 目視確認
- [x] 共有ビューア & PNG エクスポートの一致確認
- [x] 既存矢印が影響を受けないことを確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI watch**

```bash
gh pr checks --watch
```

全 pass を確認。

- [ ] **Step 4: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 5: レビュー修正ループ（CLAUDE.md Workflow Step 9 参照）**

---

## Self-Review Notes

- **Spec coverage**: 全ての spec 項目（型, derive, exitPt, calcArrowPath, DB, API, UI, 共有ビュー）に対応する Task が存在 ✓
- **Placeholder scan**: 「実装時に確認」が 1-2 箇所あるが、いずれも `grep` コマンド付きで即解決できる軽い未知数。本質的な placeholder ではない ✓
- **Type consistency**: `ArrowSide` は `src/lib/types.ts` で定義し、`Arrow.fromSide`, `InternalArrow.fromSide`, `ArrowConfig.fromSide`, `exitPt` 引数で一貫使用 ✓
- **Naming consistency**: `deriveFromSide` / `fromSide` / `from_side` (DB) で揃えている ✓
