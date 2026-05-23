# Design: pickDetourX に middle-row 障害認識を追加 (issue #374)

## 背景

### 症状

密集レイアウトで斜め配置の矢印 (`source-detour` kind) が、source 列 blocker の片側だけを見て反対方向へ迂回し、結果として中央水平セグメントが他ノードを貫通する。

**再現例** (`fixture: grupura-phone.json`)

- 矢印: `ステータス変更 (597.5, 1400, 店舗 row 15)` → `請求 グルプラ(2) (1055.5, 1512, グルプラ(2) row 17)`
- 現状の SVG: `M597.5,1400 L597.5,1414 L507.5,1414 L507.5,1456 L1055.5,1456 L1055.5,1512`
- target は右下方向にあるのに `detourX = 507.5` (左迂回) を選び、中央 H `y=1456` が `x=507.5 → 1055.5` で row 16 の 2 ノード (`x=[521.5, 673.5]`, `x=[750.5, 902.5]`) を貫通

### 根本原因

`pickDetourX` (src/lib/arrow-routing.ts L209-L231) は「迂回 V が物理的に通れる位置」しか考慮していない:

- 片側 blocker (rightBlocked) → 反対方向 (左) を選ぶ
- 中央水平セグメントが通る経路上の障害 (`middleRowHits`) を方向決定に組み込まない

下流の `computeShiftedMy` は middleRowHits を回避するために my を上下シフトしようとするが、row 高さ制約 (`bboxHMax` を用いた range-check) で多くのケースで失敗し、my=row 中央のまま中央 H が貫通する。

### 検討した他案 (C / C') が幾何的に不十分な理由

issue 内推奨の C (source-detour → target-detour 切り替え) は本ケースで効かない:

- target-detour の中央 H は `y=my` で `s.x → detourX` を辿る
- my=1456 (row 16 中央) のままなら、detourX を target.x の右に取っても `s.x → detourX` の H 区間は依然として row 16 を横断
- kind 切り替えだけでは my の位置が変わらない以上、貫通は解消しない
- C' (kind 切り替え + range-check 緩和) は影響範囲が大きく、本 issue とは別の構造的課題

## 設計方針: A' (採用案)

`pickDetourX` に **「detourX 以降の中央水平 H が通過すべきでない障害」** を渡す API を追加し、source-col blockers と middle-row blockers を **同等の「迂回すべき extent」** として一括で最遠端を取る。

target 方向 (target が source の右なら +1) が明示された時のみ、binary blocker 判定をスキップして新ロジックを使う。

### 利点

- source-detour pattern を維持したまま、detourX 計算だけの変更で本ケースを解消
- `computeShiftedMy` / `detectDiagonalDetour` の kind 選択ロジックには手を入れない
- 既存呼び出しは `opts` 省略で完全な後方互換 → 既存テスト 7 ケースは無変更で pass
- target-detour / both-detour への対称対応 (issue #375) も同じ `opts` API を渡すだけで実現可能

### 例 (本ケース)

- sourceColHits: `[9 (x=597.5, w=152)]` → right edge = 673.5
- middleRowHits: `[8 (x=826.5, w=152)]` (9 は `sourceColSet` 経由で除外) → right edge = 902.5
- extent = sourceColHits ∪ middleRowHits = `[9, 8]`
- targetDirection: +1 (target.x=1055.5 > source.x=597.5)
- 新ロジック: `detourX = max(extent.right edges) + 14 = max(673.5, 902.5) + 14 = 916.5`
- 中央 H: `(916.5, 1456) → (1055.5, 1456)` ← row 16 を横切らない

## 変更内容

### 1. `pickDetourX` シグネチャ拡張

```ts
function pickDetourX(
  hits: Bbox[],
  blockers: Bbox[],
  crossRange: [number, number],
  obstacles: Bbox[],
  opts?: {
    /** target が source の右なら +1、左なら -1。指定時は rightBlocked/leftBlocked による方向判定をスキップ */
    targetDirection: 1 | -1
    /** 結果として生成される中央水平 H が同じ y で通過すべきでない障害物 */
    middleHitsToClear: Bbox[]
  },
): number
```

`opts` 自体は optional だが、渡す場合は両フィールド必須。片方だけ渡すバグを TypeScript の構造的型付けで防ぐ。

### 2. 新ロジック (opts 指定時)

```
direction = opts.targetDirection
extent = hits ∪ opts.middleHitsToClear
if direction === +1:
  initialDetourX = max(extent.map(o => o.x + o.w/2)) + DETOUR_MARGIN
else:
  initialDetourX = min(extent.map(o => o.x - o.w/2)) - DETOUR_MARGIN
return escalateDetourTrack(initialDetourX, crossRange, 'v', obstacles, direction)
```

opts 未指定時は既存ロジック (rightBlocked/leftBlocked による binary 判定) をそのまま使う。

### 3. 呼び出し側の変更

**source-detour 分岐 (L386 付近)** — opts を渡す:

```ts
const detourX = pickDetourX(sourceColHits, obstacles, [s.y, my], obstacles, {
  targetDirection: e.x > s.x ? 1 : -1,
  middleHitsToClear: middleRowHits,
})
```

**both-detour の sourceDetourX (L370)** — 同様に opts を渡す:

```ts
const sourceDetourX = pickDetourX(sourceColHits, srcBlockers, [s.y, my], obstacles, {
  targetDirection: e.x > s.x ? 1 : -1,
  middleHitsToClear: middleRowHits,
})
```

**target-detour (L379) / both-detour の targetDetourX (L371) / middle-only (L425)** — 本 PR スコープ外。既存ロジック維持。コードコメントで follow-up issue #375 を参照:

```ts
// 注: target-detour の detourX 計算は対称的に middleHitsToClear を渡せる API を持つが、
// 本 PR (issue #374) では source-detour のみに適用してリグレッションリスクを抑える。
// target-detour / both-detour.tgtDetourX への対称対応は issue #375 でフォローアップ予定。
```

### 4. range-check 関連は触らない

`computeShiftedMy` の `bboxHMax` を用いた range-check は変更しない。A' は **shift-my を介さずに source-detour の detourX 段階で問題を解く** ため、computeShiftedMy の振る舞いを変える必要がない。

`escalateDetourTrack` の `i > 0` ガード (薄いセグメント / ノード衝突判定) も本 PR では touch しない (別 issue として将来検討)。

## テスト計画

### 新規ユニットテスト (`src/lib/arrow-routing.test.ts`)

`describe('pickDetourX with opts')` ブロックを追加:

1. **`should pick detourX past middle-row hit when source-col blocker exists on opposite side`**
   issue #374 の症状: sourceColHits は target 方向 (右) と反対 (左) に blocker を持つが、middle-row 障害が右にある。期待: `detourX = middleRowHits 最遠端 + DETOUR_MARGIN`、左迂回を選ばない。

2. **`should pick detourX past middle-row hit even when source-col blocker is closer`** _(ユーザー追記要望)_
   sourceColHits の最遠端 < middleRowHits の最遠端 のケース。「sourceColHits だけ見ていた旧ロジックでは middleRowHits を見落とす」リグレッション防止。期待: `detourX = max(sourceColHits 最遠端, middleRowHits 最遠端) + DETOUR_MARGIN`。

3. **`should still respect leftBlocked/rightBlocked when opts is not given`**
   opts 未指定時は既存 binary blocker ロジックそのまま (後方互換)。

4. **`should mirror correctly for right-to-left diagonal with middle-row hit`**
   target が source の左にあるケース。`targetDirection: -1`、`min(...) - DETOUR_MARGIN` を取る対称検証。

### 統合テスト

`buildArrowPath - 斜め迂回（異行×異レーン）` ブロックに以下を追加:

5. **`should not cross row obstacles when source has single-side blocker and target is on blocked side`**
   再現フロー (grupura-phone) に近い構成で `buildArrowPath` の出力 SVG path をスナップショット検証。

### 既存テストの非回帰

- `src/lib/arrow-routing.test.ts` の既存 source-detour / target-detour / both-detour / shift-my テストはすべて変化なしで pass する想定 (opts 省略呼び出しなので)

### `/dev/render?fixture=grupura-phone` での目視検証

CLAUDE.md Workflow Step 6 で Playwright スクリーンショット確認。本症状の矢印が row 16 を貫通せず source-detour で正しく右迂回することを目視確認。

## スコープ外 (follow-up)

- **issue #375**: target-detour / both-detour の `tgtDetourX` への同等対応
- `escalateDetourTrack` の `i > 0` ガード強化 (別 issue として将来)

## 関連

- 親 issue: #374
- フォローアップ issue: #375
- 関連 PR: #372 (段階3・段階4 ジャンパー), #373 (薄いエッジセグメント除外)
