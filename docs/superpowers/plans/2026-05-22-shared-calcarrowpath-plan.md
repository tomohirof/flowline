# SharedFlowViewer calcArrowPath 統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SharedFlowViewer の矢印パス計算を FlowEditor と同じ `calcArrowPath` ラッパー経由に統一する。

**Architecture:** `src/features/shared/SharedFlowViewer.tsx:computeArrowPath` 内の `exitPt → entryPt → buildArrowPath` 直呼び出しを `calcArrowPath` 1 呼び出しに置換。obstacles 計算はそのまま残す（`calcArrowPath` は obstacles を受け取る）。

**Tech Stack:** TypeScript, React, Vitest

**Spec:** [docs/superpowers/specs/2026-05-22-shared-calcarrowpath-design.md](../specs/2026-05-22-shared-calcarrowpath-design.md)

**Issue:** #356

---

## Task 1: SharedFlowViewer の computeArrowPath 置換

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx`

- [ ] **Step 1: imports を更新**

`src/features/shared/SharedFlowViewer.tsx` の 10-19 行目（arrow-routing からの import 群）を以下に変更:

Before:

```ts
import {
  exitPt,
  entryPt,
  buildArrowPath,
  buildObstacles,
  DS,
  type Point,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
```

After:

```ts
import {
  buildObstacles,
  DS,
  type Point,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
import { calcArrowPath } from '../../lib/flow-engine'
```

- [ ] **Step 2: computeArrowPath 本体を置換**

`computeArrowPath` 関数の 129-138 行目および 157 行目を変更。

Before（129-138 行目）:

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
```

これら 10 行を削除する（変数 `s`, `e` も不要になる）。

Before（157 行目）:

```ts
return buildArrowPath(s, e, f, t, obstacles)
```

After（157 行目相当）:

```ts
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

`buildObstacles({...})` の呼び出し（141-155 行目）はそのまま残す。

- [ ] **Step 3: 型チェック pass**

Run: `npx tsc -b --pretty`
Expected: エラーなし。

- [ ] **Step 4: 既存テスト pass**

Run: `npm test`
Expected: 全テスト pass。

- [ ] **Step 5: ビルド pass**

Run: `npm run build`
Expected: ビルド成功。

- [ ] **Step 6: prettier フォーマット**

Run: `npx prettier --write src/features/shared/SharedFlowViewer.tsx`
Expected: フォーマット適用（または既に整形済みなら no-op）。

---

## Task 2: 共有ビュー目視確認

**Files:** なし

- [ ] **Step 1: dev サーバ起動 & ログイン**

`npm run dev:frontend` → ブラウザで `.env.local` の `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` を使ってログイン。

- [ ] **Step 2: 矢印を含むフローを開く**

ダッシュボードから矢印を含む flow を選択してエディタを開く。

- [ ] **Step 3: エディタの矢印描画スクリーンショット**

`.screenshots/356-editor-arrows-after.png` に保存。

- [ ] **Step 4: 同じ flow の共有 URL を開く**

エディタで「共有」→ URL コピー → 別タブで開く。

- [ ] **Step 5: 共有ビューの矢印描画スクリーンショット**

`.screenshots/356-shared-arrows-after.png` に保存。

- [ ] **Step 6: 2 枚を比較**

エディタと共有ビューで矢印のパス・位置・角度がすべて完全一致していることを確認。  
特に: ひし形ノードを含む矢印で `fromSide` が指定されている場合、両者で同じ頂点から出ていること。

- [ ] **Step 7: LCP 確認**

DevTools Performance で LCP を測定。1 秒以内であることを確認。

---

## Task 3: コミット & PR & レビュー

CLAUDE.md workflow Step 7-9 に従う:

- `git pull origin main --rebase && npm test`
- commit（メッセージ: `refactor(#356): unify SharedFlowViewer arrow path via calcArrowPath`）
- push & `gh pr create`
- `gh pr checks --watch`
- `@claude` レビュー依頼
- レビュー判定が [C:承認OK] になるまでループ

## Task 4: Merge & Cleanup

CLAUDE.md workflow Step 10-11:

- `gh pr merge --merge`
- main 更新、デプロイ確認
- worktree remove + branch -d
