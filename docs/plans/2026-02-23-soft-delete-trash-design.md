# ソフトデリート + ゴミ箱機能 設計書

## 概要

フロー削除を物理削除からソフトデリートに変更し、ダッシュボードにゴミ箱ビューを追加。削除済みフローの復元・完全削除を可能にする。

## DBスキーマ

`flows`テーブルに`deleted_at TEXT DEFAULT NULL`を追加（マイグレーション0005）。

## API変更

### 既存エンドポイント修正

- `GET /api/flows`: `WHERE deleted_at IS NULL`条件追加
- `GET /api/flows/:id`: `WHERE deleted_at IS NULL`条件追加（削除済みアクセス防止）
- `PUT /api/flows/:id`: `WHERE deleted_at IS NULL`条件追加
- `DELETE /api/flows/:id`: 物理削除 → `UPDATE SET deleted_at=datetime('now'), share_token=NULL`

### 新規エンドポイント

- `GET /api/flows/trash`: ゴミ箱一覧（`WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`）
- `POST /api/flows/:id/restore`: 復元（`UPDATE SET deleted_at=NULL`）
- `DELETE /api/flows/:id/permanent`: 完全削除（`deleted_at IS NOT NULL`条件付き物理削除）

### checkFlowOwnership

変更なし。削除済みフローの復元・完全削除にも使うため、`deleted_at`条件は各エンドポイントで制御。

## フロントエンド変更

### 型

`FlowSummary`と`FlowListResponse`に`deletedAt`フィールド追加。

### Dashboard

`selectedNav`に`'trash'`を追加。nav状態に応じて`/flows`と`/flows/trash`を切り替え。

### DashboardSidebar

ゴミ箱ナビアイテム追加。

### FlowCard / FlowContextMenu

ゴミ箱モード時は「復元」「完全に削除」アクション表示。通常モードは変更なし。

### 削除確認メッセージ

「ゴミ箱に移動しますか？」に変更。

## スコープ外

- 自動削除（30日経過）: 将来対応
- 「ゴミ箱を空にする」一括操作: 将来対応

## 対象ファイル

### バックエンド
- `migrations/0005_soft_delete.sql`（新規）
- `api/routes/flows.ts`
- `api/lib/flow-transform.ts`
- `tests/api/routes/flows.test.ts`

### フロントエンド
- `src/features/editor/types.ts`
- `src/features/dashboard/Dashboard.tsx`
- `src/features/dashboard/Dashboard.test.tsx`
- `src/features/dashboard/DashboardSidebar.tsx`
- `src/features/dashboard/FlowCard.tsx`
- `src/features/dashboard/FlowContextMenu.tsx`
