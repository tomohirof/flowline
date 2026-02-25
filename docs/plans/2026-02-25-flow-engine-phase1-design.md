# flow-engine Phase 1 設計書

## 概要

`FlowEditor.tsx`（3,200行超）に残存するグラフ操作ロジックを `src/lib/flow-engine.ts` に純粋関数として切り出す。DOM/React/SVGに一切依存しない。動作は変えない。

## ファイル構造

```
src/lib/
├── arrow-routing.ts         (既存 — exitPt, entryPt, buildArrowPath — 変更なし)
├── flow-engine.ts           (新規 — 6関数)
└── flow-engine.test.ts      (新規 — 6カテゴリ)
```

## API設計

### ① ルーティングラッパー

```typescript
interface NodePos { x: number; y: number }
interface ArrowConfig { hw: number; hh: number; rh: number }

calcArrowPath(from: NodePos, to: NodePos, config: ArrowConfig)
  → { d: string; mx: number; my: number } | null
```

`arrow-routing.ts` の `exitPt` → `entryPt` → `buildArrowPath` を順に呼ぶ薄いラッパー。座標解決はUI層で行い、解決済みの値を渡す。

将来diamond対応時に `config` に `shape`/`DS` を追加できるよう、objectで受け取る設計。

### ② 矢印変換

```typescript
remapArrows(arrows: InternalArrow[], oldKey: string, newKey: string)
  → InternalArrow[]

filterArrowsByDeletedKeys(arrows: InternalArrow[], deletedKeys: Set<string>)
  → InternalArrow[]
```

現在 `moveTask`（L999-1001）、`rmRow`（L1089）、`rmLane`（L1104）にインラインで書かれている矢印操作をそのまま関数化。

> **将来の分離候補:** この2関数は汎用ユーティリティの性格が強い。Phase 1では `flow-engine.ts` に配置するが、ファイルが肥大化した場合は `arrow-utils.ts` に分離を検討する。

### ③ チェーン操作（新規実装）

```typescript
findChain(
  arrows: { from: string; to: string }[],
  tasks: Record<string, { lid: string; rid: string }>,
  laneId: string
) → string[]

detectReorder(
  chain: string[],
  tasks: Record<string, { rid: string }>,
  rows: { id: string }[]
) → { changed: boolean; current: string[]; proposed: string[] }

reconnectChain(sortedKeys: string[])
  → { from: string; to: string }[]
```

- `findChain`: 指定レーン内で矢印チェーンをたどり、チェーン順のkey配列を返す。**循環参照対策として `visited Set` を使用し、無限ループを防止する。**
- `detectReorder`: チェーンの現在順と行位置順を比較し、並び替えが必要か判定。
- `reconnectChain`: 位置順のkey配列から隣接ペアの矢印配列を生成。

## FlowEditor.tsx の差し替え箇所

| 箇所       | 行         | 現在                                                         | 差し替え後                                                          |
| ---------- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `moveTask` | L999-1001  | `p.map(a => ({...a, from: a.from===fk ? nk : a.from, ...}))` | `remapArrows(p, fk, nk)`                                            |
| `rmRow`    | L1089      | `p.filter(a => !rm.includes(a.from) && !rm.includes(a.to))`  | `filterArrowsByDeletedKeys(p, new Set(rm))`                         |
| `rmLane`   | L1104      | 同上                                                         | `filterArrowsByDeletedKeys(p, new Set(rm))`                         |
| `aPath`    | L1108-1124 | 関数全体                                                     | 座標解決をUI層に残し `calcArrowPath(fromPos, toPos, config)` を呼ぶ |

**座標解決（`tasks[arrow.from]`, `liMap`, `riMap`, `ct()`）はFlowEditor側に残す。`calcArrowPath` には解決済みの `{x, y}` のみ渡す。**

## テスト戦略

```
flow-engine.test.ts
├── describe('calcArrowPath')
│   ├── ① 同レーン下方向 — 下端→上端
│   ├── ① 別レーン横方向 — 右端→左端
│   ├── ② 同レーンから別レーンへ移動で向き変化
│   └── ③ diamond分岐（test.todo × 3）
├── describe('remapArrows')
│   ├── 単一矢印のfrom書き換え
│   ├── 単一矢印のto書き換え
│   ├── 複数矢印の同時書き換え
│   └── 該当なしの場合は変更なし
├── describe('filterArrowsByDeletedKeys')
│   ├── from側のキーで削除
│   ├── to側のキーで削除
│   ├── 空Set → 全矢印残存
│   └── 全キー削除 → 空配列
├── describe('findChain')
│   ├── 線形チェーン（A→B→C）
│   ├── 分岐あり → 指定レーンのみ返す
│   ├── 空矢印 → 空配列
│   └── 循環参照 → 無限ループせず安全に停止
├── describe('detectReorder')
│   ├── ④ 移動後の並び替え検出
│   ├── 変更なしの場合 changed=false
│   └── 空チェーン → changed=false
├── describe('reconnectChain')
│   ├── ④ 位置順の再接続
│   ├── 単一ノード → 空配列
│   └── 2ノード → 1矢印
└── describe('統合テスト')
    ├── ⑤ A→B→C の B 削除で A→C（computeBridgeArrows連携）
    └── ⑥ 再接続後の全矢印ルーティング方向検証
```

⑥が最重要。`reconnectChain` で生成した矢印ペアに対して `exitPt`/`entryPt` を呼び、全ペアで「出口=下端、入口=上端、X座標一致」を検証する。

## diamond対応

Phase 1では含めない。テスト③は `test.todo()` で予約。diamond-node実装時に `exitPt`/`entryPt` に `shape`/`DS` パラメータを追加し、テストを有効化する。

## スコープ外

| やらないこと                   | 理由                                         |
| ------------------------------ | -------------------------------------------- |
| 制約ソルバー / 物理エンジン    | グリッド構造では不要                         |
| Strategy パターン              | 現状1パターンしかない                        |
| ビジュアル回帰テスト           | UIが頻繁に変わるフェーズでは維持コストが高い |
| Reducer化 / 状態管理ライブラリ | 切り出しとは独立した判断                     |

## 完了条件

- [ ] `flow-engine.ts` に6関数が切り出されている
- [ ] FlowEditor.tsx からは import で呼んでいる
- [ ] 全関数がDOM/React非依存
- [ ] 6カテゴリのユニットテスト（矢印方向検証含む）
- [ ] 動作が切り出し前と同一
- [ ] `npm test` 全テスト通過
