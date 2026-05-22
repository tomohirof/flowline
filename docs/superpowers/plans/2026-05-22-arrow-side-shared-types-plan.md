# ArrowSide shared/ 移動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ArrowSide` 型の二重定義（src/lib/types.ts と api/lib/flow-transform.ts）を解消し、`shared/types.ts` を単一情報源とする。

**Architecture:** 新規 `shared/` ディレクトリを「型定義のみのレイヤ」として導入。tsconfig.app.json と tsconfig.workers.json の両方に include を追加し、双方からインポート可能にする。`src/lib/types` は shared から re-export することで既存 import path を壊さない。`api/` 側は shared から直接 import。

**Tech Stack:** TypeScript（tsc -b プロジェクト参照）、Vite、Cloudflare Workers (wrangler/esbuild)、Vitest

**Spec:** [docs/superpowers/specs/2026-05-22-arrow-side-shared-types-design.md](../specs/2026-05-22-arrow-side-shared-types-design.md)

**Issue:** #357

---

## Task 0: Worktree 作成と前提確認

**Files:** なし（環境セットアップ）

- [ ] **Step 1: main を最新化**

Run:

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

Expected: `Already up to date.` または fast-forward 成功。失敗時は人間に報告して中断。

- [ ] **Step 2: worktree 作成**

Run:

```bash
git worktree add .worktrees/refactor-357-arrow-side-shared -b refactor/357-arrow-side-shared
cd .worktrees/refactor-357-arrow-side-shared
```

- [ ] **Step 3: .env シンボリックリンク**

Run:

```bash
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
ls -la .env*
```

Expected: `.env`, `.env.local` などがシンボリックリンクとして表示される。

- [ ] **Step 4: issue に「作業開始」ラベル付与**

Run:

```bash
gh issue edit 357 --add-label "作業開始"
```

Expected: ラベル付与成功。既に付いていればスキップ。

- [ ] **Step 5: 既存テスト Green 確認**

Run: `npm test`
Expected: 全テスト pass。fail があればリファクタ前に修正方針を検討（このリファクタを進めない）。

---

## Task 1: shared/types.ts を新設

**Files:**

- Create: `shared/types.ts`

- [ ] **Step 1: ディレクトリと初期ファイル作成**

Create `shared/types.ts`:

```ts
// ⚠️ Only pure type definitions allowed in this directory.
//    - No runtime code (no const, no function, no class).
//    - No DOM-specific or Workers-specific types.
//    - Imported by both src/ (Vite/React) and api/ (Cloudflare Workers).
//    Reason: src/ and api/ are bundled separately. This file is the
//    single source of truth for types shared on the wire / API contract.

/** 矢印の接続元/接続先として使う頂点/辺。未指定なら自動。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'
```

- [ ] **Step 2: ファイル作成確認**

Run: `ls -la shared/types.ts && head -10 shared/types.ts`
Expected: ファイルが存在し、コメントと型定義が表示される。

---

## Task 2: tsconfig 両プロジェクトに shared/ を include

**Files:**

- Modify: `tsconfig.app.json`
- Modify: `tsconfig.workers.json`

- [ ] **Step 1: tsconfig.app.json の include を更新**

`tsconfig.app.json` の `"include": ["src"]` を `"include": ["src", "shared"]` に変更する。`exclude` はそのまま。

変更後の該当行（27行目相当）:

```json
  "include": ["src", "shared"],
  "exclude": ["src/**/*.test.*"]
```

- [ ] **Step 2: tsconfig.workers.json の include を更新**

`tsconfig.workers.json` の最終行 `"include": ["api/**/*.ts", "functions/**/*.ts", "workers/**/*.ts"]` を以下に変更:

```json
  "include": ["api/**/*.ts", "functions/**/*.ts", "workers/**/*.ts", "shared/**/*.ts"]
```

- [ ] **Step 3: tsc で両プロジェクト型チェック pass**

Run: `npx tsc -b --pretty`
Expected: エラーなし（exit code 0）。`shared/types.ts` が両プロジェクトに認識され、参照する src/api ファイルがまだ無いため警告も出ない。

---

## Task 3: src/lib/types.ts を shared からの re-export に置換

**Files:**

- Modify: `src/lib/types.ts`

- [ ] **Step 1: ArrowSide 定義を削除し shared から re-export**

`src/lib/types.ts` の冒頭 1-2 行目の `ArrowSide` 定義:

```ts
/** ひし形ノードの接続元として使う頂点/辺。未指定なら自動（ターゲット方向から推定）。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'
```

を以下に置換:

```ts
export type { ArrowSide } from '../../shared/types'
```

ファイル末尾の `InternalArrow` / `ArrowPathResult` 定義はそのまま残す。

- [ ] **Step 2: src/ 側の型チェック pass**

Run: `npx tsc -b tsconfig.app.json --pretty`
Expected: エラーなし。`src/features/editor/types.ts` 等の既存 import は `src/lib/types` 経由なので影響なし。

- [ ] **Step 3: 既存テスト Green 確認**

Run: `npm test`
Expected: 全テスト pass（型 erase のみで実行時挙動は変わらない）。

---

## Task 4: api/lib/flow-transform.ts を shared 直接 import に置換

**Files:**

- Modify: `api/lib/flow-transform.ts`

- [ ] **Step 1: import 追加と local 定義削除**

`api/lib/flow-transform.ts` の 6 行目:

```ts
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'
```

を以下に置換:

```ts
import type { ArrowSide } from '../../shared/types'
```

`ArrowSide` を外部から import している箇所（api 内）があれば、`flow-transform` 経由のままでも、shared から直接でも可。**まず grep して影響範囲を確認すること**:

Run: `grep -rn "ArrowSide" api/ functions/ workers/ 2>/dev/null`

`flow-transform` から re-export しているファイルが他にあれば、そのファイルの import 元はそのままで OK（`flow-transform.ts` を経由）。  
ただし `flow-transform.ts` は `export type ArrowSide` から `import type ArrowSide` に変わるため、他ファイルが `flow-transform` から `ArrowSide` を import している場合は、その import を引き続き機能させるために `export type { ArrowSide }` の re-export 行を追加する:

```ts
import type { ArrowSide } from '../../shared/types'
export type { ArrowSide }
```

- [ ] **Step 2: workers 側の型チェック pass**

Run: `npx tsc -b tsconfig.workers.json --pretty`
Expected: エラーなし。

- [ ] **Step 3: 既存 API テスト Green 確認**

Run: `npm test`
Expected: 全テスト pass。

---

## Task 5: ビルド検証

**Files:** なし（検証のみ）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: vite ビルドと（あれば）wrangler ビルドの両方が成功。エラー・警告なし。

- [ ] **Step 2: 全テスト最終確認**

Run: `npm test`
Expected: 全テスト pass。

- [ ] **Step 3: 型チェックフル実行**

Run: `npx tsc -b --pretty`
Expected: 全プロジェクトエラーなし。

---

## Task 6: 実画面目視確認（CLAUDE.md workflow Step 6）

**Files:** なし（動作確認）

- [ ] **Step 1: dev サーバ起動**

Run: `npm run dev`（バックグラウンド or 別タブ）

- [ ] **Step 2: ブラウザでログイン → エディタを開く**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン。

- [ ] **Step 3: 既存矢印 + ひし形 fromSide 矢印の描画確認**

既存 flow を開き、以下を確認:

- 既存矢印が以前と同じ位置・パスで描画されている
- ひし形ノードを含む矢印で `fromSide` が指定されているものが正しく頂点から出ている
- 共有ビュー（share URL）で同じ flow を開いて描画が一致する

スクリーンショットは `.screenshots/` に保存。

- [ ] **Step 4: LCP 確認**

DevTools Lighthouse または Performance タブで LCP を測定。基準: 1 秒以内。  
Expected: リファクタなので変化なし。1 秒超過があれば原因を調査（このリファクタが原因の可能性は低いが念のため）。

---

## Task 7: コミット & PR 作成

**Files:** なし（git 操作）

- [ ] **Step 1: 変更内容確認**

Run: `git status && git diff --stat`
Expected: 変更ファイルは以下のみ:

- `shared/types.ts`（新規）
- `src/lib/types.ts`
- `api/lib/flow-transform.ts`
- `tsconfig.app.json`
- `tsconfig.workers.json`

- [ ] **Step 2: 最新 main を取り込み**

Run:

```bash
git pull origin main --rebase
npm test
```

Expected: rebase 成功、テスト全 pass。conflict があれば手動解決。

- [ ] **Step 3: コミット**

Run:

```bash
git add shared/types.ts src/lib/types.ts api/lib/flow-transform.ts tsconfig.app.json tsconfig.workers.json
git commit -m "$(cat <<'EOF'
refactor(#357): consolidate ArrowSide type into shared/

ArrowSide was duplicated in src/lib/types.ts and api/lib/flow-transform.ts.
Introduce shared/types.ts as the single source of truth, included by both
tsconfig.app.json and tsconfig.workers.json. src/ continues to re-export
via src/lib/types to keep existing import paths stable; api/ imports
directly from shared/types.

No runtime change — pure type-level refactor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: push**

Run: `git push -u origin refactor/357-arrow-side-shared`

- [ ] **Step 5: PR 作成**

Run:

```bash
gh pr create --title "refactor(#357): consolidate ArrowSide type into shared/" --body "$(cat <<'EOF'
## Summary
- `ArrowSide` の二重定義（src/lib/types.ts と api/lib/flow-transform.ts）を解消
- 新規 `shared/types.ts` を単一情報源とし、両 tsconfig の include に追加
- src/ は `src/lib/types` 経由の re-export で既存 import 互換性を維持
- api/ は `shared/types` から直接 import

## Test plan
- [ ] `npm test` 全 pass
- [ ] `npm run build` 成功
- [ ] `npx tsc -b` エラーなし
- [ ] 実画面で既存矢印・ひし形 fromSide 矢印の描画が変化していないことを確認
- [ ] 共有ビューで描画が一致することを確認

Closes #357

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: CI watch**

Run: `gh pr checks --watch`
Expected: 全 check pass。fail があれば修正 → push → 再 watch。

- [ ] **Step 7: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` の手順に従って本番ビルドをローカル起動し、リファクタによる挙動変化がないことを確認。

- [ ] **Step 8: レビュー依頼**

Run:

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 8: レビュー対応・Merge・後始末

**Files:** なし（運用フェーズ）

CLAUDE.md workflow Step 9-11 に従う:

- レビュー判定 [C:承認OK] になるまで修正ループ（最大 10 回、1回ずつ）
- merge: `gh pr merge --merge`
- main 更新: メインリポジトリで `git -C $MAIN fetch origin main && git -C $MAIN merge --ff-only origin/main`
- デプロイ確認: `~/.claude/skills/deploy/SKILL.md` に従う
- worktree 削除: `git worktree remove .worktrees/refactor-357-arrow-side-shared && git branch -d refactor/357-arrow-side-shared`
