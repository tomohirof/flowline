# フローCRUD API 設計

## 概要

フローの作成・読み取り・更新・削除のREST APIをHonoで実装する。認証済みユーザーが自分のフローのみ操作可能。

## エンドポイント

```
GET    /api/flows          - 自分のフロー一覧取得
POST   /api/flows          - 新規フロー作成（lanes/nodes/arrows含む）
GET    /api/flows/:id      - フロー詳細取得（lanes/nodes/arrows含む）
PUT    /api/flows/:id      - フロー更新（全削除→再挿入）
DELETE /api/flows/:id      - フロー削除（CASCADE DELETE）
```

## アーキテクチャ

- 既存の`authMiddleware`で全エンドポイントを保護
- `AuthEnv`型を再利用してHonoのContext型を統一
- zodによるリクエストバリデーション
- D1の`batch()` APIで一括書き込み（トランザクション相当）

## 更新戦略

**全削除→再挿入方式**を採用。PUT時にlanes/nodes/arrowsを全削除してから再挿入する。

理由:

- DBスキーマのCASCADE DELETEと整合
- 差分計算不要でシンプル
- フローのlanes/nodes/arrowsは数十件程度のため性能問題なし

## エラーハンドリング

| ケース             | ステータス | メッセージ             |
| ------------------ | ---------- | ---------------------- |
| バリデーション失敗 | 400        | zodエラーメッセージ    |
| 未認証             | 401        | authMiddleware         |
| 他ユーザーのフロー | 403        | アクセス権なし         |
| フロー未存在       | 404        | フローが見つかりません |

## テスト戦略

- `tests/helpers/mock-d1.ts`を使用
- 認証済み/未認証/他ユーザーの3パターンでアクセス制御検証
- 全エンドポイントの正常系・異常系テスト
