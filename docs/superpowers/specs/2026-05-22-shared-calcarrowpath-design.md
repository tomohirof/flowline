# SharedFlowViewer の矢印描画を calcArrowPath に統一

- 関連 issue: #356
- 関連 PR: #352 (#349)
- 関連バグ: #69（共有ビュー描画とエディタの不整合）

## 背景

`SharedFlowViewer.tsx:129-157` は `exitPt → entryPt → buildArrowPath` を直接呼び出している。一方 `FlowEditor.tsx` は同じ 3 呼び出しを `calcArrowPath` ラッパー（`src/lib/flow-engine.ts:35-46`）に集約済み。

機能上の問題はないが、将来 `calcArrowPath` の内部に変更があった場合 SharedFlowViewer 側が追従漏れを起こすリスクがある。実際 #69 で同種の不整合バグの実績あり。

## 目標

- SharedFlowViewer も `calcArrowPath` 経由で矢印パスを計算するよう統一
- 描画結果は完全一致（リグレッションなし）

## 非目標

- `buildObstacles` 周りの変更。`calcArrowPath` は `obstacles?: Bbox[]` を受け取る薄いラッパーなので、obstacles 構築ロジックはこれまで通り呼び出し側に残す。
- `DS` 定数の扱い変更（diamond polygon points で `SharedFlowViewer:375` が引き続き使用）。

## 変更内容

### Before（SharedFlowViewer.tsx:129-157 抜粋）

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
const e = entryPt(t, f, hw, hh, RH, toNode.shape as 'diamond' | undefined)
// ... buildObstacles({...})
return buildArrowPath(s, e, f, t, obstacles)
```

### After

```ts
// ... buildObstacles({...}) は変更なし
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
  },
  obstacles,
)
```

### import の整理

`src/features/shared/SharedFlowViewer.tsx` のトップレベル import から `exitPt`, `entryPt`, `buildArrowPath` を削除（未使用となる）。`buildObstacles`, `DS`, `Point`, `Bbox`, `ObstacleNode` は引き続き使用するため残す。

`calcArrowPath` を `../../lib/flow-engine` から import。

## 検証

- 既存テスト（vitest）全 pass
- 共有 URL を開いて矢印描画がエディタと完全一致することを目視確認
- `npm run build` / `npx tsc -b` pass
- LCP 1 秒以内（リファクタなので変化なし想定）

## 影響範囲

- 変更: `src/features/shared/SharedFlowViewer.tsx` のみ
- 行数: imports 3 行削除 + 1 行追加、関数本体 ~10 行 → 1 関数呼び出しに置換

## 工数

30 分以内
