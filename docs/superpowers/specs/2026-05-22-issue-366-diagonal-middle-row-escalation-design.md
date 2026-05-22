# 設計: 斜め矢印で source/target 列衝突と中央行衝突が同時発生する場合の迂回

- **対象 issue**: [#366](https://github.com/tomohirof/flowline/issues/366) bug: 菱形ノード(fromSide:"bottom")からの斜め矢印が複数障害ノードを貫通する
- **対象ファイル**: `src/lib/arrow-routing.ts`
- **関連 issue / 過去修正**: #346 (diagonal-arrow-detour 導入), #359 (shift-my fallback kind-swap)

## 1. 背景

`detectDiagonalDetour` は斜め配置 (異行×異レーン) の矢印に対し、Z字パス上の障害ノードを検出して以下の 4 kind のいずれかを返す:

| kind | 発火条件 | セグメント数 |
| --- | --- | --- |
| `both-detour` | sourceColHits > 0 ∧ targetColHits > 0 | 8 |
| `target-detour` | targetColHits > 0 ∧ sourceColHits === 0 | 6 |
| `source-detour` | sourceColHits > 0 ∧ targetColHits === 0 | 6 |
| `shift-my` | middleRowHits > 0 ∧ source/target いずれも 0 | 4 |

## 2. バグの根本原因

issue #366 の再現データを解析すると以下の幾何になる:

- source: 店舗/ステータス変更 `(col0, row0)` 菱形 `fromSide:"bottom"`
- target: グルプラ(2)/請求 `(col2, row2)`
- 障害①: 店舗/確認連絡(9) `(col0, row1)` — **source 列・中央行**
- 障害②: グルプラ/確認連絡(8) `(col1, row1)` — **中央行**
- 障害③: グルプラ/請求 `(col1, row2)` — **target 隣接列・target 行**

`detectDiagonalDetour` で hits を計算すると:

```
sourceColHits = [障害①]
targetColHits = []          ← グルプラ(2)列 (col2) には何もない
middleRowHits = [障害②]    ← 評価されずに破棄
```

L207-211 の `sourceColHits > 0 && targetColHits === 0` 分岐で `source-detour` が early return され、**middleRowHits を評価する L214 以降に到達しない**。

結果として `source-detour` の中央水平セグメント `(detourX, my) → (e.x, my)` が `y = my ≒ row1` を走り、障害②を貫通する。

> issue 本文の仮説「親レーン (グルプラ) の同行ノードが `collectDiagonalObstacles` で拾われていない」は誤り。`collectDiagonalObstacles` は障害② を `onMiddleRow + inZRangeX`、障害③ を `onTargetAdjacentCol + inExtendedY` で正しく拾っている。

## 3. 修正方針 (アプローチA: middle-row escalation)

`detectDiagonalDetour` の kind 選択で middleRowHits を **すべての分岐で考慮** する。

### 3.1 アルゴリズム概要

```
1. sourceColHits, targetColHits, middleRowHits を上から計算
2. kind を従来通り (both / target / source / shift-my) 一次決定
3. もし `source-detour` または `target-detour` を選び、かつ middleRowHits が
   中央水平セグメント [s.x..e.x] の X 範囲と重なるなら:
     - 中央水平の Y を `my` から `shiftedMy` にずらす
     - shiftedMy = shift-my と同じ計算 (障害の下/上 + DETOUR_MARGIN)
     - shiftedMy が [s.y..e.y] の範囲を逸脱したら shift せず従来挙動
4. `both-detour` の場合も同様にチェック (middleRowHits ⊂ [sourceDetourX..targetDetourX])
```

### 3.2 kind 拡張

既存の `source-detour` / `target-detour` / `both-detour` に `my` を内包しているため、**新 kind は不要**。返り値の `my` 値を `shiftedMy` に置き換える。

ただし `departY` / `approachY` は `clampOffset(from, to, gap)` で `my` (旧値) から計算される値のため、`my` を `shiftedMy` に置き換える際は **`departY` / `approachY` も `shiftedMy` ベースで再計算する**:

```ts
const shiftedMy = ...
const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
```

これにより depart/approach の幾何が `shiftedMy` 連動になり、source/target からの離脱角度が一貫する。

`shift-my` の range-check は既存実装を流用する (L233-238):
```ts
const yLow = Math.min(s.y, e.y)
const yHigh = Math.max(s.y, e.y)
const lo = yLow + bboxHEst / 2 + 1
const hi = yHigh - bboxHEst / 2 - 1
if (shiftedMy >= lo && shiftedMy <= hi) {
  // use shiftedMy
} else {
  // fall back to original my (障害は残るが range-check 失敗ケースは稀)
}
```

### 3.3 範囲外フォールバック方針

range-check 失敗時の挙動は **従来の `my` で進める** (改善なし) を選択する。理由:

- #359 の kind-swap fallback はあくまで「shift-my単独時、左右迂回方向が選ばれた後の救済」であり、本件 (source/target列＋中央行同時衝突) の救済路線は別途設計が必要
- 範囲外ケースは「行間隔が極端に狭い」「source/target 行が中央行 obstacle と隣接」など稀
- 完全対応は別 issue / 別 PR に切り出す方が PR scope として健全

## 4. 影響範囲

### 4.1 修正ファイル

- `src/lib/arrow-routing.ts` (`detectDiagonalDetour` のみ)

### 4.2 修正しないファイル

- `collectDiagonalObstacles` (既に正しく obstacle を収集している)
- `buildObstacles` (引数追加不要)
- `FlowEditor.tsx` / `SharedFlowViewer.tsx` (呼び出し側変更なし)
- `calcArrowPath` 系の描画ロジック (kind 拡張なし、my 値のみ変動)

### 4.3 後方互換性

- 既存テスト (source-detour / target-detour / both-detour で middleRowHits 0 件) は挙動不変
- 既存 `shift-my` テスト (col hits 0 件) は挙動不変

## 5. テスト計画

### 5.1 TDD (Red → Green)

`src/lib/arrow-routing.test.ts` の `describe('detectDiagonalDetour', ...)` ブロックに以下を追加:

#### Test 1 — `source-detour` + middle-row 障害
```ts
it('should shift my when source-detour selected AND middle-row obstacle exists', () => {
  // s=(100, 100), e=(300, 300), my=200
  // sourceCol hit at (100, 200)  → source-detour 確定
  // middle-row hit at (200, 200) → my を shiftedMy にシフトすべき
  const obstacles = [
    { x: 100, y: 200, w: 80, h: 50 }, // source col & middle row
    { x: 200, y: 200, w: 80, h: 50 }, // middle row
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('source-detour')
  expect(r?.my).toBeGreaterThan(200) // shifted below middle row obstacles
})
```

#### Test 2 — `target-detour` + middle-row 障害 (鏡像)
- target 列 hit + 中央行 hit → `target-detour` で my シフト

#### Test 3 — `both-detour` + middle-row 障害
- 両列 hit + 中央行 hit → `both-detour` で my シフト

#### Test 4 — issue #366 の最小再現ケース (5レーン×3行)
- source `(col0, row0)` 菱形 fromSide:"bottom" 相当
- target `(col2, row2)`
- 障害: `(col0, row1)`, `(col1, row1)`, `(col1, row2)`
- 期待: `source-detour` with shifted my, 中央水平が `row1` を回避

#### Test 5 — range-check 失敗時のフォールバック
- 行間隔が狭く shiftedMy が範囲外 → 従来の my で source-detour 返却 (挙動不変)

### 5.2 既存テスト確認

`npm test -- arrow-routing` で 1200+ 行の既存テストが全 pass することを確認。

### 5.3 実画面検証

- `flowline-R_ALLFIT-電話-20260522093804.json` 相当のレイアウトを作って Playwright でスクショ比較
- 該当矢印 `5e634294-...` の path が障害② を回避することを目視確認

## 6. 想定外リスクと緩和策

| リスク | 緩和策 |
| --- | --- |
| shiftedMy が target 列以外の障害と新たに衝突 | range-check で [s.y..e.y] 範囲内に収まる場合のみ適用 |
| 既存の `both-detour` ケースで余計に my シフトが発生 | middleRowHits の X 範囲を `[sourceDetourX..targetDetourX]` に厳密フィルタ |
| approach 行 (target 行) の隣接列障害 (本件の障害③) は未対応 | 本 spec のスコープ外。実機検証で別途問題視されたら follow-up issue |

## 7. スコープ外

以下は本 issue / PR では扱わない (必要なら別 issue):

- target 行隣接列の同行ノード貫通 (issue #353 の派生)
- source 行隣接列の同行ノード貫通 (#333 同一レーン縦方向の派生)
- shift-my range-check 失敗時の kind 横断 fallback 拡張
- `collectDiagonalObstacles` のレーングループ拡張
