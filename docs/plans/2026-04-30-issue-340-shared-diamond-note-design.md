---
issue: 340
title: 共有ビューでひし形ノードに付けたメモが表示されない
date: 2026-04-30
---

# Design: Issue #340 — 共有ビューでひし形ノードのメモを表示する

## 背景

共有URL（例: `https://flowline.six1.jp/shared/039b8fcb-e160-4ee2-ac2c-340a5d4bbe85`）でひし形ノード（`shape: "diamond"`）に付けたメモが描画されない。エディタでは同じメモが正常に表示されるため、見た目の整合性が取れていない。

ユーザー報告では「URLが記載されているメモが表示されない」となっていたが、調査の結果 **URLが原因ではなく、ひし形ノードであることが原因**であることが判明した。

## 原因

PR #204（commit ef3353f）で「ひし形にはレーンタグ・メモを非表示」という意図で `SharedFlowViewer.tsx:438` に `!isDiamond &&` が追加された。一方、`FlowEditor.tsx:3430` の `Object.entries(memos).map` にはこの除外がないため、エディタと共有ビューで挙動が乖離している。

```tsx
// src/features/shared/SharedFlowViewer.tsx:438
{!isDiamond &&
  node.note &&
  (() => {
    const memo = parseNote(node.note, li, sortedLanes.length)
    ...
```

## 修正方針

### 1. 本体コード

`SharedFlowViewer.tsx:438` から `!isDiamond &&` を削除し、`node.note &&` のみで判定する。これにより、ひし形ノードでもメモが描画されるようになり、エディタと挙動が一致する。

**変更前:**

```tsx
{!isDiamond &&
  node.note &&
  (() => { ... })()}
```

**変更後:**

```tsx
{node.note &&
  (() => { ... })()}
```

### 2. テスト修正

`SharedFlowViewer.test.tsx:292` の `should not render note for diamond node` を「描画される」アサートに反転する。

現テストは `svg.querySelectorAll('text')` でメモ文字列を検索しているが、`MemoText` コンポーネントは `<foreignObject>` 内の `<div>` 階層で描画されるため、SVG `<text>` 要素は存在せず、`expect(noteText).toBeUndefined()` が誤って通っていた。

**修正方針:**

- テスト名を `should render note for diamond node` に変更
- アサート方法を `getByText('Some note')` 等、`MemoText` の DOM 構造を検出できる方式に変更
- ひし形ノードでメモが描画されることを保証

## 整合性・懸念点

### A. メモコネクタ線の起点

既存ロジックは `c.y + TH/2`（=非ひし形ノードの底辺、`TH/2 = 28`）を起点にする。ひし形は `DS=34` なので図形内部から線が出る形になるが、**エディタ側（`FlowEditor.tsx`）も同じ挙動**なので整合性優先でそのまま維持する。視覚的改善は別 issue で扱う。

### B. デフォルト位置（プレーンテキストメモ）

報告対象ユーザーのメモは JSON 形式（`dx/dy` 保持）なので位置ズレはない。プレーンテキストの古いメモがある場合は `parseNote` のデフォルト `dx ±50, dy 46` が適用されてひし形の角と重なる可能性はあるが、**エディタと同じ位置になるだけ**なので追加対応は不要。

### C. OGP 画像

`workers/ogp/src/index.ts` はメモ自体を描画しないため影響なし（grep 確認済み）。

### D. 影響範囲

`!isDiamond` でメモを除外している箇所は `SharedFlowViewer.tsx:438` の 1 箇所のみ（`src/` 全体 grep 確認済み）。他のひし形除外（順序バッジ等）は仕様として妥当なので変更しない。

## 受け入れ条件

- [ ] 共有URL でひし形ノードのメモが表示される
- [ ] URL を含むメモのリンクが共有ビューでクリック可能（`MemoText` のリンク化処理が動作）
- [ ] `SharedFlowViewer.test.tsx` でひし形ノードのメモ表示を肯定するテストが通る
- [ ] エディタとの見た目の整合性が取れている（位置・コネクタ）
- [ ] 既存テストすべてが pass

## 影響ファイル

| ファイル                                        | 変更内容                       |
| ----------------------------------------------- | ------------------------------ |
| `src/features/shared/SharedFlowViewer.tsx`      | L438 の `!isDiamond &&` を削除 |
| `src/features/shared/SharedFlowViewer.test.tsx` | L292 のテストを描画肯定に反転  |

## TDD アプローチ

1. **Red**: 既存テスト `should not render note for diamond node` を「描画される」に反転 → 現行コードでは fail する
2. **Green**: `!isDiamond &&` を削除 → テスト pass
3. **Refactor**: 不要な isDiamond 参照や周辺の整合確認

## ロールアウト

- 機能フラグ不要（バグ修正のみ）
- Cloudflare Pages 経由でデプロイされる共有ビューに即時反映
- 後方互換性に問題なし（新規メモは表示増、既存メモも単に追加描画されるだけ）
