# マルチエッジ協調ルーティング 段階1（エッジを障害物に昇格）設計

- 作成日: 2026-05-22
- ステータス: Design 承認済 → Plan 作成へ
- 関連 Issue: 未作成（実装着手時に作成）

## 背景・目的

`src/lib/arrow-routing.ts` の経路計算は単一エッジルータである。`detectDetour` / `detectVerticalDetour` / `detectDiagonalDetour` のいずれも、引数 `obstacles: Bbox[]` をノードの bbox として扱い、他のエッジの経路は一切考慮しない。

その結果、複数エッジが同じ通路に集中すると相互に交差する。例：複数の入力が同一ターゲットノードへ到着するフローで、各エッジが個別最適には正しい経路を取っているにもかかわらず、互いに無関心であるため線が混線する。

これは帰納的なルール追加では解消しない（各エッジの個別ロジックをいくら精緻化しても、エッジ同士の干渉は別レイヤーの問題）。本段階1では、`obstacles` に「ルーティング済みエッジのセグメント」を含める構造変更により、マルチエッジ協調の最小限の枠組みを導入する。

## スコープ

### 対象

- 水平 (`detectDetour`)・垂直 (`detectVerticalDetour`)・斜め (`detectDiagonalDetour`) **3 種類すべて**にエッジ障害物を適用
- エディタ (`FlowEditor.aPath`) と共有ビュー (`SharedFlowViewer`) の両方
- 既存の単一エッジルーティングロジック（detect 系・buildArrowPath 内部）は変更しない

### 対象外

- A\* グリッド探索など根本的なアルゴリズム置換
- ELK.js などの外部ライブラリ採用
- チャネル/トラック割り当て（複数エッジが同じ迂回経路に集中するケース）→ **段階2** へ
- ルーティング順序の最適化（長辺優先・トポロジカル順）→ **段階3** へ
- フィーチャーフラグによる段階的有効化（中途半端な状態を残すと一貫性のない挙動になり技術的負債化するため、3 種類同時適用）

## 受け入れ基準

- [ ] 複数エッジが同じ通路に集中するスクリーンショット相当のケースで、混線が目視で解消されること（成功基準）
- [ ] `arrows.length === 1` の場合、既存テストの結果と完全一致（最初のエッジは従来挙動）
- [ ] 同じ `arrows` 入力に対して常に同じ経路（ストレージ順による決定論性）
- [ ] エディタと共有ビューアで同じ経路（arrows ソート順統一）
- [ ] 既存の `arrow-routing.test.ts` (1318 行) すべて pass
- [ ] 新規 `edge-router.test.ts` のシナリオすべて pass
- [ ] LCP 1 秒以内 / 全テスト pass / Playwright 視覚検証 pass

## アーキテクチャ概要

```
[呼び出し側]
  FlowEditor.aPath / SharedFlowViewer.computeArrowPath
    ↓ ノード bbox 配列を従来通り組み立て
    ↓ ルーティング済みエッジの segments を累積（Map）
    ↓
  arrows を配列順に逐次処理（map 内で Map を更新）
    各エッジ B について:
      1. 共有ノード除外フィルタ
      2. 線分Bbox 化
      3. nodeObstacles と結合
      4. calcArrowPath 呼び出し
      5. 戻り値の segments[] を Map に追記
    ↓
[flow-engine.ts: calcArrowPath]
    ↓ パススルー（戻り値型に segments[] 追加）
    ↓
[arrow-routing.ts: buildArrowPath]
    ↓ 既存検出ロジック（detect*）は変更なし
    ↓ 各分岐で d 文字列を組み立てるのと同じ場所で segments[] を構築
    ↓ 戻り値: { d, mx, my, segments }
```

### 設計の肝

- arrow-routing.ts の**検出ロジック自体は変更しない**。すでに「obstacles に対して迂回する」抽象になっているので、obstacles の中身にエッジセグメントを混ぜれば自動的にエッジを避ける挙動が得られる。
- マルチエッジ協調の責務は**呼び出し側に集約**される。アーキテクチャ層を綺麗に分離。
- 共有ノード除外は**呼び出し側で実施**（arrow-routing.ts は edgeKey の意味を知らない方が良い）。

### 責務分担

| レイヤ                                  | 責務                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `routeAllArrows` (新規ヘルパー)         | arrows 配列を順次処理、Map による segments 累積、共有ノード除外、SharedViewer/Editor 共通化 |
| `FlowEditor.aPath` / `SharedFlowViewer` | `routeAllArrows` を呼ぶだけの薄い呼び出し側                                                 |
| `arrow-routing.ts: buildArrowPath`      | 既存ロジック + 各分岐で segments を並走計算                                                 |
| `arrow-routing.ts: detect*`             | 変更なし。`obstacles` の中身がノード由来かエッジ由来かは知らない                            |
| `arrow-routing.ts: segmentsToBboxes`    | EdgeSegment[] → Bbox[] 変換ヘルパー                                                         |

## 型定義と API

### 新規型 (`arrow-routing.ts`)

```ts
export interface EdgeSegment {
  orientation: 'h' | 'v' // 水平 or 垂直
  fixed: number // 水平なら y、垂直なら x
  range: [number, number] // 開始と終了の座標（min/max 正規化）
}
```

- `orientation: 'h'` は y = fixed の水平セグメント、x ∈ range
- `orientation: 'v'` は x = fixed の垂直セグメント、y ∈ range
- `edgeKey` は EdgeSegment 自体には含めない（arrow-routing.ts はエッジ識別を知らない）
- segments は始点から終点に向かう順序を保つ
- range は `[min, max]` に正規化

### 既存型の拡張 (`arrow-routing.ts`)

```ts
export interface ArrowPath {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[] // ← 追加
}
```

### 既存型の拡張 (`types.ts`)

```ts
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[] // ← 追加
}
```

### 呼び出し側ヘルパー (`arrow-routing.ts` に export)

```ts
export function segmentsToBboxes(segments: EdgeSegment[]): Bbox[]
```

- 水平セグメント: `{ x: (r0+r1)/2, y: fixed, w: |r1-r0|, h: 1 }`
- 垂直セグメント: `{ x: fixed, y: (r0+r1)/2, w: 1, h: |r1-r0| }`

### 新規モジュール (`src/features/editor/edge-router.ts`)

```ts
export interface ArrowResolveContext {
  from: Point
  to: Point
  config: ArrowConfig
  nodeObstacles: Bbox[]
}

export function routeAllArrows(
  arrows: InternalArrow[],
  resolveContext: (arrow: InternalArrow) => ArrowResolveContext | null,
): Array<ArrowPathResult | null>
```

`FlowEditor` と `SharedFlowViewer` の重複ロジックを集約。内部で:

- `priorSegmentsByEdge: Map<edgeId, EdgeSegment[]>`
- `edgeEndpoints: Map<edgeId, { from: string; to: string }>`
- 共有ノード除外と segments → Bbox 変換と calcArrowPath 呼び出し

### `buildArrowPath` のシグネチャ（変更なし）

```ts
export const buildArrowPath = (
  s: Point, e: Point, fc: Point, tc: Point,
  obstacles?: Bbox[]
): ArrowPath  // 戻り値型のみ拡張
```

引数は変更なし。obstacles に edge-derived Bbox を混ぜれば良いので呼び出し側のみの変更で済む。

## データフロー

### 現状 (FlowEditor.tsx:1424)

```ts
const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
  const obstacles = buildObstacles({ nodes: obstacleNodes, ... })  // ノードのみ
  return calcArrowPath(from, to, config, obstacles)
}
// 呼び出し: arrows.map(aPath) — 各エッジが独立
```

### 変更後

```ts
const arrowPaths = routeAllArrows(arrows, (arrow) => {
  const ft = tasks[arrow.from],
    tt = tasks[arrow.to]
  if (!ft || !tt) return null
  // ... fli/fri/tli/tri チェック、from/to 計算、buildObstacles 呼び出し
  return { from, to, config, nodeObstacles }
})
```

`routeAllArrows` の内部実装:

```ts
export function routeAllArrows(arrows, resolveContext) {
  const priorSegmentsByEdge = new Map<string, EdgeSegment[]>()
  const edgeEndpoints = new Map<string, { from: string; to: string }>()

  // arrows ソート順統一（エディタ/ビューア間の決定論性）
  const sortedArrows = [...arrows].sort((a, b) => a.id.localeCompare(b.id))

  return sortedArrows.map((arrow) => {
    const ctx = resolveContext(arrow)
    if (!ctx) return null

    // 共有ノード除外
    const foreignSegments: EdgeSegment[] = []
    for (const [eid, segs] of priorSegmentsByEdge) {
      const ep = edgeEndpoints.get(eid)!
      if (
        ep.from === arrow.from ||
        ep.from === arrow.to ||
        ep.to === arrow.from ||
        ep.to === arrow.to
      )
        continue
      foreignSegments.push(...segs)
    }

    const edgeObstacles = segmentsToBboxes(foreignSegments)
    const obstacles = [...ctx.nodeObstacles, ...edgeObstacles]

    const result = calcArrowPath(ctx.from, ctx.to, ctx.config, obstacles)
    if (result) {
      priorSegmentsByEdge.set(arrow.id, result.segments)
      edgeEndpoints.set(arrow.id, { from: arrow.from, to: arrow.to })
    }
    return result
  })
}
```

### 重要なポイント

1. **`Map` を使う理由**: 配列の reduce より「edgeId による参照」がデバッグしやすく、共有エッジ除外も O(N) のループで明示的。
2. **`map` のクロージャ内で `Map` を変更**: React の関数コンポーネント内なら毎レンダで Map が新規作成されるので副作用問題なし。
3. **逐次性**: `Array.prototype.map` は逐次実行が保証されている（仕様）。並列化は不要。
4. **`buildObstacles` 自体は変更しない**: 既存のスコープ制限はノード障害物用としてそのまま機能。エッジ Bbox は別経路で追加する。
5. **arrows ソート順**: `id.localeCompare` で決定論性を保証。エディタ/ビューア間の一致が必須。

### パフォーマンス

- 計算量: O(E² × S)（E = エッジ数、S = 平均セグメント数。各エッジが先行エッジ全部の segments を参照）
- 1 セグメントあたりの Bbox 化と obstacles 配列構築は O(1) 想定。E = 100 / S = 6 で約 60,000 オペレーション → 1 フレーム内で問題なし
- E > 200 になる規模では将来の段階2/3 で範囲インデックスを導入
- 段階1 完了時点で**実測ベンチを 1 つ追加**（後述）し、現実的なケースのレイテンシを記録

#### 実測値（2026-05-22 ベンチ）

`src/lib/edge-router.bench.ts` を vitest bench で実行（macOS, M-series, Node 22, vitest 4.0.18）。合成シナリオは:

- ノード障害物なし（`nodeObstacles: []`）
- from/to に共有エンドポイントを持たないペア（`node_i → node_{i+1 mod n}`）
- 10×10 グリッド上に座標展開、`ArrowConfig = { hw: 50, hh: 25, rh: 100 }`

| E   | ops/sec | mean (ms) | p99 (ms) |
| --- | ------- | --------- | -------- |
| 10  | 238,420 | 0.0042    | 0.0056   |
| 50  | 16,222  | 0.0616    | 0.0973   |
| 100 | 4,040   | 0.2475    | 0.6227   |
| 200 | 1,097   | 0.9113    | 1.3176   |

**結論**: E=200 でも mean ~0.91 ms / p99 ~1.32 ms と、1 フレーム（16.67 ms）予算の **6% 未満** で完了。
E² 増加（10→200 で 217×）はおおむね理論通りで、段階1 のターゲット規模（実運用 E ≤ 100 想定）には十二分。
段階2/3 の範囲インデックス導入は **E > 500 程度** まで保留して問題ない。

> 注: 合成シナリオは `nodeObstacles=[]` かつ共有エンドポイント無しのため、各エッジで `foreignSegments` が
> ほぼフルに蓄積される最悪ケースに近い。実フローでは共有エンドポイント除外と node 障害物の影響で値が
> 上下するが、segments 走査の主項は変わらないため上記オーダー感は妥当。

## エラー処理 / エッジケース

### ケース1: `calcArrowPath` が `null` を返す

`priorSegmentsByEdge` に登録しない。次のエッジには影響なし。

### ケース2: 循環するエッジ参照 (A→B→A)

純粋に配列順で処理。共有ノード除外により A と B は相互に obstacle にならない。

### ケース3: 同一 from/to のエッジ（重複矢印）

共有ノード除外で互いを obstacle 扱いせず、完全一致した経路。現状と同じ挙動。

### ケース4: `priorSegments` が空（最初のエッジ）

`foreignSegments` も空配列。従来通り node 障害物だけで経路計算。**最初のエッジの挙動は変わらない**。

### ケース5: エッジ Bbox が `collectObstacles` のスコープ制限で落ちる

エッジ Bbox は行 grid に整列していないので、`collectObstacles` の隣接行/列フィルタで落ちる可能性。

**対応**: エッジ Bbox は `collectObstacles` を経由せず、`buildObstacles` の戻り値に直接 append（`[...nodeObstacles, ...edgeObstacles]`）。

### ケース6: 上下塞がり判定がエッジ Bbox で誤動作する可能性

`detectDetour` の `downBlocked`/`upBlocked` は obstacles 全体を見るため、薄いエッジ Bbox が誤判定要因になり得る。

**対応（オプション）**: 必要なら `detectDetour` 側で「`Bbox.h < 3` の障害物は塞がり判定に使わない」フィルタを追加。段階1 ではまず素朴に実装し、テストで顕在化させてから対応判断。

### ケース7: 自己交差

既存の `clampOffset` / `halfDx`-clamp は座標ベースなのでエッジ Bbox にも適用される想定。テストで検証必須。

### ケース8: arrows の順序が変わるケース

ルーティング順は `routeAllArrows` 内で `id.localeCompare` でソートする（ケース9 参照）。元の `arrows` 配列の順序が変動しても、ソート後の順序は安定。

### ケース9: SharedFlowViewer で arrows 順序がエディタと一致しない

両側で同じデータソース（DB）から取得しているため、配列順は通常一致する。万が一の divergence に備え、`routeAllArrows` 内で `arrows.sort((a, b) => a.id.localeCompare(b.id))` を実施し、id 辞書順で決定論性を保証する。

**注意**: これは「作成順」とは限らない（id が UUID なら実質ランダムな決定論順）。重要なのは「同じ入力に対して同じ結果」であって、「最古のエッジが優先」という意味論は保証しない。将来「作成順」が必要になったら `createdAt` フィールドの導入とソートキー変更で対応。

## テスト戦略

### TDD 順序

#### Red Phase

**新規テストファイル**: `src/features/editor/edge-router.test.ts`

シナリオ:

1. 2 エッジが同一通路に集中（A: P0→P2、B: P1→P2）→ B が A を避ける
2. 3 エッジが同一ターゲットに到着（混線カウントが減ることを確認）
3. 共有 from のエッジ → 互いを obstacle 扱いしない
4. 共有 to のエッジ → 互いを obstacle 扱いしない
5. 斜め交差 → 後発が回避
6. arrows 順序の安定性 → 同じ入力で同じ結果

#### Green Phase

順序:

1. `EdgeSegment` 型追加 + `segmentsToBboxes` ヘルパー
2. `buildArrowPath` 各分岐で segments を構築（既存テストは破壊しない、追加のみ）
3. `arrow-routing.test.ts` に segments 出力の網羅テスト追加
4. `routeAllArrows` ヘルパー作成
5. `FlowEditor.aPath` を置き換え
6. `SharedFlowViewer` を置き換え
7. Red の `edge-router.test.ts` を Green に通す

### 既存テストへの影響

- `arrow-routing.test.ts` (1318 行): segments は追加フィールド。既存の `d` / `mx` / `my` assert は全て pass のまま。
- `flow-engine.test.ts`: `ArrowPathResult` 型拡張で型エラーが出る可能性。ロジック変更不要。
- snapshot 系: 要事前確認。差分が出るなら期待値再生成。

### testing.md チェックリスト適用

- 空の値: `arrows = []` で何も起きない
- null系: `tasks[arrow.from] === undefined` でルーティング skip
- 数値: 重なるノード、ゼロ長エッジは現状仕様（段階1スコープ外）
- 重複: 共有 from/to の正常系として上記カバー
- 競合: 該当なし（純粋関数）
- クリティカルパス: 経路計算は「データ変換ロジック」相当。**100% 必須**

### Playwright 視覚検証（成功基準）

新規シナリオ:

- `e2e/edge-routing-multi-edge.spec.ts`（新規）
- ユーザー提供のスクショ相当のフロー（複数エッジが同一ターゲット）を再現
- **判定方法**: 修正前後でスクリーンショットを取得し `.screenshots/multi-edge-{before,after}.png` として保存。before の SVG 経路 (`<path>` の `d` 属性) を全エッジ分パースし、ペアごとの線分交差数をカウント。after で **交差数が strict に減少**することを assert
- スクショ自体はレビュー時の目視確認用。assert はロジック層で実施

### 段階1 完了時のベンチマーク（必須）

`edge-router.bench.ts` を新規追加:

- E = 10 / 50 / 100 / 200 の合成シナリオを用意
- `routeAllArrows` 単独の実行時間を計測し、設計ドキュメントの「計算量」セクションに実測値を追記
- 200 本で 16ms（1 フレーム）を超えるなら段階2 への昇格を検討

### カバレッジ目標

- `arrow-routing.ts` の segments 構築コード: **100%**
- `edge-router.ts`: **100%**
- 各シナリオ: 全て pass

### Refactor Phase

- `buildArrowPath` の各分岐で segments 構築が重複するなら small helper にまとめる
- 「2 回似たコード」段階では DRY せず、3 回目から共通化（YAGNI 原則）

## 段階2 以降の予告（スコープ外、参考）

- **段階2: チャネル/トラック割り当て** — 複数エッジが同じ迂回経路に集中するケースで、迂回 Y を 1 点ではなく動的に複数トラックに発行
- **段階3: ルーティング順序の戦略** — 長辺優先・トポロジカル順などで経路品質を最適化

これらは段階1 で得られる経路の安定性と segments 累積基盤を前提とする。
