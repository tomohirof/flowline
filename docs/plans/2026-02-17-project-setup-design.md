# Flowline プロジェクト初期セットアップ設計

## 概要

スイムレーンフローエディタ「Flowline」のプロジェクト基盤。クライアントサイドのインタラクティブエディタが主要機能のため、SPA構成を採用。

## アーキテクチャ

```
[ブラウザ] ←→ [Cloudflare Pages (React SPA)]
                    ↓ /api/*
            [Pages Functions (Hono)]
                    ↓
              [Cloudflare D1]
```

### 技術スタック

| 領域                 | 技術                                 |
| -------------------- | ------------------------------------ |
| フロントエンド       | Vite 6 + React 19 + TypeScript       |
| API                  | Hono v4 (Cloudflare Pages Functions) |
| DB                   | Cloudflare D1                        |
| バリデーション       | Zod                                  |
| テスト               | Vitest (ユニット) + Playwright (E2E) |
| Lint                 | ESLint 9 (flat config) + Prettier    |
| パッケージマネージャ | npm                                  |

### 選定理由

- **Vite + React SPA**: モックアップがReact単体。エディタはクライアントサイドが主体でSSRの恩恵が薄い
- **Hono**: Cloudflare Workers向けに最適化された軽量フレームワーク。D1バインディングとの相性が良い
- **Pages Functions**: SPA + APIを同一プロジェクトで管理でき、デプロイがシンプル

## ディレクトリ構成

```
flowline/
├── src/
│   ├── components/       # 共通コンポーネント
│   ├── features/         # 機能別（editor/, dashboard/, auth/）
│   ├── hooks/            # カスタムフック
│   ├── lib/              # ユーティリティ、API client
│   ├── types/            # 型定義
│   ├── App.tsx
│   └── main.tsx
├── functions/
│   └── [[path]].ts       # Hono catch-all
├── api/                   # APIハンドラー（functionsから参照）
│   ├── routes/
│   └── middleware/
├── migrations/            # D1マイグレーション
├── docs/                  # モックアップ、設計書
├── tests/                 # テスト
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## API構成

`functions/[[path]].ts` がcatch-allでHonoアプリに委譲。初期セットアップではヘルスチェックAPIのみ実装。

```typescript
// functions/[[path]].ts
import { handle } from 'hono/cloudflare-pages'
import { app } from '../api/app'
export const onRequest = handle(app)

// api/app.ts
const app = new Hono<{ Bindings: { FLOWLINE_DB: D1Database } }>().basePath('/api')
app.get('/health', (c) => c.json({ status: 'ok' }))
```

## 開発環境

### スクリプト

| コマンド             | 動作                                     |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | フロントエンド + Pages Functions同時起動 |
| `npm run build`      | TypeScriptチェック + Viteビルド          |
| `npm test`           | Vitest実行                               |
| `npm run lint`       | ESLint + Prettier                        |
| `npm run db:migrate` | D1マイグレーション適用（ローカル）       |
| `npm run deploy`     | ビルド + Cloudflare Pagesデプロイ        |

### wrangler.toml

```toml
name = "flowline"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "FLOWLINE_DB"
database_name = "flowline-db"
database_id = "<作成後に設定>"
```

### CI（GitHub Actions）

- push時: lint + test
- mainマージ時: lint + test + deploy（任意）

## 受け入れ条件

- `npm run dev` でローカル開発環境が起動する
- `npm run build` でビルドが成功する
- `/api/health` がJSON `{ status: 'ok' }` を返す
- `npm test` でテストが通る
- D1にローカルから接続できる
