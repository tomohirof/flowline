# Design: target-detour / both-detour.targetDetourX への symmetric middle-hits 対応 (issue #375)

## 背景

issue #374 (PR #376) で `pickDetourX(opts)` API が導入され、source-detour と both-detour.sourceDetourX で中央水平 H が middle-row 障害を貫通する問題を解消した。

本 issue は対称的に、target-detour と both-detour.targetDetourX にも同じ枠組みを適用するフォローアップ。

### 既知の幾何学的非対称性

`pickDetourX(opts)` は **opts.targetDirection の符号方向に extent (hits ∪ middleHitsToClear) を超えるまで detourX を push する** 設計。これを source / target 両 detour で「同じ符号 (+1 if target右)」で呼ぶと幾何学的に不整合になる:

- source-detour 中央 H = `[detourX, e.x]`: detourX を target 方向に push すれば H は obstacles の外側 (target 側) を通る → ✓
- target-detour 中央 H = `[s.x, detourX]`: detourX を target 方向に push すると obstacles は `[s.x, detourX]` の内側に挟まれたまま → ✗

target-detour 側で対称な衝突回避を実現するには **detourX を source 方向に push** する必要がある。

### 再現シナリオ (target-detour)

```
source.x = 100, e.x = 1055.5 (target 右), my = 中央 Y
targetColHit at x=1055.5 (target 列)
middleRowHit at x=826.5 (middle 行、source-target 間)

旧来 pickDetourX (binary blocker):
  detourX = 1055.5 + bboxW/2 + 14 (右迂回) or 1055.5 - bboxW/2 - 14 (左迂回)
  どちらも 中央 H [100, detourX] は middleRowHit (x=826.5) を貫通
```

issue #374 の grupura-phone フィクスチャは source-detour ケースで、target-detour パターンの再現は未確認。本 issue は幾何的に対称性を保つ予防的修正。

## 設計方針

### 1. target-detour 分岐で `opts` を渡す

```ts
if (targetColHits.length > 0 && sourceColHits.length === 0) {
  const detourX = pickDetourX(
    targetColHits,
    obstacles,
    [my, e.y],
    obstacles,
    middleRowHits.length > 0
      ? {
          // ★ source-detour とは符号が逆: target-detour 中央 H = [s.x, detourX] を
          // obstacles の source 側に通すため、detourX を source 方向に push する。
          targetDirection: (e.x > s.x ? -1 : 1) as 1 | -1,
          middleHitsToClear: middleRowHits,
        }
      : undefined,
  )
  ...
}
```

### 2. both-detour.targetDetourX 計算で `opts` を渡す

```ts
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

### 3. middleRowHits 空のとき旧ロジックに fallback

issue #374 で導入した regression guard と同じパターン。middleRowHits 空時に opts を渡すと隣接列 blocker を貫通する可能性があるため、明示的に opts を `undefined` にする。

### 4. コメント更新

`arrow-routing.ts` L416-L418 の「issue #375 でフォローアップ予定」コメントを削除し、新ロジックの説明 (source-detour と target-detour で符号が逆になる幾何学的理由) を追加する。

## 例 (target-detour 再現シナリオ)

```
s.x = 100, e.x = 1055.5
targetColHit (x=1055.5, w=152) → left=979.5, right=1131.5
middleRowHit (x=826.5, w=152) → left=750.5, right=902.5
e.x > s.x → targetDirection_normal = +1 → 渡す値は -1

extent = targetColHits ∪ middleRowHits
opts.targetDirection = -1:
  initialDetourX = min(extent.map(o => o.x - o.w/2)) - DETOUR_MARGIN
                 = min(979.5, 750.5) - 14
                 = 736.5

中央 H = [s.x=100, detourX=736.5]
middleRowHit range [750.5, 902.5] は 736.5 より右 → 衝突なし ✓
```

## 変更内容まとめ

| 変更箇所                    | 行 (現行) | 変更概要                                           |
| --------------------------- | --------- | -------------------------------------------------- |
| target-detour 分岐          | L420      | `pickDetourX(..., opts?)` で opts を条件付きで渡す |
| both-detour.targetDetourX   | L409      | 同上                                               |
| middle-only fallback (L475) | L475      | スコープ外。後述。                                 |
| コメント                    | L416-L418 | issue #375 follow-up コメントを削除/置換           |

### middle-only fallback (L475) を対象外とする理由

`detectDiagonalDetour` 末尾の `if (middleRowHits.length > 0)` ブロック (L443-L490) は **source/target 列に hits なし、middle 行のみ hit** の特殊ケース。ここでは `pickDetourX(middleRowHits, obstacles, ...)` で middleRowHits 自体を hits として渡しており、新ロジックの「sourceCol/targetCol + middleRow の union」とは構造が異なる。本 issue のスコープ外。

## テスト計画

### 新規ユニットテスト (`src/lib/arrow-routing.test.ts`)

issue #374 のテストと対称に 4 ケース追加:

1. **`should pick detourX past middle-row hit when target-detour selected and middle-row hit exists`**
   - target-detour 確定 (targetColHit + middleRowHit、sourceColHit なし)
   - 期待: `detourX = min(targetCol.left, middleRow.left) - 14` (source 方向 push)

2. **`should mirror correctly for right-to-left diagonal target-detour with middle-row hit`**
   - 右→左斜め (target left, source right)、targetColHit + middleRowHit
   - 期待: `detourX = max(targetCol.right, middleRow.right) + 14` (右 = source 方向 push)

3. **`should pick targetDetourX past middle-row hit in both-detour when middle-row hit exists`**
   - both-detour で sourceDetourX (新ロジック target 方向) と targetDetourX (新ロジック source 方向) 両方適用
   - 期待: `sourceDetourX = max(...) + 14`, `targetDetourX = min(...) - 14`

4. **`should fall back to blocker-aware logic when middle-row hit is empty (target-detour regression guard)`**
   - target-detour で middleRowHits 空 → 旧ロジック (binary blocker) に戻る

### 統合テスト

5. **`buildArrowPath - target-detour 中央 H が middle-row 障害を回避する`**
   - target-detour 再現シナリオで SVG path を検証

### 既存テストの更新が必要なケース

- **`should pick sourceDetourX past middle-row hit in both-detour when middle-row hit exists on target side`** (現行 src/lib/arrow-routing.test.ts L1096 付近)
  - `expect(r.targetDetourX).toBe(354)` ← **新ロジック適用後は `146` に変わる**
  - obstacles: sourceColHit (100, 200, w=80), targetColHit (300, 200, w=80), middleRowHit (200, 200, w=80)
  - 新計算: targetDirection=-1 (e.x>s.x の逆) → min(targetCol.left=260, middleRow.left=160) - 14 = 146
  - コメント「旧ロジック維持 (issue #375 で対応)」を「新ロジック適用」に更新

### その他既存テストの非回帰

- target-detour で middleRowHits 空のテスト (L847, L858, L939, L961 など) は opts 渡されない → 旧ロジック維持 → 非回帰
- `should shift my when target-detour selected AND middle-row obstacle exists` (L1003)
  - obstacles: targetColHit (300, 200), middleRowHit (200, 200)
  - 旧 detourX (右迂回): 300 + 40 + 14 = 354
  - 新 detourX (source 方向 = -1): min(260, 160) - 14 = 146
  - 既存テストは detourX 値を検証していない (`expect(r.my).toBe(239)` と `expect(r.approachY).toBe(286)` のみ) → 非回帰
- `should shift my when both-detour selected AND middle-row obstacle exists` (L1019)
  - 同上、detourX 値を検証していないため非回帰
- **both-detour の中央 H 方向反転に関する注意**: 新ロジック適用時、`sourceDetourX > targetDetourX` (右→左に逆走) となるケースが生じる
  - 例: 上記の both-detour テストでは sourceDetourX=254, targetDetourX=146 → 中央 H は 254 → 146 へ左進行
  - `segmentsToD` は range 順序を問わず描画できるため SVG 出力は正しい
  - `detectCrossings` は range の min/max で比較するため向き反転に影響されない (L1148-1156)
  - shift-my が並行して効くため、たとえ X 軸で逆走しても Y 軸でずれて衝突回避済み

### `/dev/render` 目視検証

- `grupura-phone` フィクスチャ (issue #374 再現): 既存 source-detour ルートに影響しないことを確認
- target-detour パターンを意図的に作るフィクスチャがあれば追加検証 (なければスキップして PR コメントに記載)

## スコープ外

- `escalateDetourTrack` の `i > 0` ガード強化 (別 issue)
- `detectDiagonalDetour` 末尾 middle-only fallback (L443-L490) への適用 (構造的に新ロジックが当てはまらない)

## 関連

- 親 issue: #374 (closed by PR #376)
- PR #376 設計: `docs/superpowers/specs/2026-05-23-arrow-routing-pickDetourX-middle-hits-design.md`
- PR #376 計画: `docs/superpowers/plans/2026-05-23-arrow-routing-pickDetourX-middle-hits-plan.md`
