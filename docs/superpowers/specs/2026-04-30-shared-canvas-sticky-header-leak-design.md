# Issue #330: 共有ビューでスクロール時、固定レーンヘッダーの上に本体コンテンツが露出する

- 対象 Issue: https://github.com/tomohirof/flowline/issues/330
- 関連 PR: #322 (sticky ヘッダー機能の元実装)
- 作成日: 2026-04-30

## 問題

共有 URL のビュー（`SharedFlowViewer`）で縦スクロールすると、固定されたレーン名ヘッダーの上の領域に、レーン本体（ノード・矢印・レーン背景など）のコンテンツが流れて表示される。エディット画面（`FlowEditor`）では同じ sticky 機能が正しく動作している。

## 根本原因

`src/features/shared/SharedFlowViewer.module.css` の `.canvas` に `padding: 40px` が指定されている。

```css
.canvas {
  padding: 40px; /* ← 問題の元 */
}
.headerSvg {
  position: sticky;
  top: 0;
}
```

`position: sticky; top: 0` は scroll 親要素の content edge（padding の内側）からの距離で固定位置を計算する。`.canvas` に `padding-top: 40px` があるため、ヘッダーは「キャンバス可視最上部から 40px 下」に貼り付く。その 40px の隙間は `.canvas` のスクロール領域なので、`bodySvg` のレーン背景・ノード等がスクロールに合わせてその隙間を通り抜け、ヘッダーの上に露出する。

エディット画面 (`src/features/editor/FlowEditor.module.css`) の `.canvas` は `padding` なしのため隙間が発生しない。

## 解決方針

`.canvas` の縦方向 padding を外し、可視最上部に sticky ヘッダーが貼り付くようにする。`.titleHero` は元々 `margin: -40px ...` で padding を相殺していたため、その負マージンも合わせて削除する。

### CSS 修正（`SharedFlowViewer.module.css`）

```diff
 .canvas {
   flex: 1;
   overflow: auto;
   background: var(--theme-canvas-bg);
   background-image: radial-gradient(circle, var(--theme-dot-grid) 0.5px, transparent 0.5px);
-  padding: 40px;
+  padding: 0 40px 40px;
   transition: filter 0.4s;
   position: relative;
 }

 .titleHero {
   padding: 28px 28px 18px;
   background: linear-gradient(180deg, var(--theme-hero-gradient) 0%, transparent 100%);
-  margin: -40px -40px 0 -40px;
+  margin: 0 -40px 0 -40px;
   padding-right: 40px;
   position: sticky;
   left: 0;
   z-index: 1;
 }
```

横方向の padding は横スクロール時の見た目に必要なので維持する。

## 検討した代替案

- **wrapper div で 40px スペーサー追加**: DOM 構造変更が必要で過剰
- **`position: fixed` への切替**: 横スクロール連動が壊れるため不採用

→ Issue 推奨案（CSS 2 箇所修正）が最小変更で完結するため採用。

## 受け入れ条件

- [ ] 共有 URL で縦スクロールしても、固定レーンヘッダーの上に本体コンテンツが露出しない
- [ ] 固定レーンヘッダーがキャンバスの可視最上部にぴたりと貼り付く（隙間なし）
- [ ] `titleHero`（オーサー名・タイトル・メタ情報・グラデーション）の見た目が現状と変わらない
  - 横方向のキャンバス全幅追従が維持
  - 上方向のグラデーションが切れていない
- [ ] 横スクロール時にヘッダーがコンテンツと一緒に横移動する（既存挙動の維持）
- [ ] モバイル (`max-width: 640px`) でも `titleHero` のレイアウトが崩れない
- [ ] テーマ別（cloud / midnight 等）で表示崩れがない
- [ ] エディット画面側に regression が出ていない

## テスト計画

### Unit (Vitest)

- 既存テスト全 pass
- jsdom では sticky 計算が完全には再現されないため、レイアウト位置の assert は最小限

### E2E (Playwright)

- 縦に長いフロー（行数 10+）の共有 URL を開く
- ティーザーモーダルを閉じる
- `data-testid="shared-flow-canvas"` を `scrollBy(0, 600)` する
- `data-testid="shared-canvas-header-svg"` の `boundingBox().y` がキャンバス可視上端付近（許容差 ±2px）であることを assert
- ヘッダーの上の領域に `bodySvg` のコンテンツが visible でないことを確認

### 目視確認

- 共有ビューでヘッダー上の露出が消えていること
- `titleHero` のグラデーション開始位置・余白が変わっていない
- モバイル幅（375px / 640px）で表示崩れがない
- ライト/ダークテーマ両方で確認
- エディット画面の sticky ヘッダーに変化なし

## スコープ外

- エディット画面 (`FlowEditor.module.css`) は触らない（既に正常動作）
- TeaserModal / BottomCTABar は `.canvas` 外なので影響なし
- ズーム挙動は座標計算に変更がないため影響なし
