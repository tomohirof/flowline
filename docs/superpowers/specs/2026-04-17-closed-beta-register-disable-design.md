# 新規登録を一時的に無効化（クローズドβテスト中表示）設計

- Issue: https://github.com/tomohirof/flowline/issues/302
- 作成日: 2026-04-17

## 背景・目的

クローズドβテスト中のため、新規ユーザー登録（メール/パスワード）を一時的に無効化する。
既存ユーザーのログインおよびメール認証フローは通常通り動作させる。
期間限定措置のため、env変数等のフラグ化は行わず、解除時は本対応のPRをrevertする。

## スコープ

**対象:**

- バックエンド `POST /api/auth/register` の503化
- フロント `AuthModal.tsx` のregisterモードUIをβ案内に差し替え
- i18n `src/locales/{ja,en}/auth.json` にβ案内メッセージ追加
- 既存テストの更新・新規テストの追加

**対象外（後続Issue）:**

- 管理者によるユーザー招待機能

## アーキテクチャ方針

**「revert容易性」を最優先**する。既存ロジックは削除せず、早期returnとUI分岐の追加のみで実装。

### バックエンド: `api/routes/auth.ts`

`POST /api/auth/register` ハンドラ冒頭で503を即返す早期return方式とする。

```ts
auth.post('/register', async (c) => {
  return c.json({ error: '現在はクローズドβテスト中です' }, 503)

  // 以下、既存の validation / DB処理 / メール送信は到達しない
  // revertで復活させる
  ...
})
```

理由: コード削除ではなく unreachable code として残すと「ただの revert」で復元可能。

他のエンドポイント（`/login`, `/logout`, `/me`, `/verify`, `/resend-verification`）は無変更。

### フロント: `src/features/landing/components/AuthModal.tsx`

`mode === 'register'` の場合、既存の `<form>` + divider + Googleボタンの代わりに **β案内ブロック**を表示する。

```tsx
{mode === 'verify' ? (
  // 既存のverify UI（無変更）
) : mode === 'register' ? (
  <div className={styles.closedBetaContainer} data-testid="closed-beta-notice">
    <h2>{t('auth:closedBeta.title')}</h2>
    <p>{t('auth:closedBeta.description')}</p>
    <button type="button" className={styles.submitBtn} onClick={() => switchMode('login')}>
      {t('auth:closedBeta.backToLogin')}
    </button>
  </div>
) : (
  // 既存のloginフォーム（無変更）
)}
```

**UI仕様:**

- 「ログイン」「新規登録」タブは残す（現状の `mode !== 'verify'` 条件そのまま）
- 「新規登録」タブ押下でβ案内が表示される
- β案内には「ログインへ」ボタンを配置し、クリックで `switchMode('login')` 遷移
- エラー/インフォ表示（`error`, `info` state）は残す（他モード共通のためそのまま）
- verify モード・login モードは完全に無変更

**スタイル:**

- `AuthModal.module.css` に `closedBetaContainer` クラスを追加（`verifyContainer` と同系統のレイアウト）

### i18n: `src/locales/{ja,en}/auth.json`

新規キー `closedBeta` を追加:

**ja:**

```json
"closedBeta": {
  "title": "現在はクローズドβテスト中です",
  "description": "新規登録は現在受け付けておりません。既にアカウントをお持ちの方はログインしてください。",
  "backToLogin": "ログイン画面へ"
}
```

**en:**

```json
"closedBeta": {
  "title": "Currently in closed beta",
  "description": "New registration is not currently available. If you already have an account, please log in.",
  "backToLogin": "Go to login"
}
```

## 到達経路の確認

`AuthModal` は以下の経路で `initialMode="register"` が渡される。すべて上記の差し替えだけでβ案内が出る。

1. LP Navbar の「新規登録」ボタン → `AuthModal` を `register` で開く
2. LP Hero/CTA の「無料で始める」ボタン → `AuthModal` を `register` で開く
3. `/?auth=register` URLアクセス → `AuthModal` を `register` で開く
4. Demoエディタから `initialMode="register"` 経由 → `AuthModal` を `register` で開く

LP側のボタン自体は残す（クリック後モーダル内でβ案内表示）。

## テスト方針

### バックエンド: `tests/api/routes/auth.test.ts`

**既存テスト（約20件 `/register` 依存）への影響:**

`/register` が503を返すようになると、以下のテストは破綻する：

- `POST /api/auth/register` の success/validation ケース
- `/login`, `/me`, `/verify`, `/resend-verification` の **setup で `/register` を呼んでいるテスト**（多数）

**対応方針:**

1. `/register` の既存成功テストを **「503と正しいエラーメッセージを返す」テスト1件に置換**
2. `/register` の既存バリデーションテスト（8文字以上、メール形式等）は**削除**（503で一律返すため無意味化）
3. `/login`, `/me`, `/verify`, `/resend-verification` テストで `/register` を呼んでいる setup 箇所は **D1 DB 直接 INSERT** に置き換え
   - ヘルパー関数 `createTestUser(env, { email, password, name, emailVerified })` を切り出して重複排除
   - パスワードは `hashPassword()` で正しくハッシュ化して INSERT
   - `email_verified = 1/0`、`verification_token` も適切に設定

**追加テスト:**

- `POST /api/auth/register` が method/bodyに関わらず503を返す（body なしでも503）
- レスポンス body が `{ error: '現在はクローズドβテスト中です' }` 完全一致

### フロント: `src/features/landing/components/AuthModal.test.tsx`

**更新:**

- 「新規登録モードで名前・メール・パスワード入力を表示する」テストを **「registerモードでβ案内が表示される（フォーム非表示）」に置換**
- registerモードでタブクリック時のテストも更新

**追加:**

- registerモードで `closed-beta-notice` が表示される
- registerモードで「お名前」入力フィールドが**表示されない**
- β案内の「ログインへ」ボタンをクリックするとloginモードに切替わる
- `initialMode="register"` で直接開いた場合もβ案内が表示される
- タブを「新規登録」→「ログイン」→「新規登録」と切り替えた場合もβ案内が復帰する

### i18nキー検証

- ja/en 両方に `closedBeta.title`, `closedBeta.description`, `closedBeta.backToLogin` が存在すること（既存の i18n キー整合性テストがあれば自動検出、無ければ手動確認）

## エッジケース

| ケース                                          | 挙動                                       |
| ----------------------------------------------- | ------------------------------------------ |
| API を直叩きで `POST /auth/register` を叩く     | 503 + メッセージ（UI経由を迂回しても防御） |
| すでに登録済みユーザーのログイン                | 無影響（`/login` 無変更）                  |
| 未認証ユーザーのログイン試行（403）             | 無影響（verify モードへの遷移継続）        |
| メール認証リンククリック（`/verify?token=...`） | 無影響                                     |
| 確認メール再送                                  | 無影響                                     |
| `/?auth=register` でLP訪問                      | モーダルがβ案内で開く                      |

## 実装リスク

- **リスク1**: `/register` に依存する既存テストが広範囲 → D1 INSERT ヘルパーへの移行で確実に対応
- **リスク2**: 他に `/auth/register` を呼ぶフロントコードがあるか → `useAuth.register` 経由のみ、AuthModalの差し替えで到達しなくなる（ただし useAuth 自体のコードは残す）
- **リスク3**: Demoエディタ・LPなど複数経路あり → すべて AuthModal 経由のため一箇所修正で全経路カバー

## 完了条件（Issueより）

- [ ] 登録モーダルでβ案内が表示される（ja/en両方）
- [ ] `POST /auth/register` が 503 + 「現在はクローズドβテスト中です」を返す
- [ ] 既存ユーザーのログインが正常動作
- [ ] メール認証フロー (`GET /auth/verify`) が正常動作
- [ ] 関連テストの追加・更新（`AuthModal.test.tsx`、`tests/api/routes/auth.test.ts` ほか）
- [ ] 全 `npm test` pass
- [ ] 実画面での ja/en 表示確認（Playwright）
