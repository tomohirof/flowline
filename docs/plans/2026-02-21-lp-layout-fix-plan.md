# LP全幅レイアウト修正 実装プラン

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** LPがビューポート全幅を使用するよう修正（#34）

**Architecture:** `src/index.css` の Vite デフォルトスタイル（body flex + ダークテーマ色）を削除し、`#root` を全幅に修正。空の `App.css` も削除。

**Tech Stack:** CSS, React, TypeScript, Vitest

---

### Task 1: LandingPage全幅テスト作成

**Files:**

- Reference: `src/features/landing/LandingPage.test.tsx`
- Reference: `src/index.css`

**Step 1: 既存テストファイルを確認し、全幅テストを追加**

`LandingPage.test.tsx` にLPのルートdivがビューポート全幅を使用することを検証するテストを追加。
body の `display: flex; place-items: center` が適用されていないことを確認。

**Step 2: テストが失敗することを確認**

Run: `npx vitest run src/features/landing/LandingPage.test.tsx`
Expected: FAIL

---

### Task 2: index.css 修正

**Files:**

- Modify: `src/index.css`

**Step 1: Viteデフォルトスタイルを削除・修正**

修正後の `index.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
}
```

Viteデフォルトの `:root` ダークテーマ色、`a` スタイル、`button` スタイル、`h1` スタイル、`@media (prefers-color-scheme: light)` を全て削除。

**Step 2: テスト実行**

Run: `npx vitest run src/features/landing/LandingPage.test.tsx`
Expected: PASS

---

### Task 3: App.css 削除

**Files:**

- Delete: `src/App.css`
- Modify: `src/App.tsx:7`

**Step 1: 空の App.css を削除し、import を削除**

`App.tsx` から `import './App.css'` を削除。
`App.css` ファイルを削除。

**Step 2: 全テスト実行**

Run: `npm test`
Expected: 全テスト PASS

**Step 3: Commit**

```bash
git add src/index.css src/App.tsx src/App.css src/features/landing/LandingPage.test.tsx
git commit -m "fix: LP全幅レイアウト修正 - Viteデフォルトスタイル削除 #34"
```

---

### Task 4: ブラウザ目視検証

**Step 1: 開発サーバーでLPを確認**

1440px幅でLPを開き、全セクションが全幅を使用していることを確認。

**Step 2: 問題があれば追加修正**

---

### Task 5: PR作成

```bash
git pull origin main --rebase
npm test
git push -u origin fix-lp-layout
gh pr create --title "fix: LPレイアウト全幅修正 #34" --body "..."
```
