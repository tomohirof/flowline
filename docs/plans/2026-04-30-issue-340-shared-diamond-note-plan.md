# Issue #340 — 共有ビューでひし形ノードのメモを表示する 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有URL でひし形ノード（`shape: "diamond"`）に付けたメモをエディタと同じ位置・装飾で描画させる。

**Architecture:** `SharedFlowViewer.tsx:438` の条件式から `!isDiamond &&` を削除し、`node.note` の真偽だけでメモ描画を判定する。あわせて `SharedFlowViewer.test.tsx:292` の旧アサート（誤って通っていた `<text>` 要素検索）を、`MemoText` の `<div>` を捉える肯定アサートに反転する。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, @testing-library/react

---

## 関連ドキュメント

- 設計ドキュメント: `docs/plans/2026-04-30-issue-340-shared-diamond-note-design.md`
- 関連 issue: [#340](https://github.com/tomohirof/flowline/issues/340)
- ユーザーグローバル指示: `~/.claude/CLAUDE.md` の Workflow セクション
- テストルール: `~/.claude/rules/testing.md`

## 影響ファイル

| 種別   | パス                                            | 変更内容                            |
| ------ | ----------------------------------------------- | ----------------------------------- |
| Modify | `src/features/shared/SharedFlowViewer.tsx`      | L438 `!isDiamond &&` を削除         |
| Test   | `src/features/shared/SharedFlowViewer.test.tsx` | L292 のテストを「描画される」に反転 |

---

## Task 0: 開発環境のリフレッシュ & ワークツリー作成

`~/.claude/CLAUDE.md` の Step 0–1 に従い、本作業用の独立ワークツリーを準備する。

**Files:**

- Worktree: `.worktrees/fix/issue-340-shared-diamond-note`

- [ ] **Step 0.1: 迷子プロセスをクリーンアップ**

`/cleanup` skill を実行して Node/Wrangler/esbuild の残存プロセスを掃除する。

- [ ] **Step 0.2: issue に「作業開始」ラベルを付与**

```bash
gh issue edit 340 --add-label "作業開始"
```

ラベルが存在しない場合は `gh label create "作業開始" --color "#E11D48"` で作成してから再実行。

- [ ] **Step 0.3: ローカル main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

`merge --ff-only` が失敗した場合は **作業を中断して人間に報告**。

- [ ] **Step 0.4: ワークツリー作成と環境ファイルのリンク**

```bash
git worktree add .worktrees/fix/issue-340-shared-diamond-note -b fix/issue-340-shared-diamond-note
cd .worktrees/fix/issue-340-shared-diamond-note

MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

- [ ] **Step 0.5: 依存関係インストール（必要時のみ）**

```bash
npm install
```

`node_modules` が既に存在し最新であればスキップ可。

---

## Task 1: テストルール読込

**Files:** none

- [ ] **Step 1.1: テスト品質基準を読み込む**

```bash
cat ~/.claude/rules/testing.md
```

エッジケース・命名規則・カバレッジ目標を確認。本タスクの単一テスト変更でも、命名規則 `[Unit] should [expected behavior] when [condition]` を意識する。

---

## Task 2: TDD Red — テストを「描画される」に反転

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.test.tsx:292-313`

- [ ] **Step 2.1: 既存テストを反転して失敗するように変更**

`src/features/shared/SharedFlowViewer.test.tsx` の対象テストブロックを以下に置き換える：

```tsx
it('should render note for diamond node', () => {
  const diamondFlow = {
    ...mockFlow,
    nodes: [
      {
        id: 'node-1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: 'Diamond',
        note: 'Some note',
        orderIndex: 0,
        shape: 'diamond' as const,
      },
    ],
  }
  render(<SharedFlowViewer flow={diamondFlow} />)
  expect(screen.getByText('Some note')).toBeInTheDocument()
})
```

ポイント：

- `MemoText` は `<foreignObject>` 内の `<div>` で描画されるため、`screen.getByText` で DOM ツリー全体から検出できる。
- アサート対象を「テキストノードの存在」に絞ることで、座標やスタイル変更に対しても安定したテストになる。
- `getByText` は DOM に存在しない場合に throw するので、追加の `toBeInTheDocument()` は冗長だが意図を明示するため残す（プロジェクト内既存テストでも併用例あり）。

- [ ] **Step 2.2: テストを実行して失敗を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "should render note for diamond node"
```

期待: FAIL（`Unable to find an element with the text: Some note`）。
理由: 現行コードは `!isDiamond` で除外しているため、ひし形ノードのメモは DOM に存在しない。

---

## Task 3: TDD Green — `!isDiamond &&` を削除

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx:438`

- [ ] **Step 3.1: 条件式から `!isDiamond &&` を削除**

`src/features/shared/SharedFlowViewer.tsx` 438〜440 行を以下に置き換える：

変更前：

```tsx
                {!isDiamond &&
                  node.note &&
                  (() => {
```

変更後：

```tsx
                {node.note &&
                  (() => {
```

それ以外（インデント、`parseNote(node.note, li, sortedLanes.length)` 以下）はすべて維持する。インデントは元の構造に合わせて 18 スペース（既存コードと同じ）。

- [ ] **Step 3.2: 反転したテストが pass することを確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "should render note for diamond node"
```

期待: PASS（1 件）。

---

## Task 4: 全テストの回帰確認

**Files:** none

- [ ] **Step 4.1: SharedFlowViewer のテスト一式を実行**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

期待: 全件 PASS。`should not render note for diamond node` という旧名のテストが残っていないことを確認。

- [ ] **Step 4.2: 全テストスイートを実行**

```bash
npm test
```

期待: 全件 PASS。**1件でも FAIL があれば commit せず、原因調査と修正を行う。**

---

## Task 5: TypeScript 型チェック

**Files:** none

- [ ] **Step 5.1: tsc による型チェック**

```bash
npm run typecheck 2>/dev/null || npx tsc --noEmit
```

期待: エラー無し。`!isDiamond &&` の削除によって `isDiamond` 変数が未使用にならないか確認する（他の箇所で参照されているはずだが、コンパイラの diagnostics で確認）。

- [ ] **Step 5.2: lint チェック**

```bash
npm run lint 2>/dev/null || npx eslint src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.test.tsx
```

期待: エラー無し。

---

## Task 6: 実画面検証（Playwright / chrome-devtools）

`~/.claude/CLAUDE.md` Step 6 に従い、ブラウザでの目視確認を行う。

**Files:** none

- [ ] **Step 6.1: dev サーバ起動**

```bash
npm run dev
```

別ターミナルで以降の操作を行う。

- [ ] **Step 6.2: 共有URLを開いて再現確認**

issue 記載の再現URL `https://flowline.six1.jp/shared/039b8fcb-e160-4ee2-ac2c-340a5d4bbe85` は本番環境向けなので、ローカルでは以下を実施：

1. ローカルアプリで適当なフローを開き、ひし形ノード（不備確認 等）にメモを追加
2. 共有を有効化して共有URLを取得
3. シークレットウィンドウで開き、ひし形ノードのメモが表示されることを確認

または、本番環境（既にデプロイ済みコードで再現）の同 URL を Playwright で開き、修正前のスクリーンショットを `.screenshots/issue-340-before.png` に保存。修正後は本ワークツリーの dev サーバ＋テストフローで `.screenshots/issue-340-after.png` を取得して比較する。

- [ ] **Step 6.3: チェック項目**

以下を満たすことを目視確認する：

- [ ] ひし形ノードのメモが表示される
- [ ] エディタと同じ位置にメモが描画される
- [ ] メモ内の URL がリンクとして表示され、クリックで新規タブが開く
- [ ] メモコネクタ線がひし形ノードから引かれている（位置はエディタと同じ）
- [ ] レーンタグ・順序バッジなど、他のひし形特有の挙動に regression がない

- [ ] **Step 6.4: LCP（Largest Contentful Paint）確認**

DevTools Performance または `chrome-devtools` mcp で LCP が **1秒以内** であることを確認。超過時は Step 5 と Task 3 まで戻って原因を調査する。本修正はメモ描画の追加のみなので影響は軽微と想定。

スクリーンショットは `.screenshots/issue-340-{before,after}.png` に保存（ルートには保存しない）。

---

## Task 7: 最新 main 同期と再テスト

**Files:** none

- [ ] **Step 7.1: main を rebase で取り込む**

```bash
git pull origin main --rebase
```

衝突した場合は手動で解消する。`SharedFlowViewer.tsx` / `SharedFlowViewer.test.tsx` 周辺は単純な変更なので衝突可能性は低いが、もし発生したら設計書に立ち返って整合性を確認する。

- [ ] **Step 7.2: 全テスト再実行**

```bash
npm test
```

期待: 全件 PASS。失敗時は修正してから次へ進む。

---

## Task 8: Commit

**Files:** none

- [ ] **Step 8.1: 変更内容を確認**

```bash
git status
git diff src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.test.tsx
```

期待される差分：

- `SharedFlowViewer.tsx`: `!isDiamond &&` 1 行削除（または同行に統合）
- `SharedFlowViewer.test.tsx`: `should not render note for diamond node` ブロックを反転

- [ ] **Step 8.2: ステージングして commit**

```bash
git add src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.test.tsx
git commit -m "$(cat <<'EOF'
fix(#340): render note on diamond nodes in shared viewer

Remove the !isDiamond guard from SharedFlowViewer so that diamond-shape
nodes display their attached note, matching the editor's behavior. Flip
the corresponding test to assert the note is rendered (the previous
assertion searched <text> elements which never contained the memo text
since MemoText renders inside <foreignObject>).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8.3: pre-commit hook 失敗時の対応**

pre-commit hook が失敗した場合は新しい commit を作る（amend は使わない）。エラーメッセージに従って修正→再 stage→新規 commit。

---

## Task 9: PR 作成 & CI 確認

**Files:** none

- [ ] **Step 9.1: branch を push**

```bash
git push -u origin fix/issue-340-shared-diamond-note
```

- [ ] **Step 9.2: PR 作成**

```bash
gh pr create --title "fix(#340): render note on diamond nodes in shared viewer" --body "$(cat <<'EOF'
## Summary
- 共有ビューでひし形ノードに付けたメモが表示されない問題を修正
- `SharedFlowViewer.tsx` の `!isDiamond &&` 条件を削除し、エディタと同じくメモを描画
- 既存テスト `should not render note for diamond node` を「描画される」に反転（`<foreignObject>` 内の `<div>` を `getByText` で検出）

Closes #340

## Test plan
- [x] `should render note for diamond node` テスト追加（旧テストの反転）
- [x] `npm test` 全件 PASS
- [x] `npm run typecheck` / `lint` PASS
- [ ] 共有URL でひし形ノードのメモが表示されることを実画面で確認
- [ ] メモ内のリンクがクリック可能
- [ ] LCP 1秒以内
- [ ] 他のひし形挙動（順序バッジ・レーンタグ等）に regression なし

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.3: CI 完了待機**

```bash
gh pr checks --watch
```

すべて pass するまで待機。Fail があれば修正→push→再 watch を繰り返す。

- [ ] **Step 9.4: レビュー依頼コメント**

CI 全 pass 後：

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 10: 本番ビルド確認

**Files:** none

- [ ] **Step 10.1: preview skill を実行**

`~/.claude/skills/preview/SKILL.md` の手順に従って本番ビルドをローカルで起動し、ひし形メモ表示を再確認する。デプロイ先（Vercel / Cloudflare Pages）は skill 内のロジックで自動判定される。

---

## Task 11: レビュー修正ループ（最大 10 回）

`~/.claude/CLAUDE.md` Step 9 に従う。**for/while で一括実行しない。1 回ずつ個別ステップとして判断する。**

- [ ] **Step 11.1: 1 分待機**

```bash
sleep 60
```

- [ ] **Step 11.2: コメント取得**

```bash
gh pr view --json comments
```

`jq` でパースエラーが出る場合は `--jq` を使わず生 JSON を読む。

- [ ] **Step 11.3: 判定**

レビュー依頼コメントの `created_at` より後に投稿された **`claude[bot]` のコメントだけ** を判定対象にする。

- **[A:要修正]** / **[B:条件つき承認]**: 修正 → push → CI pass → 再レビュー依頼 → Step 11.1 に戻る
- **[C:承認OK]**: Task 12 に進む

10 回を超えても収束しない場合は **人間にエスカレーション**。

---

## Task 12: Merge & Deploy 確認

**Files:** none

- [ ] **Step 12.1: PR を merge**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 12.2: デプロイ確認**

`~/.claude/skills/deploy/SKILL.md` を参照して、GitHub Actions / Cloudflare Pages のデプロイ完了を確認する。

- [ ] **Step 12.3: 本番再現 URL で動作確認**

`https://flowline.six1.jp/shared/039b8fcb-e160-4ee2-ac2c-340a5d4bbe85` を開き、ひし形ノード `不備確認` のメモが表示されることを確認。スクリーンショットを `.screenshots/issue-340-prod-after.png` に保存。

---

## Task 13: ワークツリー後片付け

**Files:** none

- [ ] **Step 13.1: ワークツリーを削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/fix/issue-340-shared-diamond-note
git branch -d fix/issue-340-shared-diamond-note
git worktree list
```

残骸が無いことを確認して完了。

---

## 完了基準

- [ ] issue #340 の受け入れ条件を全て満たす
- [ ] PR がマージされ、本番デプロイが完了している
- [ ] ワークツリー・ローカルブランチがクリーンアップ済み
