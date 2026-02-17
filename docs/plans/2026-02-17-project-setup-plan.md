# プロジェクト初期セットアップ 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Flowlineプロジェクトの開発基盤を構築し、`npm run dev`でフロントエンド+API+D1が動作する状態にする

**Architecture:** Vite + React SPAをCloudflare Pagesにデプロイ。Pages Functions（catch-all）でHono APIを提供。D1にデータ保存。

**Tech Stack:** Vite 6, React 19, TypeScript, Hono v4, Cloudflare D1, Vitest, ESLint 9, Prettier

---

### Task 1: Vite + React + TypeScript プロジェクト作成

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/vite-env.d.ts`

**Step 1: Viteでプロジェクト作成**

Run:

```bash
cd /Volumes/SSD4TB/DevCode/flowline
npm create vite@latest . -- --template react-ts
```

既存ファイルとの競合を聞かれたら「既存ファイルを無視して作成」を選択。`.gitignore`が上書きされた場合は内容を確認。

**Step 2: 依存パッケージインストール**

Run:

```bash
npm install
```

**Step 3: 動作確認**

Run:

```bash
npm run dev
```

Expected: Vite dev serverが起動し、ブラウザでReactのデフォルトページが表示される。Ctrl+Cで停止。

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: initialize Vite + React + TypeScript project"
```

---

### Task 2: Hono + Cloudflare Pages Functions セットアップ

**Files:**

- Create: `functions/[[path]].ts`
- Create: `api/app.ts`
- Create: `wrangler.toml`
- Modify: `package.json` (devDependencies追加)

**Step 1: Hono と wrangler をインストール**

Run:

```bash
npm install hono
npm install -D wrangler @cloudflare/workers-types
```

**Step 2: wrangler.toml を作成**

Create `wrangler.toml`:

```toml
name = "flowline"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "FLOWLINE_DB"
database_name = "flowline-db"
database_id = "placeholder"
```

**Step 3: APIアプリを作成**

Create `api/app.ts`:

```typescript
import { Hono } from 'hono'

type Bindings = {
  FLOWLINE_DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

export { app }
export type { Bindings }
```

**Step 4: Pages Functions catch-all を作成**

Create `functions/[[path]].ts`:

```typescript
import { handle } from 'hono/cloudflare-pages'
import { app } from '../api/app'

export const onRequest = handle(app)
```

**Step 5: tsconfig にworkers型を追加**

`tsconfig.app.json` の `compilerOptions.types` に `"@cloudflare/workers-types"` を追加。
`include` に `"api/**/*.ts"`, `"functions/**/*.ts"` を追加。

**Step 6: package.json にスクリプト追加**

`package.json` の `scripts` に以下を追加:

```json
{
  "preview": "wrangler pages dev dist --d1 FLOWLINE_DB",
  "db:migrate": "wrangler d1 migrations apply FLOWLINE_DB --local",
  "db:migrate:remote": "wrangler d1 migrations apply FLOWLINE_DB --remote",
  "deploy": "npm run build && wrangler pages deploy dist"
}
```

`dev` スクリプトは後でconcurrentlyを入れた後に変更する。

**Step 7: ビルドして動作確認**

Run:

```bash
npm run build
npm run preview
```

Expected: `http://localhost:8788` でSPAが表示される。`http://localhost:8788/api/health` で `{"status":"ok"}` が返る。Ctrl+Cで停止。

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Hono API with Cloudflare Pages Functions"
```

---

### Task 3: ヘルスチェックAPIのテスト（TDD）

**Files:**

- Create: `vitest.config.ts`
- Create: `tests/api/health.test.ts`
- Modify: `package.json` (vitest追加)

**Step 1: Vitestインストール**

Run:

```bash
npm install -D vitest
```

**Step 2: vitest.config.ts を作成**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

**Step 3: 失敗するテストを書く**

Create `tests/api/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { app } from '../../api/app'

describe('GET /api/health', () => {
  it('should return status ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('should return JSON content type', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
```

**Step 4: テスト実行して成功を確認**

Run:

```bash
npx vitest run
```

Expected: 2つのテストがPASS（実装は既にTask 2で完了しているため）

**Step 5: package.json のtestスクリプト更新**

`package.json` の `scripts.test` を `"vitest run"` に変更。

Run:

```bash
npm test
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "test: add health check API tests with Vitest"
```

---

### Task 4: ESLint + Prettier 設定

**Files:**

- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (devDependencies + scripts)

**Step 1: ESLint + Prettier インストール**

Run:

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

**Step 2: eslint.config.js 作成**

Create `eslint.config.js`:

```javascript
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', '.wrangler', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettier,
)
```

**Step 3: .prettierrc 作成**

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Step 4: package.json にlintスクリプト追加**

```json
{
  "lint": "eslint . && prettier --check .",
  "lint:fix": "eslint --fix . && prettier --write ."
}
```

**Step 5: lint実行して修正**

Run:

```bash
npm run lint:fix
npm run lint
```

Expected: エラーなし

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: add ESLint 9 + Prettier configuration"
```

---

### Task 5: 開発環境スクリプト統合

**Files:**

- Modify: `package.json` (devスクリプト変更)
- Modify: `vite.config.ts` (proxy設定)

**Step 1: concurrentlyインストール**

Run:

```bash
npm install -D concurrently
```

**Step 2: vite.config.ts にプロキシ追加**

`vite.config.ts` を更新。devモードで `/api` へのリクエストをwrangler dev serverにプロキシ:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
```

**Step 3: devスクリプトを更新**

`package.json` の `scripts.dev` を以下に変更:

```json
{
  "dev": "concurrently \"vite\" \"wrangler pages dev dist --d1 FLOWLINE_DB --port 8788\" --names frontend,api --prefix-colors blue,green",
  "dev:frontend": "vite",
  "dev:api": "wrangler pages dev dist --d1 FLOWLINE_DB --port 8788"
}
```

**Step 4: 動作確認**

Run:

```bash
npm run build
npm run dev
```

Expected: フロントエンド（Vite）とAPI（wrangler）が同時起動する。ブラウザでSPAが表示され、`/api/health`にもアクセスできる。

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add concurrent dev server with API proxy"
```

---

### Task 6: ディレクトリ構成とプレースホルダー作成

**Files:**

- Create: `src/components/.gitkeep`
- Create: `src/features/.gitkeep`
- Create: `src/hooks/.gitkeep`
- Create: `src/lib/.gitkeep`
- Create: `src/types/.gitkeep`
- Create: `api/routes/.gitkeep`
- Create: `api/middleware/.gitkeep`
- Create: `migrations/.gitkeep`

**Step 1: ディレクトリ作成**

Run:

```bash
mkdir -p src/components src/features src/hooks src/lib src/types api/routes api/middleware migrations
touch src/components/.gitkeep src/features/.gitkeep src/hooks/.gitkeep src/lib/.gitkeep src/types/.gitkeep api/routes/.gitkeep api/middleware/.gitkeep migrations/.gitkeep
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: add directory structure placeholders"
```

---

### Task 7: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

**Step 1: CI設定ファイル作成**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

**Step 2: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow for lint and test"
```

---

### Task 8: 最終確認

**Step 1: 全テスト実行**

Run:

```bash
npm test
```

Expected: 全テストPASS

**Step 2: lint確認**

Run:

```bash
npm run lint
```

Expected: エラーなし

**Step 3: ビルド確認**

Run:

```bash
npm run build
```

Expected: ビルド成功

**Step 4: push**

```bash
git push origin main
```

---

## 完了条件チェックリスト

- [ ] `npm run dev` でローカル開発環境が起動する
- [ ] `npm run build` でビルドが成功する
- [ ] `/api/health` が `{"status":"ok"}` を返す
- [ ] `npm test` で全テストが通る
- [ ] `npm run lint` でエラーなし
- [ ] GitHub Actions CIが設定されている
- [ ] ディレクトリ構成が設計通りになっている
