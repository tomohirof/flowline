# プロジェクト共同編集機能（共有プロジェクト） — 設計書

- **Date**: 2026-04-24
- **Status**: Draft
- **Related Issue**: （新規）
- **Related PRs**: #305（招待コード制による新規登録）

## 背景

PR #305 で招待コード制の β 新規登録を開通した。現状、登録したユーザーは完全に独立したアカウントを持ち、他ユーザーのフローに対しては既存の `share_token`（閲覧専用）経由でしかアクセスできない。β メンバー同士でフローを共同編集したいニーズが出てきたため、プロジェクトを単位とした小規模カジュアル共同編集を実装する。

## 要件サマリー

| 項目                   | 決定事項                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| ユースケース           | 小規模（1〜5人）カジュアル共同編集                                                                           |
| 共有単位               | プロジェクト（配下のフロー一式を共同編集）                                                                   |
| 権限モデル             | 2 階層: オーナー（作成者）/ 編集者（招待されたメンバー）                                                     |
| 招待方式               | リンク共有（プロジェクト詳細画面から「招待リンクをコピー」）                                                 |
| 招待対象               | 既存 β ユーザーのみ。未登録者は「先に β 招待コードで登録してください」                                       |
| リンクのライフサイクル | 期限なし / オーナーが「取り消し」で NULL に戻せる（既存 `share_token` と同じ最小実装。再生成時は新トークン） |
| メンバー管理           | 双方向: オーナーが削除可 / メンバー自発退出可                                                                |
| ダッシュボード表示     | サイドバーに「共有されたプロジェクト」セクションを分離して追加                                               |
| フロー所有権           | 既存 `flows.user_id` そのまま。権限判定は `flow.user_id === me OR isProjectMember(flow.project_id)`          |
| オーナー権限           | フロー編集・作成・削除 / プロジェクト削除・改名 / メンバー招待・削除                                         |
| 編集者権限             | フロー編集・作成のみ（削除・メンバー操作は不可）                                                             |

## 非目標

- ワークスペース階層（users > workspaces > projects > flows）の導入
- 3 階層以上のロール（ビューア / ゲスト 等）
- 複数オーナー / オーナーシップ移譲
- 組織単位の課金 / SSO
- 招待リンクの有効期限 / `revoked_at` による監査履歴付き無効化 / 招待コードによる本人認証
- リアルタイム同時編集のコンフリクト通知

## データモデル

### 新規マイグレーション: `migrations/0010_project_members.sql`

```sql
CREATE TABLE project_members (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'editor',
  joined_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- プロジェクトに招待リンク用トークン追加（share_token と同じパターン）
ALTER TABLE projects ADD COLUMN invite_token TEXT;
CREATE UNIQUE INDEX idx_projects_invite_token ON projects(invite_token);
```

- `project_members`: 複合主キーで「同じユーザーが同じプロジェクトに 2 回」を防止
- オーナーは `project_members` に入れない。`projects.user_id` が唯一のオーナー記録
- `role` は将来拡張のために残すが、現状は `'editor'` 固定
- `invite_token`: プロジェクト作成時は NULL、「招待リンク生成」で初めて UUID 発行
- カスケード: プロジェクト削除 → メンバー全員消える / ユーザー削除 → そのユーザーのメンバーシップ消える

## 権限判定

### `api/lib/project-access.ts`（新規）

```ts
export type ProjectRole = 'owner' | 'editor' | null

export async function getProjectRole(
  db: D1Database,
  projectId: string,
  userId: string,
): Promise<ProjectRole> {
  const project = await db
    .prepare('SELECT user_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ user_id: string }>()
  if (!project) return null
  if (project.user_id === userId) return 'owner'

  const member = await db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .bind(projectId, userId)
    .first<{ role: string }>()
  return member ? 'editor' : null
}

export async function canAccessFlow(
  db: D1Database,
  flowId: string,
  userId: string,
): Promise<{ canEdit: boolean; canDelete: boolean }> {
  const flow = await db
    .prepare('SELECT user_id, project_id FROM flows WHERE id = ? AND deleted_at IS NULL')
    .bind(flowId)
    .first<{ user_id: string; project_id: string | null }>()
  if (!flow) return { canEdit: false, canDelete: false }

  if (flow.user_id === userId) return { canEdit: true, canDelete: true }

  if (flow.project_id) {
    const role = await getProjectRole(db, flow.project_id, userId)
    if (role === 'owner') return { canEdit: true, canDelete: true }
    if (role === 'editor') return { canEdit: true, canDelete: false }
  }
  return { canEdit: false, canDelete: false }
}
```

### 既存 `checkFlowOwnership` の置き換え

`api/routes/flows.ts:55-63` の `checkFlowOwnership` は厳格オーナーチェック。以下の操作別に分岐させる。

| 操作                              | 判定ルール                             | 影響ルート                                         |
| --------------------------------- | -------------------------------------- | -------------------------------------------------- |
| フロー取得・編集                  | `canAccessFlow().canEdit`              | `GET /flows/:id`, `PUT /flows/:id`                 |
| フロー削除                        | `canAccessFlow().canDelete`            | `DELETE /flows/:id`                                |
| フロー作成（`project_id` 指定時） | `getProjectRole() !== null`            | `POST /flows`                                      |
| プロジェクト移動                  | 移動先への `getProjectRole() !== null` | `PATCH /flows/:id/project`                         |
| 共有トークン操作                  | 所有者のみ（`flow.user_id === me`）    | `POST /flows/:id/share`, `DELETE /flows/:id/share` |

## API エンドポイント

すべて既存 `authMiddleware` 継承。

| Method   | Path                            | 用途                                      | 権限                 |
| -------- | ------------------------------- | ----------------------------------------- | -------------------- |
| `POST`   | `/projects/:id/invite-link`     | 招待リンク生成 or 取得（冪等）            | オーナーのみ         |
| `DELETE` | `/projects/:id/invite-link`     | 招待リンクを撤去（`invite_token = NULL`） | オーナーのみ         |
| `POST`   | `/projects/join/:token`         | 招待リンクで参加                          | ログイン済みユーザー |
| `GET`    | `/projects/:id/members`         | メンバー一覧                              | オーナー or メンバー |
| `DELETE` | `/projects/:id/members/:userId` | メンバー削除 or 退出                      | オーナー or 自分自身 |
| `GET`    | `/projects/shared`              | 自分が参加中のプロジェクト一覧            | ログイン済みユーザー |

### レスポンス形状

**`POST /projects/:id/invite-link`** (冪等):

```json
{ "inviteToken": "uuid-...", "inviteUrl": "https://.../join/uuid-..." }
```

**`POST /projects/join/:token`**:

- 成功（新規参加）: `200 { projectId, role: 'editor' }`
- 既メンバー / オーナー本人: `200 { projectId, role: 'owner'|'editor', alreadyMember: true }`
- トークン無効: `404 { error: '招待リンクが無効です', code: 'INVITE_TOKEN_INVALID' }`
- 未ログイン: `401`

**`GET /projects/:id/members`**:

```json
{
  "owner": { "id": "...", "email": "...", "name": "..." },
  "editors": [{ "id": "...", "email": "...", "name": "...", "joinedAt": "..." }]
}
```

**`DELETE /projects/:id/members/:userId`**:

- `userId === currentUser` → 自分退出
- `userId !== currentUser` → オーナーのみ可
- 成功: `204`
- オーナー自身を退出対象にした場合: `400 { error: 'オーナーは退出できません。プロジェクトを削除してください', code: 'OWNER_CANNOT_LEAVE' }`

**`GET /projects/shared`**:

```json
{
  "projects": [
    {
      "id": "...",
      "name": "...",
      "ownerName": "...",
      "joinedAt": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### 既存エンドポイントへの変更

| ルート                                      | 変更内容                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /flows`                                | フィルタを「所有 OR プロジェクト経由メンバー」に拡張: `WHERE f.user_id = ? OR f.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)` |
| `GET /flows/:id`, `PUT /flows/:id`          | `checkFlowOwnership` → `canAccessFlow().canEdit`                                                                                                          |
| `DELETE /flows/:id`                         | `canAccessFlow().canDelete`（編集者は 403）                                                                                                               |
| `POST /flows`                               | `project_id` 指定時、`getProjectRole() !== null` を確認                                                                                                   |
| `PATCH /flows/:id/project`                  | 移動先プロジェクトへの権限を確認                                                                                                                          |
| `GET /projects`                             | 自分が**オーナー**のプロジェクトのみ（現状通り）                                                                                                          |
| `PUT /projects/:id`, `DELETE /projects/:id` | オーナーのみ（既存通り）                                                                                                                                  |

### エラーコード

| 状況                                      | HTTP | `code`                  |
| ----------------------------------------- | ---- | ----------------------- |
| 招待リンクのトークン不存在・不正          | 404  | `INVITE_TOKEN_INVALID`  |
| 非オーナーが招待リンク操作 / メンバー削除 | 403  | `PROJECT_ACCESS_DENIED` |
| オーナーが自分を退出しようとした          | 400  | `OWNER_CANNOT_LEAVE`    |

## UI 変更

### ダッシュボード サイドバー

`src/features/dashboard/DashboardSidebar.tsx` の自分のプロジェクト一覧の下に「共有されたプロジェクト」セクションを追加。

```
┌─────────────────┐
│ 📋 最近          │
│ 🗂  すべて        │
│ 🔗 共有          │
│ 📝 下書き         │
│ 🗑  ゴミ箱        │
├─────────────────┤
│ マイプロジェクト   │
│  ├─ 🗂 企画A      │
│  ├─ 🗂 企画B      │
│  └─ + 新規作成    │
├─────────────────┤
│ 共有されたプロジェクト │
│  ├─ 🗂 企画C (田中) │
│  └─ 🗂 企画D (山田) │
└─────────────────┘
```

- データ取得: `GET /projects` + `GET /projects/shared` を並行呼び出し
- プロジェクト名に `(オーナー名)` をグレー文字で併記

### プロジェクトアクションバー

Dashboard のフロー一覧上部、プロジェクト選択時のみ表示。

**オーナー時**:

```
🗂 企画A             [⚙ 設定] [👥 メンバー]
```

**編集者時**:

```
🗂 企画C (田中)      [👥 メンバー] [🚪 退出]
```

- `[⚙ 設定]`: 既存のプロジェクト編集（名前変更・削除）
- `[👥 メンバー]`: メンバー管理モーダル
- `[🚪 退出]`: 編集者のみ。確認ダイアログ → `DELETE /projects/:id/members/<me>`

### メンバー管理モーダル（オーナー時）

```
┌────────────────────────────┐
│ メンバー                    │
├────────────────────────────┤
│ 招待リンク                   │
│ [https://.../join/abc...]  │
│ [コピー] [取り消し]            │
│                             │
│ [🔗 招待リンクを生成]         │   ← 未生成時のみ
├────────────────────────────┤
│ 現在のメンバー               │
│                             │
│ 👑 田中太郎（あなた）          │
│ ✏️ 山田花子 [削除]            │
│ ✏️ 佐藤次郎 [削除]            │
└────────────────────────────┘
```

- 未生成時: 「🔗 招待リンクを生成」ボタンのみ → `POST /invite-link`
- 生成済み時: URL 表示 + コピー + 取り消し
- 「取り消し」は確認ダイアログ → `DELETE /invite-link`（メンバー自体は残る）
- 「削除」は確認ダイアログ → `DELETE /members/:userId`

### メンバー管理モーダル（編集者時）

招待リンクセクション非表示、削除ボタン非表示。メンバー一覧の閲覧のみ。

### 招待リンク到着ページ: `/join/:token`

ログイン状態別の挙動：

| 状態                         | 挙動                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- |
| 未ログイン（アカウントあり） | AuthModal（login モード）を表示、ログイン後に参加処理継続               |
| 未ログイン（未登録）         | 「β 招待コードで登録してから来てください」エラー画面 + landing への誘導 |
| ログイン済 / 未参加          | `POST /join/:token` → 成功時プロジェクトへ遷移                          |
| ログイン済 / 既参加          | そのままプロジェクトへ遷移（`alreadyMember: true`）                     |
| トークン無効                 | 404 画面「招待リンクが無効です」                                        |

### i18n

`src/locales/{ja,en}/project.json` 新規（or `dashboard.json` 拡張）。主要キー:

- `sharedProjects.title` / `sharedProjects.ownerLabel`（オーナー名前置）
- `memberManagement.title` / `memberManagement.inviteLink.*` / `memberManagement.removeMember` / `memberManagement.removeConfirm`
- `inviteLink.generate` / `inviteLink.copy` / `inviteLink.revoke` / `inviteLink.copySuccess`
- `leave.button` / `leave.confirm`
- `joinPage.success` / `joinPage.alreadyMember` / `joinPage.tokenInvalid` / `joinPage.requireBetaInvite`
- `roles.owner` / `roles.editor`

## エッジケース

### アクセス権

- 編集者が作成したフローの `user_id` は編集者本人。プロジェクト削除で `flows.project_id ON DELETE SET NULL` により所属解除されるが、フロー自体は編集者が引き続き所有（既存挙動踏襲）
- 編集者が他人のフロー（オーナー作成）を編集中にキックされた → 次回 `PUT` で 403。編集中のリアルタイム通知は非対応（β 許容）
- 編集者が自分の個人フローをプロジェクトに移動 → 移動後はメンバー全員に編集権。`user_id` は編集者のまま
- 編集者退出後、自分作成フロー（`user_id=自分`）は引き続きアクセス可、オーナー作成フローは以後アクセス不可

### 招待リンク

- オーナー本人が招待リンクを踏む → `alreadyMember: true` で成功扱い
- 他プロジェクトのオーナーが招待リンクを踏む → 新規メンバーとして追加（`project_members` に insert される。オーナー = `projects.user_id` との区別は保たれる）
- 招待リンク取り消し → メンバー自体は残る（追加招待のみ停止）
- 取り消し後に再生成 → 新トークン発行（旧トークンは無効）

### 同時操作

- オーナーのメンバー削除と当該メンバーの書き込みが並行 → 次回リクエストで 403
- 2 人の編集者が同一フローを同時編集 → 既存オートセーブの後書き優先（β 許容）

### カスケード削除

- プロジェクトオーナーのアカウント削除 → `projects CASCADE` → `project_members CASCADE` → プロジェクト内フローは既存挙動で削除
- 編集者メンバーのアカウント削除 → `project_members CASCADE` のみ。プロジェクトとフローは影響なし

## セキュリティ

- 招待トークン: `crypto.randomUUID()` を使用（推測困難）。`share_token` と同等の扱い
- トークン照合: `invite_token IS NOT NULL AND invite_token = ?` のパラメータ化クエリ。NULL の `invite_token` に対するマッチングを防ぐ
- 権限チェックはすべてサーバー側。UI の権限表示はあくまで導線制御で、バックエンドが判定の最終権威
- `PROJECT_ACCESS_DENIED` / `OWNER_CANNOT_LEAVE` / `INVITE_TOKEN_INVALID` の 3 エラーコードで情報漏洩を最小化（存在・非存在を区別しない必要が出たら将来検討）

## テスト戦略（TDD）

### 単体テスト: `api/lib/project-access.test.ts`（新規）

- `getProjectRole`: owner / editor / 非メンバー / 存在しないプロジェクト
- `canAccessFlow`: 所有者 / 編集者（削除不可）/ 非メンバー / ソフト削除済フロー / プロジェクト無所属フロー

### API 統合テスト: `tests/api/routes/projects.test.ts`（拡張）

- `POST /invite-link`: オーナー成功 / 非オーナー 403 / 冪等性
- `DELETE /invite-link`: オーナー成功 / 非オーナー 403
- `POST /join/:token`: 成功 / 無効 404 / 既メンバー alreadyMember / オーナー本人 alreadyMember / 未ログイン 401
- `GET /members`: オーナー・編集者は取得可 / 非メンバー 403 / 形状
- `DELETE /members/:userId`: オーナーがキック / メンバーが自分退出 / 非メンバー 403 / オーナー自分退出 400
- `GET /projects/shared`: 参加中のみ / オーナープロジェクトは含まれない / 退出済みは含まれない

### 既存ルートの権限拡張テスト: `tests/api/routes/flows.test.ts`（拡張）

- `GET /flows`: 編集者が他人のプロジェクト所属フローも取得できる
- `GET /flows/:id`, `PUT /flows/:id`: 編集者が編集できる / 非メンバーは 403
- `DELETE /flows/:id`: 編集者 403 / オーナー削除可
- `POST /flows` with `project_id`: 編集者も作成可 / 非メンバー 403
- `PATCH /flows/:id/project`: 編集者も移動可

### フロントエンドテスト

**`DashboardSidebar.test.tsx`**:

- `GET /projects/shared` の結果が「共有されたプロジェクト」セクションに表示
- 所有 / 共有の視覚区別（オーナー名併記）

**`Dashboard.test.tsx`**:

- 共有プロジェクト選択時、アクションバーに `🚪 退出` が表示（`⚙ 設定` は非表示）
- オーナー時は `⚙ 設定` と `👥 メンバー` が表示

**`MemberManagement.test.tsx`**（新規）:

- オーナー時: 招待リンク生成 / コピー / 取り消し + メンバー削除が動作
- 編集者時: 招待リンクセクション非表示、削除ボタン非表示
- 削除確認ダイアログキャンセルで API 呼ばれない
- 未生成時「生成」ボタン / 生成済み URL 表示

**`JoinProjectPage.test.tsx`**（新規）:

- ログイン済 + 未参加: 即参加して `/flows?project=xxx` 遷移
- ログイン済 + 既参加: そのまま遷移
- 未ログイン: AuthModal 表示 → ログイン後に参加再試行
- 未登録ユーザー: β 招待誘導エラー画面
- トークン無効: 404 画面

## 影響範囲

| ファイル                                         | 変更                                     |
| ------------------------------------------------ | ---------------------------------------- |
| `migrations/0010_project_members.sql`            | 新規                                     |
| `api/lib/project-access.ts`                      | 新規                                     |
| `api/lib/project-access.test.ts`                 | 新規                                     |
| `api/routes/projects.ts`                         | 6 エンドポイント追加                     |
| `api/routes/flows.ts`                            | `checkFlowOwnership` の用途別分岐        |
| `tests/api/routes/projects.test.ts`              | 大幅拡張                                 |
| `tests/api/routes/flows.test.ts`                 | 権限拡張ケース追加                       |
| `tests/helpers/mock-d1.ts`                       | `0010_project_members.sql` 追加          |
| `src/features/dashboard/DashboardSidebar.tsx`    | 「共有されたプロジェクト」セクション追加 |
| `src/features/dashboard/Dashboard.tsx`           | プロジェクトアクションバー追加           |
| `src/features/dashboard/MemberManagement.tsx` 他 | 新規                                     |
| `src/features/dashboard/JoinProjectPage.tsx` 他  | 新規                                     |
| `src/hooks/useAuth.tsx` / `src/App.tsx`          | `/join/:token` ルート追加                |
| `src/locales/{ja,en}/project.json`               | 新規                                     |
| `src/i18n.ts`                                    | `project` namespace 登録                 |

## リリース手順

1. マイグレーション適用（`migrations/0010_project_members.sql`）
2. バックエンド・フロントエンドをデプロイ
3. オーナーがプロジェクトで「招待リンクを生成」→ リンクを β メンバーに共有
4. 受け取った β メンバーがリンクを踏んで参加 → プロジェクト編集開始
