# toSide + 四角形ノード side 指定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 矢印に `toSide` を追加し、四角形ノードでも `fromSide`/`toSide` を honor するようにする。UI に「入口側」セレクタを追加。

**Architecture:**

- `shared/ArrowSide` 型を使い回し、`InternalArrow.toSide` フィールドを追加
- `exitPt` / `entryPt` の四角形分岐にも fromSide / toSide 早期 return を入れる
- `deriveToSide = deriveFromSide`（数学的に同一）
- DB に `to_side TEXT` カラム追加、API ラウンドトリップ完備
- RightPanel の「出口側」 diamond ガードを撤廃、「入口側」セクションを追加

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Workers D1, Zod, i18next

**Spec:** [docs/superpowers/specs/2026-05-22-toside-rect-design.md](../specs/2026-05-22-toside-rect-design.md)

**Issue:** #355

---

## Task 1: arrow-routing 拡張（TDD）

**Files:**

- Modify: `src/lib/arrow-routing.ts`
- Modify: `src/lib/arrow-routing.test.ts`

### Step 1: 失敗するテストを書く（exitPt 四角形 + fromSide）

`src/lib/arrow-routing.test.ts` の `exitPt` describe ブロック内に追加:

```ts
describe('exitPt 四角形ノード fromSide honor', () => {
  const c = { x: 100, y: 100 }
  const o = { x: 200, y: 100 } // 任意の相手位置
  const hw = 50,
    hh = 25,
    rh = 84
  it('四角形 + fromSide=top → 上辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'top')).toEqual({ x: 100, y: 75 })
  })
  it('四角形 + fromSide=right → 右辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'right')).toEqual({ x: 150, y: 100 })
  })
  it('四角形 + fromSide=bottom → 下辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'bottom')).toEqual({ x: 100, y: 125 })
  })
  it('四角形 + fromSide=left → 左辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'left')).toEqual({ x: 50, y: 100 })
  })
  it('四角形 + fromSide=undefined → 既存の auto ロジック (右向き)', () => {
    // dx > 0 で水平方向 → 右辺
    expect(exitPt(c, o, hw, hh, rh, undefined, undefined)).toEqual({ x: 150, y: 100 })
  })
})
```

Run: `npx vitest run src/lib/arrow-routing.test.ts -t "exitPt 四角形ノード fromSide honor"`
Expected: 4 件 FAIL（"toEqual" assertion 不一致、auto ケースは現状ロジックで PASS）

### Step 2: 失敗するテストを書く（entryPt toSide）

同じく `arrow-routing.test.ts` に追加:

```ts
describe('entryPt toSide honor', () => {
  const c = { x: 100, y: 100 }
  const o = { x: 200, y: 100 }
  const hw = 50,
    hh = 25,
    rh = 84
  it('四角形 + toSide=top → 上辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'top')).toEqual({ x: 100, y: 75 })
  })
  it('四角形 + toSide=right → 右辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'right')).toEqual({ x: 150, y: 100 })
  })
  it('四角形 + toSide=bottom → 下辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'bottom')).toEqual({ x: 100, y: 125 })
  })
  it('四角形 + toSide=left → 左辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'left')).toEqual({ x: 50, y: 100 })
  })
  it('diamond + toSide=top → 上頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'top')).toEqual({ x: 100, y: 100 - 30 })
  })
  it('diamond + toSide=left → 左頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'left')).toEqual({ x: 100 - 30, y: 100 })
  })
  it('toSide=undefined → 既存 auto ロジック (左向きから来る場合は右辺)', () => {
    // o.x > c.x → 既存ロジック (dy~0, dx>0 → 右辺)
    expect(entryPt(c, o, hw, hh, rh, undefined, undefined)).toEqual({ x: 150, y: 100 })
  })
})
```

注: `DS` は `src/lib/arrow-routing.ts` の定数（=30）。テストファイル冒頭の import から取得可能。

Run: `npx vitest run src/lib/arrow-routing.test.ts -t "entryPt toSide honor"`
Expected: テスト宣言箇所で TypeScript エラー（entryPt は現状 6 引数）。compile-time fail。

### Step 3: 失敗するテストを書く（deriveToSide）

```ts
describe('deriveToSide', () => {
  it('deriveFromSide と同一の結果を返す', () => {
    const origin = { x: 110, y: 90 }
    const center = { x: 100, y: 100 }
    expect(deriveToSide(origin, center)).toBe(deriveFromSide(origin, center))
  })
  it('右上にドロップ → "top"（|dy| > |dx| かつ dy<0）', () => {
    expect(deriveToSide({ x: 105, y: 70 }, { x: 100, y: 100 })).toBe('top')
  })
  it('右下にドロップ → "right"（|dx| > |dy|）', () => {
    expect(deriveToSide({ x: 140, y: 110 }, { x: 100, y: 100 })).toBe('right')
  })
})
```

Run: 同上
Expected: `deriveToSide` 未定義で fail

### Step 4: 実装

`src/lib/arrow-routing.ts` の `exitPt` を以下のように変更:

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

  // 四角形でも fromSide があれば優先
  if (fromSide === 'top') return { x: c.x, y: c.y - hh }
  if (fromSide === 'right') return { x: c.x + hw, y: c.y }
  if (fromSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (fromSide === 'left') return { x: c.x - hw, y: c.y }

  // 同位置
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y + hh }
  // 下方向
  if (dy > rh * 0.3) return { x: c.x, y: c.y + hh }
  // 上方向
  if (dy < -rh * 0.3) return { x: c.x + (dx >= 0 ? hw : -hw), y: c.y }
  // 水平方向
  if (Math.abs(dx) > 1) return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  // フォールバック
  return { x: c.x, y: c.y + hh }
}
```

`entryPt` を以下のように変更:

```ts
export const entryPt = (
  c: Point,
  o: Point,
  hw: number,
  hh: number,
  rh: number,
  shape?: 'diamond',
  toSide?: ArrowSide,
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (toSide === 'top') return { x: c.x, y: c.y - DS }
    if (toSide === 'right') return { x: c.x + DS, y: c.y }
    if (toSide === 'bottom') return { x: c.x, y: c.y + DS }
    if (toSide === 'left') return { x: c.x - DS, y: c.y }
    if (dy < -rh * 0.3) return { x: c.x, y: c.y - DS }
    if (dy > rh * 0.3) return { x: c.x, y: c.y + DS }
    if (dx > 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 四角形でも toSide があれば優先
  if (toSide === 'top') return { x: c.x, y: c.y - hh }
  if (toSide === 'right') return { x: c.x + hw, y: c.y }
  if (toSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (toSide === 'left') return { x: c.x - hw, y: c.y }

  // 同位置
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y - hh }
  // 上方向から
  if (dy < -rh * 0.3) return { x: c.x, y: c.y - hh }
  // 下方向から
  if (dy > rh * 0.3) return { x: c.x + (dx >= 0 ? hw : -hw), y: c.y }
  // 水平方向
  if (Math.abs(dx) > 1) return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  // フォールバック
  return { x: c.x, y: c.y - hh }
}
```

`deriveToSide` を `deriveFromSide` の直後に追加:

```ts
/** ドロップ点とターゲットノード中心から接続先 side を判定する。deriveFromSide と同一ロジック。 */
export const deriveToSide = deriveFromSide
```

### Step 5: 全テスト pass を確認

Run: `npm test`
Expected: 既存全テスト + 新規 14 テスト pass

### Step 6: コミット

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "feat(#355): extend exitPt/entryPt to honor fromSide/toSide for rectangles + add deriveToSide"
```

---

## Task 2: flow-engine.ts の calcArrowPath 拡張（TDD）

**Files:**

- Modify: `src/lib/flow-engine.ts`
- Modify: `src/lib/flow-engine.test.ts`

### Step 1: 失敗するテストを書く

`src/lib/flow-engine.test.ts` の `describe('calcArrowPath', ...)` 内に追加:

```ts
it('toSide=top で四角形ターゲットの上辺に入る', () => {
  const from = { x: 100, y: 50 }
  const to = { x: 200, y: 200 }
  const result = calcArrowPath(from, to, {
    hw: 50,
    hh: 25,
    rh: 84,
    toSide: 'top' as const,
  })
  // path d 文字列に上辺中央 (200, 175) が含まれること
  expect(result.d).toMatch(/200[,\s]175/)
})

it('diamond の toSide=left を尊重する', () => {
  const from = { x: 100, y: 50 }
  const to = { x: 200, y: 100 }
  const result = calcArrowPath(from, to, {
    hw: 50,
    hh: 25,
    rh: 84,
    toShape: 'diamond' as const,
    toSide: 'left' as const,
  })
  // DS=30 → 左頂点 (170, 100)
  expect(result.d).toMatch(/170[,\s]100/)
})
```

Run: `npx vitest run src/lib/flow-engine.test.ts -t "calcArrowPath"`
Expected: TypeScript エラー（ArrowConfig に toSide なし）→ fail

### Step 2: 実装

`src/lib/flow-engine.ts` の `ArrowConfig` を変更:

```ts
interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
  fromSide?: ArrowSide
  toSide?: ArrowSide // 新規
}
```

`calcArrowPath` 内部の `entryPt` 呼び出し:

```ts
const e = entryPt(t, f, config.hw, config.hh, config.rh, config.toShape, config.toSide)
```

### Step 3: テスト pass 確認

Run: `npx vitest run src/lib/flow-engine.test.ts`
Expected: 新規 2 テスト含めて pass

### Step 4: コミット

```bash
git add src/lib/flow-engine.ts src/lib/flow-engine.test.ts
git commit -m "feat(#355): plumb toSide through calcArrowPath ArrowConfig"
```

---

## Task 3: InternalArrow に toSide 追加 + DB マイグレーション

**Files:**

- Modify: `src/lib/types.ts`
- Create: `migrations/0014_arrow_to_side.sql`

### Step 1: 型に toSide を追加

`src/lib/types.ts` の `InternalArrow` に行を追加:

```ts
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
  /** 接続元ノードのどの頂点/辺から線を出すか。未指定なら自動。 */
  fromSide?: ArrowSide
  /** 接続先ノードのどの頂点/辺に線を入れるか。未指定なら自動。 */
  toSide?: ArrowSide
}
```

### Step 2: マイグレーションファイル作成

Create `migrations/0014_arrow_to_side.sql`:

```sql
-- Issue #355: 矢印に入口側 (toSide) を持たせる
-- diamond/四角形どちらでも意味を持つ。NULL は自動（既存ロジック）。
ALTER TABLE arrows ADD COLUMN to_side TEXT;
```

### Step 3: 型チェック pass

Run: `npx tsc -b --pretty`
Expected: エラーなし

### Step 4: コミット

```bash
git add src/lib/types.ts migrations/0014_arrow_to_side.sql
git commit -m "feat(#355): add toSide field to InternalArrow + DB migration"
```

---

## Task 4: API ラウンドトリップ対応

**Files:**

- Modify: `api/lib/flow-transform.ts`
- Modify: `api/lib/validators.ts`
- Modify: `api/routes/flows.ts`

### Step 1: ArrowRow と toArrow に toSide 追加

`api/lib/flow-transform.ts`:

```ts
export interface ArrowRow {
  // ... 既存 ...
  from_side: ArrowSide | null
  to_side: ArrowSide | null // 新規
  created_at: string
  updated_at: string
}

export function toArrow(row: ArrowRow) {
  return {
    // ... 既存 ...
    fromSide: row.from_side,
    toSide: row.to_side, // 新規
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

### Step 2: Zod schema に toSide 追加

`api/lib/validators.ts` の `arrowSchema`:

```ts
const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  dash: z.string().nullable().optional(),
  bidirectional: z.boolean().optional(),
  fromSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
  toSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(), // 新規
})
```

### Step 3: INSERT 文 2 箇所に to_side を追加

`api/routes/flows.ts:291` および :447 の INSERT 文を以下のように変更:

```sql
INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment, color, dash, bidirectional, from_side, to_side) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

それぞれの bind に `arrow.toSide ?? null` を追加（`arrow.fromSide ?? null` の直後）。

### Step 4: 型チェック + テスト pass

Run: `npx tsc -b --pretty && npm test`
Expected: pass

### Step 5: コミット

```bash
git add api/lib/flow-transform.ts api/lib/validators.ts api/routes/flows.ts
git commit -m "feat(#355): API round-trip support for toSide"
```

---

## Task 5: FlowEditor のドラッグ完了処理を拡張

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

### Step 1: 接続元の diamond ガード撤廃 + toSide 派生

`FlowEditor.tsx:1062-1072` 周辺を以下に変更:

```ts
if (Math.abs(pt.x - c.x) < snapX && Math.abs(pt.y - c.y) < snapY && k !== connectFrom) {
  const srcTask = tasks[connectFrom]
  // 接続元 fromSide: shape 不問
  let fromSide: ArrowSide | undefined
  if (connectFromPt && srcTask) {
    const srcLi = liMap[srcTask.lid]
    const srcRi = riMap[srcTask.rid]
    if (srcLi !== undefined && srcRi !== undefined) {
      const sc = ct(srcLi, srcRi)
      fromSide = deriveFromSide(connectFromPt, sc)
    }
  }
  // 接続先 toSide: ドロップ点とターゲットノード中心から
  const toSide: ArrowSide | undefined = deriveToSide(pt, c)
  setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '', fromSide, toSide }])
  break
}
```

import に `deriveToSide` を追加。

### Step 2: calcArrowPath 呼び出しに toSide を渡す

`FlowEditor.tsx:1442` 周辺の calcArrowPath:

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
    toSide: arrow.toSide, // 新規
  },
  obstacles,
)
```

### Step 3: load/save transform に toSide を含める

`FlowEditor.tsx:144` 周辺（load 時）:

```ts
if (a.fromSide) arr.fromSide = a.fromSide
if (a.toSide) arr.toSide = a.toSide
```

`FlowEditor.tsx:215` 周辺（save 時）:

```ts
fromSide: a.fromSide ?? null,
toSide: a.toSide ?? null,
```

### Step 4: 型チェック + テスト pass

Run: `npx tsc -b --pretty && npm test`
Expected: pass

### Step 5: コミット

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#355): derive and persist toSide on drag completion"
```

---

## Task 6: SharedFlowViewer に toSide パススルー

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx`

### Step 1: calcArrowPath 呼び出しに toSide を追加

`src/features/shared/SharedFlowViewer.tsx` の computeArrowPath 内 calcArrowPath:

```ts
return calcArrowPath(
  f,
  t,
  {
    hw,
    hh,
    rh: RH,
    fromShape: fromNode.shape as 'diamond' | undefined,
    toShape: toNode.shape as 'diamond' | undefined,
    fromSide: arrow.fromSide ?? undefined,
    toSide: arrow.toSide ?? undefined, // 新規
  },
  obstacles,
)
```

### Step 2: テスト pass

Run: `npm test`
Expected: pass

### Step 3: コミット

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#355): pass toSide through SharedFlowViewer calcArrowPath"
```

---

## Task 7: RightPanel に「入口側」セクション追加 + diamond ガード撤廃

**Files:**

- Modify: `src/features/editor/components/RightPanel.tsx`
- Modify: `src/locales/ja/editor.json`
- Modify: `src/locales/en/editor.json`

### Step 1: i18n キー追加

`src/locales/ja/editor.json` の `rightPanel` セクションに追加:

```json
"arrowToSide": "入口側"
```

`src/locales/en/editor.json` 同様:

```json
"arrowToSide": "Entry side"
```

### Step 2: RightPanel.tsx の diamond ガード撤廃

`src/features/editor/components/RightPanel.tsx:655` を変更:

Before:

```tsx
{
  tasks[selArrowData.from]?.shape === 'diamond' && (
    <PanelSection label={t('rightPanel.arrowFromSide')}>...</PanelSection>
  )
}
```

After:

```tsx
<PanelSection label={t('rightPanel.arrowFromSide')}>...</PanelSection>
```

### Step 3: 「入口側」セクションを直下に追加

「出口側」 PanelSection の直後に以下を追加（fromSide のコピペで toSide 用に書き換え）:

```tsx
<PanelSection label={t('rightPanel.arrowToSide')}>
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {[
      { id: 'auto', value: undefined, label: t('rightPanel.arrowSideAuto') },
      { id: 'top', value: 'top' as const, label: t('rightPanel.arrowSideTop') },
      { id: 'right', value: 'right' as const, label: t('rightPanel.arrowSideRight') },
      { id: 'bottom', value: 'bottom' as const, label: t('rightPanel.arrowSideBottom') },
      { id: 'left', value: 'left' as const, label: t('rightPanel.arrowSideLeft') },
    ].map((opt) => {
      const isActive =
        opt.value === undefined ? !selArrowData.toSide : selArrowData.toSide === opt.value
      return (
        <div
          key={opt.id}
          onClick={() =>
            setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, toSide: opt.value } : a)))
          }
          style={
            {
              /* 同じスタイル */
            }
          }
        >
          {opt.label}
        </div>
      )
    })}
  </div>
</PanelSection>
```

### Step 4: 型チェック + テスト pass

Run: `npx tsc -b --pretty && npm test`
Expected: pass

### Step 5: コミット

```bash
git add src/features/editor/components/RightPanel.tsx src/locales/ja/editor.json src/locales/en/editor.json
git commit -m "feat(#355): RightPanel show fromSide/toSide for any shape + add 入口側 selector"
```

---

## Task 8: 全体検証

**Files:** なし

### Step 1: フルテスト・ビルド

Run:

```bash
npm test
npm run build
npx tsc -b --pretty
npx prettier --check .
```

Expected: 全 pass

### Step 2: dev サーバで動作確認

`npm run dev` を起動。以下を確認:

- 矢印を選択 → プロパティパネルに「出口側」「入口側」両方表示
- 四角形ノード間矢印で「出口側」を「右」に変更 → 即時反映
- ひし形ノード → 四角形ノードの矢印で「入口側=左」 → 左辺中央から入る
- 既存矢印（toSide/fromSide null）は変化なし
- 共有 URL を別タブで開き、エディタと完全一致

スクリーンショットを `.screenshots/355-*.png` に保存。

### Step 3: LCP 確認

DevTools Performance で LCP ≤ 1 秒。

---

## Task 9: PR & レビュー & Merge

CLAUDE.md workflow Step 7-11 に従う。

- `git pull origin main --rebase && npm test`
- push & `gh pr create`（title: `feat(#355): add toSide and rectangle side support`）
- `gh pr checks --watch`
- `@claude` レビュー依頼
- 判定 [C:承認OK] まで修正ループ
- merge → main 更新 → デプロイ確認
- worktree remove + branch -d

### PR description template

```markdown
## Summary

- `toSide` を矢印データに追加（ドラッグ完了時のドロップ位置から自動派生）
- 四角形ノードでも `fromSide` / `toSide` を honor（従来は diamond 限定）
- プロパティパネルの「出口側」 diamond ガード撤廃 → 矢印選択中は常に表示
- 「入口側」セレクタを新規追加（diamond/四角形どちらでも表示）
- DB マイグレーション 0014: `arrows.to_side` カラム追加
- API ラウンドトリップ（Zod / INSERT / toArrow / ArrowRow）
- `shared/types.ts` の `ArrowSide` を継続活用（#357 で集約済み）

## 後方互換

- 既存矢印（fromSide/toSide=NULL）は従来の auto ロジックのまま
- ひし形 fromSide のみ指定の既存矢印も挙動不変

## Closes #355
```
