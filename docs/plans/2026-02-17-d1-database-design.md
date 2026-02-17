# D1データベース設計

## 概要

FlowlineのデータをCloudflare D1（SQLiteベース）に保存するための正規化テーブル設計。

## スキーマ

### users

| カラム        | 型   | 制約             | 説明             |
| ------------- | ---- | ---------------- | ---------------- |
| id            | TEXT | PK               | ULID             |
| email         | TEXT | UNIQUE NOT NULL  | ログイン用メール |
| password_hash | TEXT | NOT NULL         | bcryptハッシュ   |
| name          | TEXT | NOT NULL         | 表示名           |
| created_at    | TEXT | NOT NULL DEFAULT | ISO8601          |
| updated_at    | TEXT | NOT NULL DEFAULT | ISO8601          |

### flows

| カラム      | 型   | 制約                            | 説明         |
| ----------- | ---- | ------------------------------- | ------------ |
| id          | TEXT | PK                              | ULID         |
| user_id     | TEXT | FK → users.id, NOT NULL         | 所有者       |
| title       | TEXT | NOT NULL DEFAULT '無題のフロー' | フロー名     |
| theme_id    | TEXT | NOT NULL DEFAULT 'cloud'        | テーマID     |
| share_token | TEXT | UNIQUE, NULL許可                | 共有トークン |
| created_at  | TEXT | NOT NULL DEFAULT                | ISO8601      |
| updated_at  | TEXT | NOT NULL DEFAULT                | ISO8601      |

### lanes

| カラム      | 型      | 制約                                      | 説明                |
| ----------- | ------- | ----------------------------------------- | ------------------- |
| id          | TEXT    | PK                                        | ULID                |
| flow_id     | TEXT    | FK → flows.id ON DELETE CASCADE, NOT NULL | 所属フロー          |
| name        | TEXT    | NOT NULL                                  | レーン名            |
| color_index | INTEGER | NOT NULL DEFAULT 0                        | PALETTES配列index   |
| position    | INTEGER | NOT NULL                                  | 表示順序（0始まり） |

### nodes

| カラム      | 型      | 制約                                      | 説明              |
| ----------- | ------- | ----------------------------------------- | ----------------- |
| id          | TEXT    | PK                                        | ULID              |
| flow_id     | TEXT    | FK → flows.id ON DELETE CASCADE, NOT NULL | 所属フロー        |
| lane_id     | TEXT    | FK → lanes.id ON DELETE CASCADE, NOT NULL | 所属レーン        |
| row_index   | INTEGER | NOT NULL                                  | 行位置（0始まり） |
| label       | TEXT    | NOT NULL DEFAULT '作業'                   | ノードラベル      |
| note        | TEXT    | NULL                                      | メモ              |
| order_index | INTEGER | NOT NULL                                  | 作成順序          |

### arrows

| カラム       | 型   | 制約                                      | 説明           |
| ------------ | ---- | ----------------------------------------- | -------------- |
| id           | TEXT | PK                                        | ULID           |
| flow_id      | TEXT | FK → flows.id ON DELETE CASCADE, NOT NULL | 所属フロー     |
| from_node_id | TEXT | FK → nodes.id ON DELETE CASCADE, NOT NULL | 接続元         |
| to_node_id   | TEXT | FK → nodes.id ON DELETE CASCADE, NOT NULL | 接続先         |
| comment      | TEXT | NULL                                      | 接続線コメント |

## インデックス

- `idx_flows_user_id` ON flows(user_id)
- `idx_flows_share_token` ON flows(share_token) WHERE share_token IS NOT NULL
- `idx_lanes_flow_id` ON lanes(flow_id)
- `idx_nodes_flow_id` ON nodes(flow_id)
- `idx_nodes_lane_id` ON nodes(lane_id)
- `idx_arrows_flow_id` ON arrows(flow_id)

## 設計判断

- **rowsテーブル不要**: モックアップの行は自動生成。ノードのrow_indexで十分
- **CASCADE DELETE**: フロー削除時にlanes/nodes/arrowsを連鎖削除
- **ULID**: ソート可能な一意ID。D1ではTEXT型で保存
- **ISO8601日時**: D1にはDATE型がないためTEXTで保存
- **share_token**: NULL=非共有、値あり=共有中。UNIQUEで重複防止
