# 自動リファクタパイプライン 設計書

## 概要

mainブランチへのpush時にヘルスチェックを実行し、スコアが80未満かつHealing Lock（既存のai-refactor PR）がない場合に、Codex召喚用のissueを自動作成する。

## 背景

- #256/#258: ヘルスチェック基盤（health-score.js, knip設定）を実装済み
- #260: PR時のCodexコメント召喚を実装済み
- 今回はmainマージ後のパイプラインを構築する

## アーキテクチャ

既存の `repo-health.yml`（PR用）とは**別ワークフロー**として `auto-refactor.yml` を新規作成。health-score.js は既存を再利用。refactor-gate.js を新規追加。

```
feature PR → main にマージ
  ↓ on: push to main
auto-refactor.yml: knip → health-score.js → refactor-gate.js
  ↓ NEEDS_REFACTOR == 'true'
GitHub Issue 作成（@codex 召喚）
```

## 変更対象

| ファイル                              | 変更内容                                 |
| ------------------------------------- | ---------------------------------------- |
| `.github/scripts/refactor-gate.js`    | 新規: Healing Lock + NEEDS_REFACTOR 判定 |
| `.github/workflows/auto-refactor.yml` | 新規: push:main トリガーのワークフロー   |
| `tests/refactor-gate.test.ts`         | 新規: refactor-gate のテスト             |

## Healing Lock

```
label: "ai-refactor" の open PR が存在する？
  ├─ YES → NEEDS_REFACTOR=false（新規 Healing をブロック）
  └─ NO  → スコア < 80 → NEEDS_REFACTOR=true
```

## テスト戦略

- refactor-gate.js はサブプロセスとして実行（health-score.test.ts と同パターン）
- `gh pr list` の呼び出しは環境変数 `MOCK_PR_COUNT` でモック（未設定時は実際の `gh` コマンドを使用）
- `GITHUB_ENV` はテンプファイルで代替

## AI Responsibility Model

| Role        | Agent                              |
| ----------- | ---------------------------------- |
| Judge       | GitHub Actions (auto-refactor.yml) |
| Architect   | Codex                              |
| Implementer | Claude                             |
| Authority   | Human                              |
