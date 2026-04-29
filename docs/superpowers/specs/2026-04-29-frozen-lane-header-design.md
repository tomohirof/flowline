# レーンヘッダー固定表示（CSS sticky 方式）

- 関連 Issue: [#322](https://github.com/tomohirof/flowline/issues/322)
- 作成日: 2026-04-29
- 方式: ヘッダーSVG + CSS `position: sticky`（独自案C）

## 背景

行数の多いフローを縦にスクロールすると、レーンヘッダー（レーン名・色アクセント）が画面外に流れて見えなくなる。スプレッドシート的に「ヘッダー行をフリーズ」して常に画面上部に表示したい。

### 現状の構造

- キャンバス: `.canvas` div（`overflow: auto`）内に **単一の `<svg>`**（`src/features/editor/FlowEditor.tsx:1864-1900`）
- レーンヘッダーは SVG 内部の `<g>` として `y=TM (24)` 位置に矩形 + ラインアクセント + ドット + ラベル文字（`FlowEditor.tsx:1939-2020`）
- 縦スクロール時に SVG ごと上に流れるためヘッダーも消える
- 共有ビュー（`src/features/shared/SharedFlowViewer.tsx:240-322`）も同じ構造で同じ問題あり

## スコープ

- 縦方向のみ固定（横スクロール時はヘッダーも一緒に追従）
- エディタ（`FlowEditor`）と共有ビュー（`SharedFlowViewer`）の両方に適用
- デモエディタ（`DemoEditorPage`）は内部で `FlowEditor` を呼ぶため自動対応

## 受け入れ条件（Issue より）

- [ ] エディタ画面で縦スクロールしてもレーンヘッダー（背景・色アクセント・ドット・レーン名）が画面上部に残る
- [ ] 横スクロール時はレーンヘッダーも一緒に横移動する（位置整合）
- [ ] レーン名のダブルクリック → インライン編集（`<foreignObject>` の `input`）が引き続き動作
- [ ] レーン選択時に出る `←` / `→` 移動ボタン（ヘッダーの上に表示）も固定される
- [ ] 親レーン + サブレーン構成の場合も、親ヘッダーが固定される（サブには元々ヘッダーなし）
- [ ] ズーム機能（`zoom`）適用中も固定が維持される
- [ ] 共有ビュー（`SharedFlowViewer`）にも同じ挙動を適用
- [ ] 既存テスト全て pass、新規にスクロール時のヘッダー残留を確認するテストを追加（unit + Playwright）

## アプローチ比較

| 案                                      | DOM変更 | 横スクロール同期                    | ズーム整合          | 既存ロジック流用度 | 実装難易度 |
| --------------------------------------- | ------- | ----------------------------------- | ------------------- | ------------------ | ---------- |
| A: ヘッダー別SVG（手動同期）            | 中      | 手動同期（`onScroll` → translateX） | viewBox両方スケール | ✓                  | 中         |
| B: 単一SVG + transform                  | 小      | 不要（同一SVG）                     | 二重計算で複雑      | △                  | 高         |
| **C: ヘッダーSVG + CSS sticky（採用）** | 中      | **不要（ブラウザ任せ）**            | viewBox両方スケール | ✓                  | 低         |

採用理由: A と DOM 変更量はほぼ同じだが、横スクロール同期コードが不要になり、`requestAnimationFrame` 間引きや `onScroll` ハンドラを書かずに済む。`position: sticky` はブラウザが GPU 合成で扱うため高性能。

## アーキテクチャ

```
.canvas (overflow:auto, position:relative)
├─ <svg className=headerSvg position:sticky top:0 z-index:10>   ← 固定対象
│   width = svgW
│   height = (TM + HH) * zoom + ヘッダー上余白(30 * zoom)
│   viewBox = `0 -30 svgW/zoom (TM + HH + 30)/zoom`
│   ・レーン背景の上半分（rx=10, ヘッダー部分）
│   ・色アクセントライン、ドット、ラベル / foreignObject input
│   ・選択ハイライトのヘッダー部分（上半分のみ）
│   ・レーン移動ボタン（←/→） — y = TM - 14
│   ・Gap "+" hit 領域 + ホバー時の `+` ボタン円
│   box-shadow: 0 2px 4px rgba(0,0,0,0.05)   ← 固定中の視覚的境界
└─ <svg className=bodySvg>   ← スクロール対象
    width = svgW
    height = svgH - ヘッダーSVG高さ
    viewBox = `0 0 svgW/zoom (rows.length * RH + 余白)/zoom`
    ・レーン背景の本体部分（rx=0, 高さ = fullH - HH）
    ・本体側選択ハイライト（点線枠）
    ・サブレーン縦点線
    ・行ライン、行番号、タスク、矢印、メモ
    ・Gap "+" ホバー時の縦点線（本体高さ分）
```

### レイアウト定数（既存）

| 定数 | 値   | 意味                           |
| ---- | ---- | ------------------------------ |
| `TM` | 24   | キャンバス上余白（Top Margin） |
| `HH` | 46   | ヘッダー高さ（Header Height）  |
| `RH` | 84   | 行高さ（Row Height）           |
| `LW` | 動的 | レーン幅（calcLaneWidth）      |
| `LM` | 28   | 左余白                         |
| `G`  | 動的 | レーン間ギャップ               |

ヘッダーSVG が占める範囲: y = `-30` ～ `TM + HH = 70`（高さ 100、ズーム適用後 `100 * zoom` px）

## コンポーネント / 描画責務分担

`FlowEditor.tsx` 内に以下のレンダリングセクションを 2 SVG に分割する（別ファイル化はしない）。

| セクション                             | ヘッダーSVG                                     | 本体SVG                                         |
| -------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| レーン背景 rect                        | 上半分（`y=TM, height=HH, rx=10`）              | 本体部分（`y=0(local), height=fullH-HH, rx=0`） |
| 色アクセントライン / ドット / ラベル   | ✓                                               | —                                               |
| foreignObject input（編集中）          | ✓                                               | —                                               |
| 選択ハイライト rect                    | 上半分（点線枠）                                | 本体部分（点線枠）                              |
| サブレーン縦点線                       | —                                               | ✓                                               |
| 行ライン                               | —                                               | ✓                                               |
| レーン移動ボタン（←/→）                | ✓                                               | —                                               |
| Gap "+" hit 領域                       | ✓（既存どおり `y=0, height=TM+HH` の hit rect） | —                                               |
| Gap "+" ホバー時の `+` ボタン円        | ✓（`cy = TM + HH/2`）                           | —                                               |
| Gap "+" ホバー時の縦点線（本体高さ分） | —                                               | ✓（`y1=0, y2=rows.length*RH` 本体ローカル）     |
| 行番号                                 | —                                               | ✓                                               |
| タスク（ノード）                       | —                                               | ✓                                               |
| 矢印                                   | —                                               | ✓                                               |
| メモ                                   | —                                               | ✓                                               |

### ハイライト rect の分割（地雷#1 への対応）

現状（`FlowEditor.tsx:1925-1938`）はヘッダーと本体にまたがる 1 枚の rect で描画。これを 2 つに分割:

- **ヘッダー側**: `x+1, y=TM+1, width=LW-2, height=HH-2, rx=9`、点線、`stroke=accent`
- **本体側**: `x+1, y=1(本体ローカル), width=LW-2, height=fullH-HH-2, rx=0`、点線、`stroke=accent`

サブレーン（`isSub`）の場合、ヘッダー側ハイライトは描画せず本体側のみ。

### アニメーション（地雷#4 への対応）

`slidingLaneId === lane.id` のとき、ヘッダーSVG 側 `<g>` と本体SVG 側 `<g>` の両方に `styles.laneSlideInAnim` を当てる。同じ keyframes を同時再生することで位置が一致する。

### foreignObject（地雷#2 への対応）

ヘッダーSVG 内に移植。`laneInputRef` は 1 つのまま。`onBlur`/`onKeyDown` ハンドラもそのまま。

### ズーム整合（受け入れ基準⑥への対応）

- 両 SVG の `width = svgW`
- 両 SVG の `viewBox` の幅 = `svgW / zoom`
- ヘッダー SVG の高さ = `(TM + HH + 30) * zoom`（移動ボタンの上余白を含む）
- 本体 SVG の高さ = `Math.max(containerSize.height - (TM + HH + 30) * zoom, (rows.length * RH + 余白) * zoom)`

## データフロー & 状態管理

**新規 state はゼロ。** 既存の `lanes`, `selLane`, `editLane`, `slidingLaneId`, `hoveredLaneGap`, `zoom`, `containerSize` をそのまま両 SVG が参照する。

### ref の扱い

- `svgRef`: **本体 SVG に付ける**（既存のマウス座標計算ロジックが本体側基準のため）
- `canvasContainerRef`: `.canvas` のまま。スクロール位置は `.canvas` が持つ
- `headerSvgRef`: 不要（ヘッダーには複雑なマウス操作なし）

### マウスイベント

- ヘッダー側のクリック（レーン選択）/ ダブルクリック（編集）/ Gap "+" のホバー: ヘッダーSVG 内の要素に直接付与
- 本体側ドラッグ系（`onSvgMouseMove`, `onSvgMouseUp`, `onSvgMouseLeave`）: 本体 SVG にのみ付与
- ドラッグ中にヘッダー領域を超えたケース: 既存の `onMouseLeave` で dragging クリアする保険があるため問題なし

## エラーハンドリング・エッジケース

| ケース                   | 対処                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| 親+サブレーン構成        | 親ヘッダー幅 `getGroupWidth(lane, lanes, LW, G)` をヘッダーSVG 側でも同じ計算で使う |
| ヘッダー下境界の視認性   | `.headerSvg { box-shadow: 0 2px 4px rgba(0,0,0,0.05); }` で固定中の境界を明示       |
| ヘッダーちらつき         | `position: sticky` は GPU 合成。問題が出たら `will-change: transform` を追加        |
| 共有ビュー               | `SharedFlowViewer` も同じ 2 段構成。編集機能なしでシンプル化                        |
| Safari/Firefox           | `position: sticky` は両ブラウザで安定動作（caniuse 96%+）                           |
| レーン追加アニメーション | ヘッダー / 本体 `<g>` の両方に同じ `laneSlideInAnim` class を当てる                 |
| レーン移動ボタン         | ヘッダーSVG の viewBox y 範囲 `-30 ～ TM+HH` に収まるため切れない                   |
| デモエディタ             | `FlowEditor` を呼んでいるだけなので自動対応                                         |
| 横スクロール時の同期     | ブラウザの sticky 挙動に依存（手動同期コード不要）                                  |

## CSS 変更（FlowEditor.module.css）

```css
.canvas {
  flex: 1;
  overflow: auto;
  position: relative; /* sticky の親に必要 */
  background: var(--theme-canvas-bg);
  background-image: radial-gradient(circle, var(--theme-dot-grid) 0.5px, transparent 0.5px);
}

.headerSvg {
  position: sticky;
  top: 0;
  z-index: 10;
  display: block;
  background: var(--theme-canvas-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: visible;
}

.bodySvg {
  display: block;
  overflow: visible;
}
```

注意: `.canvas` の dot grid 背景は body 部分のみに見えればよい（ヘッダーSVG 自身が背景色を持つため、ヘッダー部分の dot は隠れる）。

## テスト戦略

### Unit (Vitest)

`src/features/editor/FlowEditor.test.tsx` に追記:

- `data-testid="canvas-header-svg"` と `data-testid="canvas-svg"` の 2 つが描画されること
- ヘッダーSVG にレーン名 `<text>` と色アクセント `<circle>` が含まれること
- 本体SVG にはレーンヘッダー要素（ドット circle, ヘッダー rect rx=10）が **含まれない** こと
- 親 + サブ構成で親ヘッダー幅 = `getGroupWidth(...)` であること
- レーン選択時、ヘッダー側ハイライト rect と本体側ハイライト rect が両方描画されること
- ダブルクリックでヘッダーSVG 側 foreignObject の input が出ること
- レーン移動ボタン（←/→）がヘッダーSVG 内に描画されること

`src/features/shared/SharedFlowViewer.test.tsx` に追記:

- ヘッダーSVG / 本体 SVG が分離されていること
- レーン名がヘッダーSVG 側に描画されること

### E2E (Playwright)

`e2e/lane-header-sticky.spec.ts` 新規:

- フローを開く → 本体エリアを `evaluate(el => el.scrollBy(0, 600))` → レーン名 `<text>` の `getBoundingClientRect().top` がビューポート上端付近（< 100px）に残ることを確認
- 横スクロール → ヘッダー名の `left` がコンテンツと同じだけ動くこと
- ヘッダーをダブルクリック → input フォーカス → 編集 → blur で保存
- 共有ビュー（`/share/...`）でも同じスクロール動作

### 既存テストへの影響

- `data-testid="canvas-svg"` を参照しているテストは本体SVG を指すため変更不要
- ヘッダー要素を SVG 全体から探していたテストは、ヘッダーSVG 側を見るよう調整が必要（影響箇所は実装時に grep で洗い出し）

## 実装順序の目安

1. CSS（`.headerSvg` / `.bodySvg` / `.canvas` の `position: relative`）
2. `FlowEditor.tsx` に `<svg headerSvg>` を追加し、レーンヘッダー描画ロジックを移植
3. レーン選択ハイライト rect を 2 分割
4. レーン移動ボタンと Gap "+" hit を 2 SVG に分散
5. アニメーション class を両方に当てる
6. `SharedFlowViewer.tsx` にも同じ 2 段構成を適用
7. Unit テスト追加
8. Playwright E2E 追加

## YAGNI（含めないもの）

- 横方向の sticky（左端固定）: Issue スコープ外
- ヘッダー高さの動的調整: 現状 HH=46 固定で問題なし
- ヘッダー描画ロジックの別ファイル化: 描画は FlowEditor 内に閉じる方が状態参照がシンプル
- `headerSvgRef`: 現状不要

## 参考ファイル

- `src/features/editor/FlowEditor.tsx:1864-2049`（キャンバス・レーンヘッダー描画）
- `src/features/editor/FlowEditor.tsx:2050-2145`（レーン移動ボタン）
- `src/features/editor/FlowEditor.module.css:315-324`（.canvas / .svg）
- `src/features/shared/SharedFlowViewer.tsx:240-322`（共有ビューのレーン描画）
