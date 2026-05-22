# 斜め矢印 shift-my range check 失敗時のフォールバック修正

- **Issue**: #359
- **Date**: 2026-05-22
- **Status**: Approved
- **関連**: #346 (PR #348, merged), #353 (open, 別パターン)

## 概要

斜め配置矢印 (異行 × 異レーン) のルーティングで、中間行 (`middle row`) に障害ノードがあり `shift-my` の range check (`shiftedMy >= lo && shiftedMy <= hi`) が失敗するケースで、フォールバックの `target-detour` 昇格パスが中間行障害を貫通する問題を修正する。

## 背景と問題分析

### 現状コード (`src/lib/arrow-routing.ts:213-246`)

```ts
if (middleRowHits.length > 0) {
  const downBlocked = middleRowHits.some(...)
  const upBlocked = middleRowHits.some(...)
  const goDown = !downBlocked || upBlocked
  const shiftedMy = goDown
    ? Math.max(...middleRowHits.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...middleRowHits.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  const yLow = Math.min(s.y, e.y)
  const yHigh = Math.max(s.y, e.y)
  const bboxHEst = middleRowHits[0].h
  const lo = yLow + bboxHEst / 2 + 1
  const hi = yHigh - bboxHEst / 2 - 1
  if (shiftedMy >= lo && shiftedMy <= hi) {
    return { kind: 'shift-my', my: shiftedMy }
  }
  // 範囲外 → 中央障害を targetColHit 扱いで target-detour に昇格
  const detourX = pickDetourX(middleRowHits, obstacles)
  const approachY = clampOffset(e.y, my, APPROACH_GAP)
  return { kind: 'target-detour', my, detourX, approachY }
}
```

### 再現データ

ALLFIT-電話 flow (https://flowline.six1.jp/flows/ee90cded-221c-40f9-bea6-fea19f66931f) の矢印:

```json
{
  "id": "5e634294-8d72-4a82-bd24-591af9878944",
  "from": "店舗_ステータス変更 (diamond)",
  "to": "グルプラ(2)_請求 (13)",
  "fromSide": "bottom"
}
```

行配置:

- ステータス変更 行 (source)
- 確認連絡 行 (middle, 障害: グルプラ確認連絡 node 11)
- 請求 行 (target)

`fromSide: "bottom"` で source 出口が `DS=34` 下にずれているため、ステータス変更 → 請求の Y 距離が圧縮され、`shift-my` の `shiftedMy` が `hi` を超えて range check が失敗する。

### バグの本質

`target-detour` kind の SVG パス:

```
M(s.x, s.y) → L(s.x, my) → L(detourX, my) → L(detourX, approachY) → L(e.x, approachY) → L(e.x, e.y)
```

中央水平セグメント `L(s.x, my) → L(detourX, my)` は Y=`my` (中間行) を走る。`detourX = obstacleMaxX + bboxW/2 + DETOUR_MARGIN` (右迂回) のとき、`s.x < obstacle.x < detourX` のため**障害ノードを横断する**。

## 観察: kind 間の幾何学的非対称性

中央水平セグメントの長さが kind ごとに異なる:

| kind            | Y=my の水平セグメント | 区間            |
| --------------- | --------------------- | --------------- |
| `target-detour` | 長い                  | `s.x → detourX` |
| `source-detour` | 短い                  | `detourX → e.x` |

中間行障害が `min(s.x, e.x) < obstacle.x < max(s.x, e.x)` に位置する場合、
detourX は障害の左右どちらかに `DETOUR_MARGIN` 取られる。判定は
**「`[detourX, e.x]` 区間（source-detour 中央水平）が障害区間
`[obsLeft, obsRight]` と重ならないか」** で行う。`s.x` と `e.x` の前後関係には依存しない:

- 左→右 (`s.x < e.x`) + 右迂回: `[detourX, e.x]` が障害右側 → `source-detour` ✓
- 左→右 (`s.x < e.x`) + 左迂回: `[detourX, e.x]` が障害を横断 → `target-detour` ✓
- 右→左 (`s.x > e.x`) + 右迂回: `[detourX, e.x]`（= `[e.x, detourX]`）が障害を横断 → `target-detour` ✓
- 右→左 (`s.x > e.x`) + 左迂回: `[detourX, e.x]` が障害左側 → `source-detour` ✓

幾何ベースの直接判定なので方向に関わらず一貫した結果が得られる。

## 設計

### 1. 修正箇所

`src/lib/arrow-routing.ts` の `detectDiagonalDetour` 関数、`L243-245` のフォールバックブロックのみ。

### 2. 修正後ロジック

```ts
// 範囲外 → 中央水平セグメントが中間行障害を避けるよう kind を決める。
// source-detour 中央水平 [detourX, e.x] が障害区間と重ならなければ source-detour、
// そうでなければ target-detour 中央水平 [s.x, detourX] が片側に収まる。
const detourX = pickDetourX(middleRowHits, obstacles)
const obsRight = Math.max(...middleRowHits.map((o) => o.x + o.w / 2))
const obsLeft = Math.min(...middleRowHits.map((o) => o.x - o.w / 2))
const sourceLow = Math.min(detourX, e.x)
const sourceHigh = Math.max(detourX, e.x)
const sourceDetourClear = sourceLow >= obsRight || sourceHigh <= obsLeft
if (sourceDetourClear) {
  const departY = clampOffset(s.y, my, DEPART_GAP)
  return { kind: 'source-detour', departY, detourX, my }
}
const approachY = clampOffset(e.y, my, APPROACH_GAP)
return { kind: 'target-detour', my, detourX, approachY }
```

### 3. 非侵襲性

- 既存の 4 kind の path 生成ロジック (`L405-433` の `switch`) は**変更しない**
- `pickDetourX` も**変更しない**
- shift-my の range check も**変更しない**
- 影響範囲は `detectDiagonalDetour` の 1 ブロックのみ

### 4. データフロー図

```
detectDiagonalDetour(s, e, obstacles)
  │
  ├─ sourceColHits, targetColHits, middleRowHits を計算
  │
  ├─ source/target col hits 両方 → 'both-detour'
  ├─ target col hits のみ        → 'target-detour'
  ├─ source col hits のみ        → 'source-detour'
  │
  └─ middleRowHits のみ:
       shiftedMy 計算
        │
        ├─ shiftedMy in [lo, hi]    → 'shift-my' { my: shiftedMy }
        │
        └─ 範囲外 (本 issue で修正):
             detourX = pickDetourX(middleRowHits, obstacles)
             [obsLeft, obsRight] = 障害群の左右端
             sourceDetourClear = [min(detourX, e.x), max(detourX, e.x)] が
                                  [obsLeft, obsRight] と重ならない
              │
              ├─ sourceDetourClear=true  → 'source-detour' { departY, detourX, my }
              └─ sourceDetourClear=false → 'target-detour' { my, detourX, approachY }
```

## エッジケースと考慮事項

### A. `middleRowHits.length > 1`

複数障害が中間行にある場合、`pickDetourX` は障害群の最右端 / 最左端を採用する:

- 右迂回: `max(o.x + o.w/2) + DETOUR_MARGIN`
- 左迂回: `min(o.x - o.w/2) - DETOUR_MARGIN`

`sourceDetourClear` 判定では障害群の左右端 (`obsLeft = min(o.x - o.w/2)`, `obsRight = max(o.x + o.w/2)`) を使う。`pickDetourX` 内のロジックと整合し、複数障害でも正しく判定できる。

### A2. 右→左対角線 (`s.x > e.x`)

`detectDiagonalDetour` は `|e.x - s.x| >= 2` であれば方向を問わず到達するため、右→左対角線でも本フォールバックが起動しうる。判定は `[min(detourX, e.x), max(detourX, e.x)]` を `[obsLeft, obsRight]` と比較する形で行うため、`s.x` と `e.x` の前後関係に依存せず正しく動作する。テストケース C / D （新規追加）で網羅。

### B. `clampOffset` の degenerate ケース

`departY = clampOffset(s.y, my, DEPART_GAP)` で `|my - s.y| < DEPART_GAP * 2` の場合、`departY` が中央 (`(s.y + my) / 2`) に縮退する。既存 `shift-my` の clamp と同じ防御コードで、SVG 描画上は問題なし。

### C. `bottom` 出口 + 行間隔が広い場合

`fromSide: "bottom"` でも行間隔が十分広ければ `shift-my` の range check は通る。本フォールバックには到達せず regression なし。

### D. 既存テスト `arrow-routing.test.ts:876` の扱い

```ts
it('should escalate to target-detour when shift-my would exceed row bounds', () => {
  const sNarrow = { x: 200, y: 128 }
  const eNarrow = { x: 600, y: 172 }
  const B: Bbox = { x: 400, y: 150, w: 152, h: 56 }
  const r = detectDiagonalDetour(sNarrow, eNarrow, [B])
  expect(r?.kind).toBe('target-detour')
})
```

このテストは `detourX = 478` (右迂回) を返すため、新挙動では `source-detour` を返すべき。**意図変更**としてテストを更新する:

- 名称変更: `should escalate to source-detour when shift-my exceeds row bounds and right detour is chosen`
- 期待値: `target-detour` → `source-detour`

左迂回ケースも新規追加する (#E 参照)。

### E. 新規テスト追加

`src/lib/arrow-routing.test.ts` の `describe('detectDiagonalDetour')` ブロックに以下を追加:

- A: 左→右 + 右迂回 → `source-detour`
- B: 左→右 + 左迂回 → `target-detour`
- C: 右→左 + 右迂回 → `target-detour`
- D: 右→左 + 左迂回 → `source-detour`

```ts
it('should escalate to source-detour when shift-my exceeds row bounds and right detour is chosen', () => {
  // 中間行障害が右迂回される (左側に blocker あり) ケース
  const sNarrow = { x: 200, y: 128 }
  const eNarrow = { x: 600, y: 172 }
  const middleHit: Bbox = { x: 400, y: 150, w: 152, h: 56 }
  const leftBlocker: Bbox = { x: 200, y: 150, w: 152, h: 56 } // source 行と同列の中間行 blocker
  const r = detectDiagonalDetour(sNarrow, eNarrow, [middleHit, leftBlocker])
  expect(r?.kind).toBe('source-detour')
})

it('should escalate to target-detour when shift-my exceeds row bounds and left detour is chosen', () => {
  // 中間行障害が左迂回される (右側に blocker あり) ケース
  const sNarrow = { x: 200, y: 128 }
  const eNarrow = { x: 600, y: 172 }
  const middleHit: Bbox = { x: 400, y: 150, w: 152, h: 56 }
  const rightBlocker: Bbox = { x: 600, y: 150, w: 152, h: 56 } // target 列と同列の中間行 blocker
  const r = detectDiagonalDetour(sNarrow, eNarrow, [middleHit, rightBlocker])
  expect(r?.kind).toBe('target-detour')
})
```

統合テスト (`buildArrowPath` レベル) も追加して SVG path 文字列に obstacle.x を含まないことを確認する。

## テスト戦略

### Red → Green の順序

1. **Red**: 新規ユニットテスト 2 件 (#E) を追加 → 既存挙動では失敗
2. **Red**: 既存テスト L876 を更新 (target-detour → source-detour 期待) → 既存挙動では失敗
3. **Green**: `detectDiagonalDetour` フォールバック修正 → 全 pass
4. **Refactor**: 不要

### 既存テストの regression 検証

- `arrow-routing.test.ts` の他 71 件
- `buildArrowPath` の Z字 / 6セグ / 8セグパス生成テスト
- diamond / bidirectional / shared-viewer 関連テスト

### 視覚検証

ALLFIT-電話 flow を本番デプロイ後に確認:

- ステータス変更 → 13 請求 矢印がノード 11 (グルプラ確認連絡) を貫通しない
- 既存 #346 case (ALLFIT-コンシェルジュ flow: ガイド → 店舗詳細) で regression なし

## 受け入れ基準

- [ ] 新ユニットテスト 2 件が pass
- [ ] 既存テスト L876 を更新して pass
- [ ] フル test suite (1606+ tests) が pass
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` 成功
- [ ] 本番デプロイ後、ALLFIT-電話 flow で問題の矢印がノード貫通しない (Playwright 目視)
- [ ] #346 / #314 / #333 関連ケースで regression なし
- [ ] LCP 1 秒以内

## 範囲外 (YAGNI)

- #353 の修正 (target-detour と target-col 障害の組み合わせバグ): 別 issue として継続
- 8-seg / 10-seg path への拡張: 不要
- `pickDetourX` 自体のロジック変更: 不要
- `shift-my` の range check 緩和: 不要

## 関連

- #346 / PR #348: 斜め配置矢印 Z字パス middle-row 貫通修正 (`detectDiagonalDetour` 導入の core 実装)
- #353: target-detour と target-col 障害の組み合わせバグ (別パターン)
- #314: 矢印迂回 (横方向)
- #333: 矢印迂回 (縦方向)
