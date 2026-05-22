# issue #346: 斜め配置矢印 Z字パスの中間行ノード貫通修正 — 設計

- 関連 issue: [#346](https://github.com/tomohirof/flowline/issues/346)
- 関連既存実装: #314 (水平方向迂回), #333 (垂直方向迂回)
- 対象ファイル: `src/lib/arrow-routing.ts`, `src/features/editor/FlowEditor.tsx`, `src/features/shared/SharedFlowViewer.tsx`, `src/lib/arrow-routing.test.ts`

## 1. 背景

斜め配置 (異行 × 異レーン) の矢印で `buildArrowPath` が生成する Z字パスが、中間行・target 列にあるノードを貫通する。

### 再現例

- 矢印: `ガイド` (row1, lane `ユーザー(2)`) → `店舗詳細` (row3, lane `ユーザー` parent)
- s = ガイド底 (`(source_lane_x, source_row_y + hh)`)
- e = 店舗詳細上 (`(target_lane_x, target_row_y - hh)`)
- 両方とも縦出口 → Z字パス
- `my = (s.y + e.y) / 2` ≈ 中間行 row2 の中心 Y
- 第3セグメント `(e.x, my) → (e.x, e.y)` が、target 列 (`ユーザー` parent) の row2 にある `一覧ページ` を貫通

### 根本原因

`src/lib/arrow-routing.ts`:

- `detectDetour` / `detectVerticalDetour` は水平/垂直直線 (`|dx| < 2` または `|dy| < 2`) のみ発動
- 斜め矢印は `buildArrowPath` 内の Z字分岐で衝突判定なくパス生成

`src/features/editor/FlowEditor.tsx:1397-1423`:

- `fri === tri` または `fli === tli` のときのみ obstacles を組み立て
- 斜め配置では `obstacles = undefined` となり迂回判定がそもそも走らない

`my` シフトだけでは解決不能: 第3セグメントは target 列上の縦移動なので、`my` を上下に動かしても target 列上の障害は依然として貫通する。target 列を物理的に迂回する必要がある。

## 2. 期待挙動

- 斜め矢印で Z字パス 3 セグメント (source 縦 / 中央水平 / target 縦) のいずれかが障害ノードと衝突するとき、それを避けるパスを生成
- 障害なしのケースは従来 Z字パスを維持
- 同一行 (#314) / 同一レーン (#333) の挙動には regression なし
- エディタと共有ビューアで同じ挙動
- Diamond ノード・bidirectional 矢印でも崩れない

## 3. アーキテクチャ

```
arrow-routing.ts
├── collectObstacles            (既存 / 同一行)
├── collectVerticalObstacles    (既存 / 同一レーン)
├── collectDiagonalObstacles    (新規 / 異行×異レーン)
├── detectDetour                (既存 / 水平直線)
├── detectVerticalDetour        (既存 / 垂直直線)
├── detectDiagonalDetour        (新規 / Z字パス全3セグメント)
└── buildArrowPath              (修正 / 斜め分岐に迂回判定を追加)

FlowEditor.aPath / SharedFlowViewer.computeArrowPath
└── obstacles 組み立て分岐に `else { obstacles = collectDiagonalObstacles(...) }` を追加
```

### 設計原則

- 既存の `collectObstacles` / `collectVerticalObstacles` / `detectDetour` / `detectVerticalDetour` API・実装には触れない (regression リスク隔離)
- 新規ロジックは `Diagonal` 専用関数として独立、テストも独立
- `buildArrowPath` の斜め分岐 (現状: Z字 / L字パス) を拡張し、`obstacles` が渡され `detectDiagonalDetour` が結果を返したときのみ迂回パスを生成
- 共有ビューアは `buildArrowPath` を経由するため、呼び出し側 2 箇所の修正で済む

## 4. detector 仕様

### `detectDiagonalDetour`

```ts
type DiagonalDetourResult =
  | { kind: 'shift-my'; my: number }
  | { kind: 'target-detour'; my: number; detourX: number; approachY: number }
  | { kind: 'source-detour'; departY: number; detourX: number; my: number }
  | {
      kind: 'both-detour'
      departY: number
      sourceDetourX: number
      my: number
      targetDetourX: number
      approachY: number
    }
  | null

function detectDiagonalDetour(s: Point, e: Point, obstacles: Bbox[]): DiagonalDetourResult
```

### 判定ロジック

1. **斜めガード**: `|dx| < 2 || |dy| < 2` なら null を返す (既存 detector の領域)
2. **初期 my を計算**: `my = (s.y + e.y) / 2`
3. **3 セグメント衝突判定**:
   - `sourceColHit`: X が source 列 (`|b.x - s.x| < b.w/2 + 2`) で Y が `[min(s.y, my) + 1, max(s.y, my) - 1]` の範囲にある障害
   - `targetColHit`: X が target 列 (`|b.x - e.x| < b.w/2 + 2`) で Y が `[min(my, e.y) + 1, max(my, e.y) - 1]` の範囲にある障害
   - `middleRowHit`: Y が `|b.y - my| < b.h/2 + 2` で X が `[min(s.x, e.x) + 1, max(s.x, e.x) - 1]` の範囲にある障害
4. **優先順位 (上から順)**:
   - すべて none → null
   - `sourceColHit && targetColHit` → `both-detour`
   - `targetColHit` → `target-detour`
   - `sourceColHit` → `source-detour`
   - `middleRowHit` のみ → `shift-my`

### `target-detour` の幾何

```
M(s.x, s.y)
 → L(s.x, my)                   # source 縦
 → L(targetDetourX, my)         # 中央水平 (target 側に延長)
 → L(targetDetourX, approachY)  # target 列を回避する縦
 → L(e.x, approachY)            # target に向かって水平
 → L(e.x, e.y)                  # target に縦進入
```

- `targetDetourX`:
  - 右優先: target 列障害の Y 重なりするノードが直右に存在しないか、または直左にも存在する → 右
  - その他 → 左
  - `goRight ? max(障害右端) + DETOUR_MARGIN : min(障害左端) - DETOUR_MARGIN`
- `approachY = e.y - sign(e.y - my) * APPROACH_GAP` (target 直前で水平切り返し)
  - `Math.abs(e.y - my) / 2` で clamp (自己交差防止、既存 detour と同じ)
- 中央 X セグメントが他の障害と衝突する場合は my をシフト (後述)

### `source-detour` の幾何 (鏡像)

```
M(s.x, s.y)
 → L(s.x, departY)
 → L(sourceDetourX, departY)
 → L(sourceDetourX, my)
 → L(e.x, my)
 → L(e.x, e.y)
```

- `sourceDetourX`: source 列障害の左右塞がり判定で右優先
- `departY = s.y + sign(my - s.y) * DEPART_GAP`、`Math.abs(my - s.y) / 2` で clamp

### `both-detour` の幾何 (8 セグ)

```
M(s.x, s.y)
 → L(s.x, departY)
 → L(sourceDetourX, departY)
 → L(sourceDetourX, my)
 → L(targetDetourX, my)
 → L(targetDetourX, approachY)
 → L(e.x, approachY)
 → L(e.x, e.y)
```

- **左右塞がり判定の相互排除**: `sourceDetourX` の方向判定 (`pickDetourX`) では `targetColHits` をブロッカー候補から除外し、`targetDetourX` の判定では `sourceColHits` を除外する。反対側列の障害は対応する迂回パスで既に回避済みであり、Y 重なりによる相互ブロッキング (誤った全方向左偏向) を防ぐため。

### `shift-my` の幾何 (4 セグ維持)

```
M(s.x, s.y) → L(s.x, my') → L(e.x, my') → L(e.x, e.y)
```

- `my'`: 中央障害群の最上端 - DETOUR_MARGIN または最下端 + DETOUR_MARGIN
- 下優先 (`detectDetour` と同方針)
- ガード: `my'` が `[min(s.y, e.y) + bboxH/2 + 1, max(s.y, e.y) - bboxH/2 - 1]` を逸脱する場合は `shift-my` を諦め、`middleRowHit` の障害群を `targetColHit` として再評価して `target-detour` にフォールバック (中央障害は概ね target 列寄りに分布するため target 側迂回が自然)

### 方向決定の規約 (既存と整合)

- target/source 列迂回: **右優先** (#333 と同じ)
- 中央 my-shift: **下優先** (#314 と同じ)

## 5. collector 仕様

### `collectDiagonalObstacles`

```ts
interface CollectDiagonalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  fromCy: number
  toCx: number
  toCy: number
  rowH: number
  colW: number
  bboxW: number
  bboxH: number
}

export function collectDiagonalObstacles(args: CollectDiagonalObstaclesArgs): Bbox[]
```

### 収集対象

`from`/`to` 自身を除外したうえで、以下のいずれかに該当するノードを返す:

1. **source 列ストリップ**: `|n.cx - fromCx| < bboxW/2 + 2` かつ `n.cy` が `(min(fromCy, toCy) + 1, max(fromCy, toCy) - 1)` の範囲
2. **target 列ストリップ**: `|n.cx - toCx| < bboxW/2 + 2` かつ `n.cy` が `(min(fromCy, toCy) + 1, max(fromCy, toCy) - 1)` の範囲
3. **中央行ストリップ**: `|n.cy - (fromCy + toCy) / 2| < bboxH/2 + 2` かつ `n.cx` が `(min(fromCx, toCx) + 1, max(fromCx, toCx) - 1)` の範囲
4. **source 隣接列 (左右1列)**: `|n.cx - fromCx| > colW - bboxW/2 && |n.cx - fromCx| < colW + bboxW/2` かつ `n.cy` が `[min(fromCy, toCy) - rowH/2, max(fromCy, toCy) + rowH/2]` の範囲 (source 迂回方向判定用、Z字パス Y 範囲 + 半行分まで)
5. **target 隣接列 (左右1列)**: `|n.cx - toCx| > colW - bboxW/2 && |n.cx - toCx| < colW + bboxW/2` かつ `n.cy` が同 Y 範囲 (target 迂回方向判定用)

collector は「広めに集める」設計で、detector 側で `bboxW/2`・`colW` 閾値による再フィルタを行う。

返却 Bbox は `{ x: n.cx, y: n.cy, w: bboxW, h: bboxH }` で `collectObstacles` と同じ shape。

## 6. 呼び出し側変更

### `src/features/editor/FlowEditor.tsx`

`aPath` (現 1397-1423 行) の obstacles 組み立て分岐に `else` 節を追加:

```ts
let obstacles: Bbox[] | undefined
if (fri === tri) {
  obstacles = collectObstacles({ ... })           // 既存
} else if (fli === tli) {
  obstacles = collectVerticalObstacles({ ... })   // 既存
} else {
  obstacles = collectDiagonalObstacles({
    nodes: obstacleNodes,
    fromKey: arrow.from,
    toKey: arrow.to,
    fromCx: from.x,
    fromCy: from.y,
    toCx: to.x,
    toCy: to.y,
    rowH: RH,
    colW: LW + G,
    bboxW: TW,
    bboxH: TH,
  })
}
```

### `src/features/shared/SharedFlowViewer.tsx`

同じ構造で `computeArrowPath` (現 117-162 行) に `else` 節を追加。

## 7. `buildArrowPath` の変更

斜め分岐 (現 244-262 行 の `} else { ... }`) の前、つまり obstacles チェックの後ろに追加:

```ts
if (obstacles && obstacles.length > 0) {
  // ... 既存の detectDetour / detectVerticalDetour 分岐 ...

  const dDetour = detectDiagonalDetour(s, e, obstacles)
  if (dDetour) {
    // kind 別に SVG パス生成
    // (target-detour / source-detour / both-detour / shift-my)
    return { d, mx, my }
  }
}
```

ラベル位置 `mx, my`:

- `target-detour`: `mx = (s.x + targetDetourX) / 2`, `my = my`
- `source-detour`: `mx = (sourceDetourX + e.x) / 2`, `my = my`
- `both-detour`: `mx = (sourceDetourX + targetDetourX) / 2`, `my = my`
- `shift-my`: `mx = (s.x + e.x) / 2`, `my = my'`

`my` の表記は detector が返す値 (シフト後または初期 `(s.y + e.y) / 2`) をそのまま使う。

## 8. テスト計画

### `detectDiagonalDetour` 単体テスト

- `should return null when arrow is horizontal (|dy| < 2)`
- `should return null when arrow is vertical (|dx| < 2)`
- `should return null when no obstacles intersect Z-path`
- `should return target-detour when obstacle in target column between my and e.y` (**core ケース**)
- `should return target-detour with left-side detourX when target column blocked on right`
- `should prefer right detour when both sides of target column are blocked`
- `should return source-detour when obstacle in source column between s.y and my`
- `should return shift-my when only middle horizontal segment is blocked`
- `should escalate to target-detour when shift-my exceeds row bounds`
- `should return both-detour when source and target columns both have obstacles`
- `should return null with empty obstacles array`

### `collectDiagonalObstacles` 単体テスト

- `should exclude from/to nodes themselves`
- `should collect source-column obstacles between rows`
- `should collect target-column obstacles between rows`
- `should collect adjacent-column obstacles around source and target`
- `should collect middle-row obstacles between source and target X`
- `should not collect nodes outside the Z-path corridor`
- `should preserve bbox dimensions (w=bboxW, h=bboxH)`
- `should return empty array when no candidate nodes`

### `buildArrowPath` 統合テスト

- `should produce 6-segment target-detour path for diagonal arrow with target-column obstacle` (**bug 再現**)
- `should produce 6-segment source-detour path (mirror)`
- `should produce 4-segment shift-my path for diagonal arrow with middle obstacle`
- `should produce 8-segment both-detour path when both columns blocked`
- `should produce default Z-path when no obstacles (regression guard)`
- `should produce default Z-path when obstacles array is undefined`
- `should not affect horizontal arrow detour (regression guard for #314)`
- `should not affect vertical arrow detour (regression guard for #333)`

### Diamond ノード

- `should handle diagonal detour when source is diamond`
- `should handle diagonal detour when target is diamond`

### Playwright / 目視確認

- 実データ (`ALLFIT-コンシェルジュ` flow) で ガイド → 店舗詳細 矢印が 一覧ページを貫通しないこと
- スクリーンショット保存先: `.screenshots/issue-346-before.png` / `.screenshots/issue-346-after.png`
- 他の既存矢印 (横方向迂回 #314、縦方向迂回 #333、通常 Z字) に regression がないこと
- LCP 1 秒以内

### `~/.claude/rules/testing.md` 準拠

- 空配列・undefined のエッジケース網羅
- 重複障害ノード (同じ X/Y) でも安定動作
- 0/負/極大の dx/dy ガード
- 命名規則: `[Unit] should [expected behavior] when [condition]`
- クリティカルパス (detector / collector) は 100% カバレッジ目標

## 9. 受け入れ基準

- [ ] `ALLFIT-コンシェルジュ` flow で ガイド → 店舗詳細 の矢印が 一覧ページを避けて描画される
- [ ] 斜め矢印 + 障害なし のケースで従来 Z字パス維持
- [ ] #314 (横方向) の挙動に regression なし
- [ ] #333 (縦方向) の挙動に regression なし
- [ ] Diamond ノード・bidirectional 矢印の斜め配置でも崩れない
- [ ] エディタと共有ビューアで同じ挙動
- [ ] LCP 1 秒以内
- [ ] 全テスト pass / Playwright 目視確認

## 10. 既知の懸念と対応

| 懸念                               | 対応                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Z字パス 3 セグメント全てに衝突判定 | 優先順位ベースで 1〜2 セグメントの修正に集約。最悪 8 セグの `both-detour` で全カバー                                                     |
| my シフトの上下限ガード            | source/target 行を侵食しないよう `[s.y+bboxH/2, e.y-bboxH/2]` で clamp、超過時は target-detour 昇格                                      |
| 既存 collector のスコープ拡張      | 既存関数は触らず、新規 `collectDiagonalObstacles` で独立カバー                                                                           |
| Diamond / bidirectional 対応       | テスト追加で検証。bbox は既存と同じ `TW × TH`                                                                                            |
| 共有ビューアとの整合               | `arrow-routing.ts` に判定を寄せ、呼び出し側 (`FlowEditor.aPath` / `SharedFlowViewer.computeArrowPath`) は collector 呼び出しのみ差し替え |
| パフォーマンス                     | `obstacleNodes` は既に 1 回収集済。collector は O(N)、detector は O(M) (M = 候補障害数)、全体 O(N + arrows × M) で実用上問題なし         |

## 11. 関連 issue

- #314: 矢印迂回 (横方向) — 実装済 (CLOSED)
- #333: 矢印迂回 (縦方向) — open / 作業中
- #328: depart 脚クリアランス — 縦版にも同じ regression リスク、別途対応
