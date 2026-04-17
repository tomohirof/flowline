# クローズドβテスト中 新規登録無効化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/auth/register` を 503 で「現在はクローズドβテスト中です」を返すようにし、`AuthModal` の registerモードをβ案内UIに差し替える（ja/en）。既存ログイン/認証フローは無影響。

**Architecture:** (1) API は早期return 1行追加、(2) AuthModal に registerモード分岐を追加してβ案内ブロックを表示、(3) 既存テストの `/register` 依存箇所を D1 直接 INSERT ヘルパーへ置換してテスト継続性を確保。

**Tech Stack:** Hono (API), React + i18next + CSS Modules (UI), Vitest + React Testing Library + better-sqlite3 (tests)

**Issue:** https://github.com/tomohirof/flowline/issues/302
**Spec:** `docs/superpowers/specs/2026-04-17-closed-beta-register-disable-design.md`

---

## File Structure

**Create:**
- `tests/helpers/create-test-user.ts` — 既存テストの `/register` setup 用ヘルパー（D1 直接 INSERT）

**Modify:**
- `api/routes/auth.ts:28-87` — `POST /register` ハンドラ冒頭に 503 早期return 追加
- `src/features/landing/components/AuthModal.tsx:197-266` — register モード分岐追加
- `src/features/landing/components/AuthModal.module.css` — `closedBetaContainer` 等クラス追加
- `src/locales/ja/auth.json` — `closedBeta` キー追加
- `src/locales/en/auth.json` — `closedBeta` キー追加
- `tests/api/routes/auth.test.ts` — `/register` テスト書き換え、他テストの setup を createTestUser に移行
- `src/features/landing/components/AuthModal.test.tsx` — register モードのテスト追加・書き換え

---

## 事前準備（ワークツリー作成）

CLAUDE.md の Workflow Step 1 に従い、ワークツリーを作成してそこで作業する。

- [ ] **ローカル main を最新化**

```bash
cd /Volumes/SSD4TB/DevCode/flowline
git checkout main
git fetch origin
git merge --ff-only origin/main
```

Expected: `Already up to date.` か `Fast-forward`

- [ ] **ワークツリー作成**

```bash
cd /Volumes/SSD4TB/DevCode/flowline
git worktree add .worktrees/feat/closed-beta-register-302 -b feat/closed-beta-register-302
cd .worktrees/feat/closed-beta-register-302

MAIN=$(git rev-parse --show-toplevel)
# worktree 内の top に戻る
MAIN_TOP=$(cd "$MAIN/../../" && pwd)
for f in "$MAIN_TOP"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

以降の全タスクは `.worktrees/feat/closed-beta-register-302` で実行する。

- [ ] **依存インストール**

```bash
npm install
```

---

## Task 1: i18n キーを追加

**Files:**
- Modify: `src/locales/ja/auth.json`
- Modify: `src/locales/en/auth.json`

- [ ] **Step 1: ja に `closedBeta` キー追加**

`src/locales/ja/auth.json` の `"passwordResetPending": "パスワードリセットは準備中です",` の次に以下を追加:

```json
  "closedBeta": {
    "title": "現在はクローズドβテスト中です",
    "description": "新規登録は現在受け付けておりません。既にアカウントをお持ちの方はログインしてください。",
    "backToLogin": "ログイン画面へ"
  },
```

最終形（`src/locales/ja/auth.json`）:

```json
{
  "login": "ログイン",
  "register": "新規登録",
  "close": "閉じる",
  "error": "エラーが発生しました",
  "emailResent": "確認メールを再送しました",
  "emailResendFailed": "再送に失敗しました",
  "googleLoginPending": "Googleログインは準備中です",
  "passwordResetPending": "パスワードリセットは準備中です",
  "closedBeta": {
    "title": "現在はクローズドβテスト中です",
    "description": "新規登録は現在受け付けておりません。既にアカウントをお持ちの方はログインしてください。",
    "backToLogin": "ログイン画面へ"
  },
  "verifyEmail": {
    "title": "メールを確認してください",
    "description": "メール内のリンクをクリックしてアカウントを有効化してください。",
    "checkSpam": "迷惑メールフォルダも確認してください",
    "resending": "送信中...",
    "resend": "確認メールを再送する",
    "backToLogin": "← ログイン画面に戻る",
    "changeEmail": "← メールアドレスを変更する"
  },
  "form": {
    "name": "お名前",
    "email": "メールアドレス",
    "password": "パスワード",
    "forgotPassword": "パスワードをお忘れですか？",
    "processing": "処理中...",
    "loginButton": "ログイン",
    "createAccount": "アカウント作成",
    "continueWithGoogle": "Googleで続ける"
  },
  "verify": {
    "tokenNotFound": "認証トークンが見つかりません",
    "failed": "認証に失敗しました",
    "verifying": "メールアドレスを確認中...",
    "success": "メール認証が完了しました！",
    "redirecting": "ダッシュボードにリダイレクトします...",
    "backToTop": "トップに戻る"
  }
}
```

- [ ] **Step 2: en に `closedBeta` キー追加**

`src/locales/en/auth.json` の `"passwordResetPending": "Password reset is coming soon",` の次に以下を追加:

```json
  "closedBeta": {
    "title": "Currently in closed beta",
    "description": "New registration is not currently available. If you already have an account, please log in.",
    "backToLogin": "Go to login"
  },
```

最終形（`src/locales/en/auth.json`）:

```json
{
  "login": "Log in",
  "register": "Sign up",
  "close": "Close",
  "error": "An error occurred",
  "emailResent": "Verification email resent",
  "emailResendFailed": "Failed to resend",
  "googleLoginPending": "Google login is coming soon",
  "passwordResetPending": "Password reset is coming soon",
  "closedBeta": {
    "title": "Currently in closed beta",
    "description": "New registration is not currently available. If you already have an account, please log in.",
    "backToLogin": "Go to login"
  },
  "verifyEmail": {
    "title": "Check your email",
    "description": "Click the link in the email to activate your account.",
    "checkSpam": "Also check your spam folder",
    "resending": "Sending...",
    "resend": "Resend verification email",
    "backToLogin": "← Back to login",
    "changeEmail": "← Change email address"
  },
  "form": {
    "name": "Your name",
    "email": "Email address",
    "password": "Password",
    "forgotPassword": "Forgot your password?",
    "processing": "Processing...",
    "loginButton": "Log in",
    "createAccount": "Create account",
    "continueWithGoogle": "Continue with Google"
  },
  "verify": {
    "tokenNotFound": "Authentication token not found",
    "failed": "Authentication failed",
    "verifying": "Verifying email address...",
    "success": "Email verified!",
    "redirecting": "Redirecting to dashboard...",
    "backToTop": "Back to top"
  }
}
```

- [ ] **Step 3: JSON バリデーション**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ja/auth.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('src/locales/en/auth.json','utf8'))"
```

Expected: エラー出力なし

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja/auth.json src/locales/en/auth.json
git commit -m "feat(#302): add closedBeta i18n keys"
```

---

## Task 2: AuthModal に closedBetaContainer スタイル追加

**Files:**
- Modify: `src/features/landing/components/AuthModal.module.css`

- [ ] **Step 1: β案内用クラスを追加**

`src/features/landing/components/AuthModal.module.css` の末尾（`.backLink` 定義の後）に以下を追加:

```css
.closedBetaContainer {
  text-align: center;
  padding: 12px 0;
}

.closedBetaTitle {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 16px;
}

.closedBetaDescription {
  font-size: 14px;
  color: #64648c;
  line-height: 1.6;
  margin: 0 0 24px;
}
```

- [ ] **Step 2: コミット**

```bash
git add src/features/landing/components/AuthModal.module.css
git commit -m "feat(#302): add closedBetaContainer styles"
```

---

## Task 3: AuthModal.test.tsx — register モードβ案内の失敗テストを書く (Red)

**Files:**
- Modify: `src/features/landing/components/AuthModal.test.tsx`

- [ ] **Step 1: 既存テスト「新規登録モードで名前・メール・パスワード入力を表示する」を β案内に置換**

`src/features/landing/components/AuthModal.test.tsx` を開き、以下のテストを探す:

```tsx
  it('新規登録モードで名前・メール・パスワードの入力を表示する', () => {
```

このテストブロックを以下に置換:

```tsx
  it('registerモードではβ案内を表示しフォームは出さない', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.email')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.password')).not.toBeInTheDocument()
    expect(screen.queryByTestId('auth-submit')).not.toBeInTheDocument()
  })
```

注: 既存テストの正確な表記（全角/半角）は `screen.getByPlaceholderText('form.name')` 等で照合しているため、日本語テスト名だけ見て見落とさず置換すること。検索で `'新規登録モード'` を含むテスト全体を取り除く。

- [ ] **Step 2: β案内追加テストを追加**

同ファイルの `describe('AuthModal', () => { ... })` 内、Step1 で追加したテストの直後に以下を追加:

```tsx
  it('β案内の「ログインへ」ボタン押下でloginモードに戻る', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    const backBtn = screen.getByRole('button', { name: 'closedBeta.backToLogin' })
    fireEvent.click(backBtn)
    expect(screen.queryByTestId('closed-beta-notice')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.password')).toBeInTheDocument()
  })

  it('loginタブ→新規登録タブでβ案内が表示される', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    const registerTab = screen.getByRole('button', { name: 'auth:register' })
    fireEvent.click(registerTab)
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
  })

  it('タブを register→login→register と切替えてもβ案内が復帰する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'auth:login' }))
    expect(screen.queryByTestId('closed-beta-notice')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'auth:register' }))
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
  })
```

注: i18next の `t()` モックが未設定だとキー名そのものが返る挙動を想定。`getByRole('button', { name: 'auth:register' })` が見つからない場合、既存テストで使われているタブ検索パターンに合わせる（下記Step 3で動作確認）。

- [ ] **Step 3: 既存の register 関連テストの中で不要になったものを確認**

以下の既存テスト（`src/features/landing/components/AuthModal.test.tsx` 内）を探して、registerフォーム submit を前提とするテストは削除または login モードに限定する。具体的には:

```bash
grep -nE "initialMode=\"register\"|mode=\"register\"|mockRegister|mode.*register" src/features/landing/components/AuthModal.test.tsx
```

対象となる可能性のあるテスト（実際のファイルを確認して該当するものだけ処理）:
- register submit 成功テスト
- register 失敗時のエラー表示テスト
- register からの verify モード遷移テスト

これらが存在する場合、**このタスクでは残したまま**次のTask 4で実装を通した後、Task 5 のリファクタで整理する。

- [ ] **Step 4: 失敗を確認**

```bash
npm run test:unit -- src/features/landing/components/AuthModal.test.tsx
```

Expected: 3件（または上記ステップで追加した件数）のテストがFAIL。FAILの内容は `closed-beta-notice` testid が見つからないエラー等。

- [ ] **Step 5: コミット**

```bash
git add src/features/landing/components/AuthModal.test.tsx
git commit -m "test(#302): add failing tests for closed-beta register mode"
```

---

## Task 4: AuthModal.tsx — registerモードをβ案内に差し替え (Green)

**Files:**
- Modify: `src/features/landing/components/AuthModal.tsx`

- [ ] **Step 1: register モード分岐を追加**

`src/features/landing/components/AuthModal.tsx` 内の `{mode === 'verify' ? (` から始まる三項演算子を、以下の「verify → register → else (login)」の形に変更する。

変更前 (行 158-266):

```tsx
        {mode === 'verify' ? (
          <div className={styles.verifyContainer}>
            {/* 既存 verify UI */}
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className={styles.field}>
                  ...
```

変更後の該当ブロック全体:

```tsx
        {mode === 'verify' ? (
          <div className={styles.verifyContainer}>
            <div className={styles.verifyIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C5CFC"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h2 className={styles.verifyTitle}>{t('auth:verifyEmail.title')}</h2>
            <div className={styles.verifyEmailCard}>{verifyEmail}</div>
            <p className={styles.verifyText}>{t('auth:verifyEmail.description')}</p>
            <p className={styles.verifyNote}>{t('auth:verifyEmail.checkSpam')}</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleResend}
              disabled={submitting}
            >
              {submitting ? t('auth:verifyEmail.resending') : t('auth:verifyEmail.resend')}
            </button>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => switchMode(verifySource)}
            >
              {verifySource === 'login'
                ? t('auth:verifyEmail.backToLogin')
                : t('auth:verifyEmail.changeEmail')}
            </button>
          </div>
        ) : mode === 'register' ? (
          <div className={styles.closedBetaContainer} data-testid="closed-beta-notice">
            <h2 className={styles.closedBetaTitle}>{t('auth:closedBeta.title')}</h2>
            <p className={styles.closedBetaDescription}>{t('auth:closedBeta.description')}</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => switchMode('login')}
            >
              {t('auth:closedBeta.backToLogin')}
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className={styles.field}>
                <input
                  className={styles.input}
                  type="email"
                  placeholder={t('auth:form.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <input
                  className={styles.input}
                  type="password"
                  placeholder={t('auth:form.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <button type="button" className={styles.forgotLink} onClick={handleForgotClick}>
                {t('auth:form.forgotPassword')}
              </button>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
                data-testid="auth-submit"
              >
                {submitting
                  ? t('auth:form.processing')
                  : t('auth:form.loginButton')}
              </button>
            </form>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span>{t('common:or')}</span>
              <span className={styles.dividerLine} />
            </div>

            <button className={styles.googleBtn} onClick={handleGoogleClick}>
              {t('auth:form.continueWithGoogle')}
            </button>
          </>
        )}
```

**重要な変更点:**
- register 分岐を verify と login の間に追加
- else ブロック（login）は `mode === 'register'` 関連のコードを削除:
  - `{mode === 'register' && (<name入力>)}` を削除（login専用になったので常に名前欄なし）
  - ログインボタンラベルの三項 `mode === 'login' ? t('auth:form.loginButton') : t('auth:form.createAccount')` を `t('auth:form.loginButton')` に固定
  - `{mode === 'login' && <forgotLink>}` を常時表示に変更（else ブロックは login のみなので条件削除）

- [ ] **Step 2: テスト実行**

```bash
npm run test:unit -- src/features/landing/components/AuthModal.test.tsx
```

Expected: Task 3 で追加した3テスト + 既存テストがすべてPASS。

ただし「registerで name/email/password を入力して submit」系の既存テストがある場合、そこで **新しい期待値** に合わせて削除または更新が必要。FAIL 内容を確認して対象を修正する:

- register submit 成功テストがあれば **削除**（register機能自体が無効化されるため）
- register→verify 遷移テストがあれば **削除**
- register エラー表示テストがあれば **削除**

これらを削除後、再度 `npm run test:unit -- src/features/landing/components/AuthModal.test.tsx` で全PASSを確認。

- [ ] **Step 3: コミット**

```bash
git add src/features/landing/components/AuthModal.tsx src/features/landing/components/AuthModal.test.tsx
git commit -m "feat(#302): disable register UI and show closed-beta notice"
```

---

## Task 5: テストヘルパー `createTestUser` を追加

**Files:**
- Create: `tests/helpers/create-test-user.ts`

- [ ] **Step 1: ヘルパー作成**

`tests/helpers/create-test-user.ts` を新規作成:

```ts
import type Database from 'better-sqlite3'
import { hashPassword } from '../../api/lib/password'
import { createVerificationToken } from '../../api/lib/jwt'
import { generateId } from '../../api/lib/id'

export interface CreateTestUserOptions {
  email: string
  password: string
  name: string
  emailVerified?: boolean
  role?: 'user' | 'admin'
  aiEnabled?: boolean
  verificationSentAt?: string
  jwtSecret: string
}

export interface TestUser {
  id: string
  email: string
  verificationToken: string
}

/**
 * テスト用ユーザーを D1 (sqlite) に直接 INSERT する。
 * /api/auth/register が 503 を返すようになったため、他エンドポイントのテスト用 setup に使う。
 */
export async function createTestUser(
  db: ReturnType<typeof Database>,
  opts: CreateTestUserOptions,
): Promise<TestUser> {
  const id = generateId()
  const passwordHash = await hashPassword(opts.password)
  const verificationToken = await createVerificationToken(id, opts.jwtSecret)
  const verificationSentAt = opts.verificationSentAt ?? new Date().toISOString()

  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, email_verified, verification_token, verification_sent_at, role, ai_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.email.toLowerCase(),
    passwordHash,
    opts.name.trim(),
    opts.emailVerified ? 1 : 0,
    verificationToken,
    verificationSentAt,
    opts.role ?? 'user',
    opts.aiEnabled ? 1 : 0,
  )

  return { id, email: opts.email.toLowerCase(), verificationToken }
}
```

- [ ] **Step 2: スキーマ検証（role/ai_enabled カラムが users テーブルに存在することを確認）**

```bash
grep -nE "role|ai_enabled" migrations/0006_ai_admin.sql
```

Expected: `role` と `ai_enabled` カラムが `users` テーブルに追加されている。

存在しない場合は INSERT で失敗するので、`migrations/` を確認して正しいカラム名・デフォルト値を使うよう `create-test-user.ts` を調整する。

- [ ] **Step 3: TypeScript コンパイル確認**

```bash
npx tsc --noEmit
```

Expected: 追加ファイルに関するエラーなし。

- [ ] **Step 4: コミット**

```bash
git add tests/helpers/create-test-user.ts
git commit -m "test(#302): add createTestUser helper for direct DB seeding"
```

---

## Task 6: `/register` テストを 503 テストに書き換え (Red)

**Files:**
- Modify: `tests/api/routes/auth.test.ts`

- [ ] **Step 1: `describe('POST /api/auth/register', () => { ... })` ブロック全体を置換**

`tests/api/routes/auth.test.ts` 内の `describe('POST /api/auth/register'` から 該当describeブロック終端（`  })` ※line 354 付近）までを以下に置換:

```ts
  // === Registration (Closed Beta: disabled, returns 503) ===
  describe('POST /api/auth/register', () => {
    it('should return 503 with closed-beta message', async () => {
      const res = await postJson(
        '/api/auth/register',
        { email: 'test@example.com', password: 'password123', name: 'Test' },
        env,
      )
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toBe('現在はクローズドβテスト中です')
    })

    it('should return 503 even with empty body', async () => {
      const res = await postJson('/api/auth/register', {}, env)
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toBe('現在はクローズドβテスト中です')
    })

    it('should return 503 for malformed JSON body', async () => {
      const res = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        },
        env,
      )
      expect(res.status).toBe(503)
    })

    it('should NOT create a user in DB when register is called', async () => {
      await postJson(
        '/api/auth/register',
        { email: 'never@example.com', password: 'password123', name: 'Never' },
        env,
      )
      const user = db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get('never@example.com')
      expect(user).toBeUndefined()
    })

    it('should NOT set auth_token cookie', async () => {
      const res = await postJson(
        '/api/auth/register',
        { email: 'test@example.com', password: 'password123', name: 'Test' },
        env,
      )
      expect(res.headers.get('set-cookie')).toBeNull()
    })
  })
```

- [ ] **Step 2: 失敗を確認**

```bash
npm run test:unit -- tests/api/routes/auth.test.ts
```

Expected: 上記5件のテストが FAIL（`/register` がまだ 201 を返すため）。また、**他の describe 内**で `/register` を呼んでいる setup もすべて FAIL する（既存ユーザーが作成できず 401 になる等）。Task 7 でまとめて修正する。

- [ ] **Step 3: コミット**

```bash
git add tests/api/routes/auth.test.ts
git commit -m "test(#302): replace /register success tests with 503 assertions"
```

---

## Task 7: `/register` を 503 早期returnに変更 (Green)

**Files:**
- Modify: `api/routes/auth.ts`

- [ ] **Step 1: `/register` ハンドラの冒頭に早期returnを追加**

`api/routes/auth.ts` の 28行目 `auth.post('/register', async (c) => {` の直後（`{` の次行）に以下を追加:

```ts
auth.post('/register', async (c) => {
  // Closed beta: registration is temporarily disabled.
  // Revert this PR to restore normal registration.
  return c.json({ error: '現在はクローズドβテスト中です' }, 503)

  let body: { email?: string; password?: string; name?: string }
  // ...以下、既存コードは到達しない（revert容易性のため残す）
```

既存コードは一切削除せず、unreachable として残す。

- [ ] **Step 2: `/register` テストだけ実行して Task 6 追加分の PASS を確認**

```bash
npm run test:unit -- tests/api/routes/auth.test.ts -t "POST /api/auth/register"
```

Expected: Task 6 で追加した5件のテストが PASS。

- [ ] **Step 3: コミット**

```bash
git add api/routes/auth.ts
git commit -m "feat(#302): return 503 for POST /auth/register during closed beta"
```

---

## Task 8: 他エンドポイントのテスト setup を createTestUser に移行

**Files:**
- Modify: `tests/api/routes/auth.test.ts`

この時点で `/login`, `/me`, `/verify`, `/resend-verification` のテストの多くが `/register` に依存して FAIL しているはず。すべて `createTestUser` 呼び出しに置き換える。

- [ ] **Step 1: import 追加**

`tests/api/routes/auth.test.ts` の先頭 import 群に以下を追加（`createMockD1` の import の下）:

```ts
import { createTestUser } from '../../helpers/create-test-user'
```

- [ ] **Step 2: `POST /api/auth/login` の beforeEach を書き換え**

変更前 (line 357-369 付近):

```ts
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing',
        },
        env,
      )
      // メール認証済みに設定
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('existing@example.com')
    })
```

変更後:

```ts
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser(db, {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
    })
```

- [ ] **Step 3: `/login` 内の `should return 403 for unverified user` テストを書き換え**

変更前 (line 486-507 付近):

```ts
    it('should return 403 for unverified user', async () => {
      await postJson(
        '/api/auth/register',
        {
          email: 'unverified@example.com',
          password: 'password123',
          name: 'Unverified',
        },
        env,
      )
      const res = await postJson(
        '/api/auth/login',
        {
          email: 'unverified@example.com',
          password: 'password123',
        },
        env,
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('メール認証')
    })
```

変更後:

```ts
    it('should return 403 for unverified user', async () => {
      await createTestUser(db, {
        email: 'unverified@example.com',
        password: 'password123',
        name: 'Unverified',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const res = await postJson(
        '/api/auth/login',
        { email: 'unverified@example.com', password: 'password123' },
        env,
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('メール認証')
    })
```

- [ ] **Step 4: `GET /api/auth/me` のテスト内 register 呼び出しをすべて置換**

このdescribe内の以下3箇所（line 539-548, 569-581, 599-609, 636-647 付近）のパターン:

```ts
      await postJson(
        '/api/auth/register',
        { email: '...', password: '...', name: '...' },
        env,
      )
      db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?').run('...')
```

を以下に置換（各テスト固有の email/name を保持）:

```ts
      await createTestUser(db, {
        email: '<保持>',
        password: 'password123',
        name: '<保持>',
        emailVerified: true,
        jwtSecret: JWT_SECRET,
      })
```

admin ロール + aiEnabled のテスト（line 569-581 付近）については:

```ts
      await createTestUser(db, {
        email: 'admin-me@example.com',
        password: 'password123',
        name: 'Admin User',
        emailVerified: true,
        role: 'admin',
        aiEnabled: true,
        jwtSecret: JWT_SECRET,
      })
```

- [ ] **Step 5: `GET /api/auth/verify` のテスト内 register 呼び出しを置換**

このdescribe内の以下のパターン（line 668-676, 713-722, 745-753 付近）:

```ts
      await postJson(
        '/api/auth/register',
        { email: 'verify@example.com', password: 'password123', name: 'Verify' },
        env,
      )
      const user = db
        .prepare('SELECT verification_token FROM users WHERE email = ?')
        .get('verify@example.com') as { verification_token: string }
```

を以下に置換（`createTestUser` は返り値として `verificationToken` を返すので SELECT を省略可）:

```ts
      const created = await createTestUser(db, {
        email: 'verify@example.com',
        password: 'password123',
        name: 'Verify',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const user = { verification_token: created.verificationToken }
```

※変数名 `user` と `.verification_token` を残すことで、後続の `user.verification_token` 参照コードは無修正で動く。

- [ ] **Step 6: `POST /api/auth/resend-verification` のテスト内 register 呼び出しを置換**

このdescribe内の各 register 呼び出し（line 769-774, 801-807, 818-823, 834-839 付近）を以下パターンに置換:

verified=false で作成する場合:

```ts
      await createTestUser(db, {
        email: '<保持>',
        password: 'password123',
        name: '<保持>',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
```

`verified@example.com`（`should return 200 for already verified user`）は `emailVerified: true` に設定。

**重要**: `should resend verification email for unverified user` (line 769 付近) では、作成後に
```ts
db.prepare('UPDATE users SET verification_sent_at = ? WHERE email = ?').run(
  new Date(Date.now() - 120000).toISOString(),
  'resend@example.com',
)
```
でレート制限回避をしている。これは **createTestUser の `verificationSentAt` オプションで代替できる**ので以下に簡略化:

```ts
      await createTestUser(db, {
        email: 'resend@example.com',
        password: 'password123',
        name: 'Resend',
        emailVerified: false,
        verificationSentAt: new Date(Date.now() - 120000).toISOString(),
        jwtSecret: JWT_SECRET,
      })
```

`should return 429 for rate-limited resend within 60 seconds` (line 818 付近) は **直後に resend を叩く** ため `verificationSentAt` を **現在時刻（デフォルト）** で作成し、置換後のテストは以下:

```ts
    it('should return 429 for rate-limited resend within 60 seconds', async () => {
      await createTestUser(db, {
        email: 'rate@example.com',
        password: 'password123',
        name: 'Rate',
        emailVerified: false,
        jwtSecret: JWT_SECRET,
      })
      const res = await postJson(
        '/api/auth/resend-verification',
        { email: 'rate@example.com' },
        env,
      )
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toContain('60秒')
    })
```

`should update verification_token and verification_sent_at on resend` (line 834 付近) は:

```ts
    it('should update verification_token and verification_sent_at on resend', async () => {
      const pastTime = new Date(Date.now() - 120000).toISOString()
      await createTestUser(db, {
        email: 'newtoken@example.com',
        password: 'password123',
        name: 'NewToken',
        emailVerified: false,
        verificationSentAt: pastTime,
        jwtSecret: JWT_SECRET,
      })

      await postJson('/api/auth/resend-verification', { email: 'newtoken@example.com' }, env)
      const after = db
        .prepare('SELECT verification_sent_at FROM users WHERE email = ?')
        .get('newtoken@example.com') as { verification_sent_at: string }

      expect(after.verification_sent_at).not.toBe(pastTime)
    })
```

- [ ] **Step 7: auth.test.ts の全 `/register` 呼び出しが除去されたことを確認**

```bash
grep -nE "'/api/auth/register'" tests/api/routes/auth.test.ts
```

Expected: マッチは `describe('POST /api/auth/register'` 内の 503 テスト用呼び出しのみ。他の describe ブロック内に残っていないこと。

- [ ] **Step 8: auth.test.ts 全体を実行**

```bash
npm run test:unit -- tests/api/routes/auth.test.ts
```

Expected: 全 PASS。

FAIL がある場合は `jwt_secret` パラメータ漏れ、カラム名ミスマッチ、verified 状態ミス等を確認して修正。

- [ ] **Step 9: コミット**

```bash
git add tests/api/routes/auth.test.ts
git commit -m "test(#302): migrate register-based setups to createTestUser helper"
```

---

## Task 9: 他のテストファイルへの波及確認

**Files:**
- Read: 全テストファイル

`/api/auth/register` への依存が他のテストファイルにも存在するか確認する。

- [ ] **Step 1: 依存検索**

```bash
grep -rn "'/api/auth/register'" tests/
grep -rn "'/auth/register'" tests/
```

- [ ] **Step 2: 検出されたファイルを修正**

検出されたファイルがあれば、各ファイルで `createTestUser` を import して Task 8 と同様のパターンで置換する。

検出されなければこのタスクはスキップ。

- [ ] **Step 3: 全テスト実行**

```bash
npm test
```

Expected: 全 PASS。

- [ ] **Step 4: 変更があればコミット**

```bash
# 変更ファイルがある場合
git add tests/
git commit -m "test(#302): migrate remaining /register call sites"
```

変更がなければ Task 10 へ進む。

---

## Task 10: 実画面検証（Playwright / 手動）

**Files:** なし（検証のみ）

- [ ] **Step 1: 開発サーバー起動**

```bash
npm run dev
```

バックグラウンド起動後、起動確認。

- [ ] **Step 2: ja 言語での登録モーダル表示確認**

ブラウザで `http://localhost:5173/?auth=register` を開き:
- 「現在はクローズドβテスト中です」タイトルが表示される
- 「新規登録は現在受け付けておりません。既にアカウントをお持ちの方はログインしてください。」が表示される
- 「ログイン画面へ」ボタンが表示される
- フォーム（メール/パスワード入力）が**表示されない**
- 「ログイン画面へ」押下で login フォームに切替わる
- ログインタブ→新規登録タブの切替でβ案内が表示される

スクリーンショットを `.screenshots/closed-beta-register-ja.png` に保存。

- [ ] **Step 3: en 言語での表示確認**

ブラウザで言語を English に切替（または `?lng=en` 等のクエリ付与）、再度 register モーダル表示:
- "Currently in closed beta"
- "New registration is not currently available. ..."
- "Go to login"

スクリーンショットを `.screenshots/closed-beta-register-en.png` に保存。

- [ ] **Step 4: LP Navbar/Hero/CTA の「無料で始める」動作確認**

トップページで「無料で始める」系ボタンを押下 → モーダルがβ案内で開くことを確認。

- [ ] **Step 5: API 直叩き確認**

```bash
curl -s -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"x@y.com","password":"12345678","name":"X"}' \
  -i | head -20
```

Expected: `HTTP/1.1 503` と body `{"error":"現在はクローズドβテスト中です"}`

- [ ] **Step 6: 既存ユーザーのログインが正常動作することを確認**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン試行 → ダッシュボード遷移を確認。

- [ ] **Step 7: 表示速度（LCP）確認**

Chrome DevTools > Performance > Lighthouse で LP の LCP が **1秒以内** であることを確認。超過時はパフォーマンス改善をStep 5に戻って実施。

- [ ] **Step 8: 開発サーバー停止**

```bash
# バックグラウンドプロセス停止
```

---

## Task 11: 最新 main 同期 & 全テスト

**Files:** なし

- [ ] **Step 1: main 最新化 & rebase**

```bash
git pull origin main --rebase
```

コンフリクトが出たら解決してから続行。

- [ ] **Step 2: 全テスト**

```bash
npm test
```

Expected: 全 PASS。失敗があれば修正してコミット（1件でも FAIL があれば次へ進まない）。

---

## Task 12: PR 作成 & CI確認 & レビュー依頼

**Files:** なし

- [ ] **Step 1: push**

```bash
git push -u origin feat/closed-beta-register-302
```

- [ ] **Step 2: PR 作成**

```bash
gh pr create --title "feat(#302): クローズドβテスト中の新規登録無効化" --body "$(cat <<'EOF'
## Summary
- `POST /api/auth/register` が 503 + 「現在はクローズドβテスト中です」を返す（API直叩き対策）
- `AuthModal` の registerモードUIをβ案内ブロックに差し替え（フォーム/Googleボタン非表示）
- i18n `closedBeta` キーを ja/en に追加
- `/register` 依存の既存テストを D1 直接 INSERT ヘルパー（`createTestUser`）に移行

Closes #302

## Test plan
- [x] `npm test` 全 PASS
- [ ] ブラウザで `?auth=register` を開きβ案内が ja/en 両方で表示される
- [ ] `curl POST /api/auth/register` が 503 を返す
- [ ] 既存ユーザーのログインが正常動作
- [ ] LP「無料で始める」ボタン押下でβ案内モーダルが開く
- [ ] LCP 1秒以内

## Notes
- 期間限定措置のため env フラグ化せず、解除時は本PRをrevert
- `/register` ハンドラの既存ロジックは削除せず unreachable として残置

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI 監視**

```bash
gh pr checks --watch
```

Fail 時: 修正 → push → 再 watch。

- [ ] **Step 4: レビュー依頼**

全 pass 後:

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 13: 本番ビルド確認 & レビュー修正 & Merge

- [ ] **Step 1: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` に従って preview 実行。

- [ ] **Step 2: レビュー修正ループ（最大10回）**

CLAUDE.md の Step 9 に従う。`claude` のコメントのみを判定対象とし、1回ずつ個別ステップで実施。

- [A:要修正] / [B:条件つき承認] → 修正 → push → CI pass → 再レビュー依頼
- [C:承認OK] → Merge へ

- [ ] **Step 3: Merge**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git rev-parse --show-toplevel)
git -C "$MAIN/../../" fetch origin main
git -C "$MAIN/../../" merge --ff-only origin/main
```

- [ ] **Step 4: Deploy 確認**

`~/.claude/skills/deploy/SKILL.md` を参照してデプロイ確認。

- [ ] **Step 5: ワークツリー掃除**

```bash
cd /Volumes/SSD4TB/DevCode/flowline
git worktree remove .worktrees/feat/closed-beta-register-302
git branch -d feat/closed-beta-register-302
git worktree list
```

---

## 完了条件チェックリスト（Issue より）

- [ ] 登録モーダルでβ案内が表示される（ja/en両方）— Task 10
- [ ] `POST /auth/register` が 503 + 「現在はクローズドβテスト中です」を返す — Task 7
- [ ] 既存ユーザーのログインが正常動作 — Task 10
- [ ] メール認証フロー (`GET /auth/verify`) が正常動作 — Task 10, Task 8
- [ ] 関連テストの追加・更新（`AuthModal.test.tsx`、`tests/api/routes/auth.test.ts` ほか）— Task 3, 6, 8, 9
- [ ] PR 作成 & CI pass & レビュー承認 & Merge — Task 12, 13
