# 自動リファクタパイプライン Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** mainマージ後にヘルスチェック→Healing Lock→Codex召喚の自動パイプラインを構築

**Architecture:** 既存の health-score.js を再利用し、refactor-gate.js（Healing Lock）と auto-refactor.yml（push:mainトリガー）を新規追加

**Tech Stack:** GitHub Actions, ESM scripts, Vitest

---

### Task 1: refactor-gate.js のテストと実装（TDD）

**Files:**

- Create: `.github/scripts/refactor-gate.js`
- Create: `tests/refactor-gate.test.ts`

**Step 1: テストを書く（Red）**

`tests/refactor-gate.test.ts` にテストを作成。health-score.test.ts と同様にサブプロセス実行パターンを使用。`MOCK_PR_COUNT` 環境変数で `gh` コマンドをモック。

テストケース:

- スコア >= 80, open PR なし → NEEDS_REFACTOR=false
- スコア < 80, open PR なし → NEEDS_REFACTOR=true
- スコア < 80, open PR あり（Healing Lock）→ NEEDS_REFACTOR=false
- health-score.txt 未存在 → HEALTH_SCORE=100, NEEDS_REFACTOR=false
- スコアちょうど 80 → NEEDS_REFACTOR=false
- スコアちょうど 79 → NEEDS_REFACTOR=true

**Step 2: テスト失敗確認**

Run: `npx vitest run tests/refactor-gate.test.ts`
Expected: FAIL

**Step 3: refactor-gate.js を実装**

ESM スクリプト。health-score.txt 読み取り → GITHUB_ENV にスコア出力 → Healing Lock チェック → NEEDS_REFACTOR 出力。

**Step 4: テスト通過確認**

Run: `npx vitest run tests/refactor-gate.test.ts`
Expected: ALL PASS

**Step 5: 全テスト確認**

Run: `npm test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add .github/scripts/refactor-gate.js tests/refactor-gate.test.ts
git commit -m "feat(#262): add refactor-gate.js with Healing Lock"
```

---

### Task 2: auto-refactor.yml ワークフロー作成

**Files:**

- Create: `.github/workflows/auto-refactor.yml`

**Step 1: ワークフロー作成**

push:main トリガー。checkout → setup-node → npm ci → knip → health-score.js → refactor-gate.js → 条件付き issue 作成。

**Step 2: YAML構文確認**

**Step 3: lint + 全テスト確認**

Run: `npm run lint && npm test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add .github/workflows/auto-refactor.yml
git commit -m "feat(#262): add auto-refactor pipeline workflow"
```

---

### Task 3: push & PR作成

**Step 1: build確認**

Run: `npm run build`

**Step 2: push & PR**

```bash
git push -u origin feat/auto-refactor-pipeline-262
gh pr create --title "feat(#262): 自動リファクタパイプライン" --body "..."
```

**Step 3: CI確認**

Run: `gh pr checks --watch`
