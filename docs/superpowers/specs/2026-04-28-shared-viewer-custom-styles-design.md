# 共有ビュー (SharedFlowViewer) のカスタムスタイル反映

- Issue: [#312](https://github.com/tomohirof/flowline/issues/312)
- Date: 2026-04-28
- Status: Approved

## 背景

共有URL (`/s/:token`) で表示される `SharedFlowViewer` で、エディタ側で設定したノード・矢印のカスタムスタイル（破線・色）が反映されない。

報告事例: 矢印の破線設定が共有ビューでは実線として表示される。

API (`api/lib/flow-transform.ts`) は `dash` / `color` / `strokeColor` / `bg` を正しく返している。問題は描画側で、`SharedFlowViewer.tsx` の SVG 描画コードがこれらの値を読まず、テーマのデフォルト値をハードコードで使用している点にある。

エディタ側 (`FlowEditor.tsx`) には既に正しいフォールバックパターンが存在しており、**そのパターンを共有ビューにも適用する** だけで解決する。

## 目的

共有ビューでも、エディタで設定した以下のスタイルが反映されること：

- ノード: `bg`（背景色）/ `strokeColor`（枠の色）/ `dash`（枠の種類: 実線/破線/点線/一点鎖線）
- 矢印: `color`（線の色）/ `dash`（線の種類）/ 矢印先端マーカーの色も本体と同じに揃える

## 非目的（スコープ外）

- OGP 画像生成 (`workers/ogp/src/index.ts`) の同種問題（必要に応じて別 issue 化）
- 共有ビューでの選択状態・ホバー状態のスタイル（共有ビューには存在しない）
- メモ・コメント等のスタイル（本 issue の対象外）

## アーキテクチャ

新規ロジックは追加しない。エディタ側にすでに存在するフォールバックパターン

```
カスタム値 || テーマデフォルト値
```

を `SharedFlowViewer.tsx` の描画箇所に移植する。

### データフロー

```
DB → api/lib/flow-transform.ts → SharedFlowViewer の props
  (flow.nodes[].bg/dash/strokeColor, flow.arrows[].color/dash)
→ SVG 描画
```

データは既に props に届いている。**描画側を読むだけ** で完結する。

## 修正箇所

`src/features/shared/SharedFlowViewer.tsx` の以下3箇所：

### 1. Diamond ノード (現 L313-322)

| プロパティ | 現状 | 修正後 |
|---|---|---|
| `fill` | `T.nodeFill` | `node.bg \|\| T.nodeFill` |
| `stroke` | `T.accent` | `node.strokeColor \|\| T.accent` |
| `strokeDasharray` | （未設定） | `node.dash \|\| 'none'` |

### 2. Rect ノード (現 L324-336)

| プロパティ | 現状 | 修正後 |
|---|---|---|
| `fill` | `T.nodeFill` | `node.bg \|\| T.nodeFill` |
| `stroke` | `T.nodeStroke` | `node.strokeColor \|\| T.nodeStroke` |
| `strokeDasharray` | （未設定） | `node.dash \|\| 'none'` |

### 3. Arrow path および marker (現 L460, L463-469)

| 要素 | プロパティ | 現状 | 修正後 |
|---|---|---|---|
| `<marker>` 内 polygon | `fill` | `T.arrowColor` | `arrow.color \|\| T.arrowColor` |
| `<path>` | `stroke` | `T.arrowColor` | `arrow.color \|\| T.arrowColor` |
| `<path>` | `strokeDasharray` | （未設定） | `arrow.dash \|\| 'none'` |

矢印先端マーカーの色も本体と揃える。これによりエディタの挙動と整合し、「線の色は変わったが矢印先端だけテーマカラーのまま」という見た目の不整合を防ぐ。

## 型の確認ポイント

`SharedFlowViewer` が受け取る `node` / `arrow` の型に `bg` / `dash` / `strokeColor` / `color` が含まれているか確認する。含まれていなければ API のレスポンス型と整合させて型を追加する。

## テスト戦略（TDD: Red → Green）

既存 `src/features/shared/SharedFlowViewer.test.tsx` に以下のテストを追加する。各 SVG 要素は属性ベースのクエリ（例: `document.querySelector('rect[stroke-dasharray="8,4"]')`）または `data-testid` で取得する。

| # | 検証内容 |
|---|---|
| 1 | `arrow.dash` が `<path>` の `stroke-dasharray` に反映される |
| 2 | `arrow.color` が `<path>` の `stroke` に反映される |
| 3 | `arrow.color` が `<marker>` 内 polygon の `fill` に反映される |
| 4 | `node.dash` が `<rect>` の `stroke-dasharray` に反映される |
| 5 | `node.bg` が `<rect>` の `fill` に反映される |
| 6 | `node.strokeColor` が `<rect>` の `stroke` に反映される |
| 7 | diamond ノードでも `bg` / `strokeColor` / `dash` が反映される |
| 8 | スタイル未指定時はテーマのデフォルト値で描画される（既存挙動の回帰防止） |

実装フロー：
1. **Red**: 上記テストを追加して失敗を確認
2. **Green**: `SharedFlowViewer.tsx` の3箇所を修正してテストを通す
3. **Refactor**: 必要に応じて整理

## エラーハンドリング

不正値（無効な色文字列など）は SVG 側で無視されるだけなので、検証は不要。空文字列は `||` で fallback されるため問題なし。

## 影響範囲

- **修正ファイル**:
  - `src/features/shared/SharedFlowViewer.tsx`
  - 必要なら共有ビュー用の型定義ファイル
- **テストファイル**: `src/features/shared/SharedFlowViewer.test.tsx`
- **波及なし**: エディタ・OGP Worker・API は変更しない

## 互換性・回帰防止

- 既存の `node` / `arrow` で `bg` / `dash` / `strokeColor` / `color` が `null` / `undefined` の場合は従来どおりテーマデフォルト値で描画される（テスト #8 で担保）
- `STROKE_STYLES` (`theme-constants.ts`) の `dash` 値（`'none'`, `'8,4'`, `'3,3'`, `'8,3,2,3'`）は `stroke-dasharray` 属性にそのまま渡せるフォーマットなので、変換は不要

## 検証

1. `npm test` で全テスト通過を確認
2. Playwright または chrome-devtools により共有ビュー (`/s/:token`) を実画面で確認：
   - 破線・点線・一点鎖線の矢印が反映される
   - カスタム色のノード・矢印が反映される
   - スタイル未指定のノード・矢印は従来どおり表示される
3. LCP が 1秒以内であることを確認
