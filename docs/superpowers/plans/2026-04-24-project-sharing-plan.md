# プロジェクト共同編集機能（共有プロジェクト） — 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロジェクトを単位とした 2 階層（オーナー / 編集者）の共同編集機能を実装する。招待リンクで既存 β ユーザーを編集者として追加できる。

**Architecture:** `project_members` テーブル新設 + `projects.invite_token` 追加。`api/lib/project-access.ts` に権限判定ヘルパー（`getProjectRole`, `canAccessFlow`）を配置。既存 `checkFlowOwnership` は用途別（編集権 / 削除権 / オーナー専用）に置き換え。フロントはサイドバーに「共有されたプロジェクト」セクションを分離、メンバー管理モーダルと `/join/:token` ページを新設。

**Tech Stack:** Cloudflare D1 (SQLite) / Hono / React Router v6 / TypeScript / Vitest

**Spec:** `docs/superpowers/specs/2026-04-24-project-sharing-design.md`

**Issue:** #306
**Branch:** `feat/project-sharing-306`

---

## File Structure

**新規作成:**

- `migrations/0010_project_members.sql` — テーブル + ALTER + インデックス
- `api/lib/project-access.ts` — `ProjectRole`, `getProjectRole`, `canAccessFlow`
- `api/lib/project-access.test.ts`
- `src/features/dashboard/MemberManagementModal.tsx` — メンバー一覧 + 招待リンク生成/コピー + 削除ボタン
- `src/features/dashboard/MemberManagementModal.module.css`
- `src/features/dashboard/MemberManagementModal.test.tsx`
- `src/features/dashboard/ProjectActionBar.tsx` — プロジェクト選択時のツールバー（設定 / メンバー / 退出）
- `src/features/dashboard/ProjectActionBar.module.css`
- `src/features/dashboard/ProjectActionBar.test.tsx`
- `src/features/dashboard/SharedProjectList.tsx` — サイドバーの「共有されたプロジェクト」セクション
- `src/features/projects/JoinProjectPage.tsx` — `/join/:token` ルートのページ
- `src/features/projects/JoinProjectPage.module.css`
- `src/features/projects/JoinProjectPage.test.tsx`
- `src/locales/ja/project.json` — メンバー管理・招待リンク・退出・参加ページ用
- `src/locales/en/project.json` — 同上

**変更:**

- `api/routes/projects.ts` — 6 エンドポイント追加
- `api/routes/flows.ts` — `checkFlowOwnership` を用途別に置き換え
- `api/lib/flow-transform.ts` — `ProjectRow` に `invite_token` 追加、`toProject` は `inviteToken` を返すかどうか用途で分岐（内部用と公開用を分離）
- `tests/api/routes/projects.test.ts` — 大幅拡張
- `tests/api/routes/flows.test.ts` — 権限拡張ケース追加
- `tests/helpers/mock-d1.ts` — `0010_project_members.sql` 追加
- `src/features/dashboard/DashboardSidebar.tsx` — SharedProjectList を埋め込み
- `src/features/dashboard/DashboardSidebar.test.tsx`
- `src/features/dashboard/Dashboard.tsx` — プロジェクト選択時に ProjectActionBar を表示
- `src/features/dashboard/Dashboard.test.tsx`
- `src/App.tsx` — `/join/:token` ルート追加
- `src/i18n.ts` — `project` namespace 登録

---

## Task 1: マイグレーションとモック D1 の更新

**Files:**

- Create: `migrations/0010_project_members.sql`
- Modify: `tests/helpers/mock-d1.ts`
- Modify: `tests/db/migration.test.ts`

- [ ] **Step 1: 失敗テストを追加（Red）**

`tests/db/migration.test.ts` に以下を追加:

```ts
it('should create project_members table and projects.invite_token column (0010)', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const files = [
    '0001_initial.sql',
    '0002_node_arrow_styles.sql',
    '0003_user_settings.sql',
    '0004_email_verification.sql',
    '0005_soft_delete.sql',
    '0006_ai_admin.sql',
    '0007_node_shape.sql',
    '0008_projects.sql',
    '0009_invitation_codes.sql',
    '0010_project_members.sql',
  ]
  for (const f of files) {
    const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
    for (const stmt of sql.split(';').filter((s) => s.trim())) {
      db.exec(stmt + ';')
    }
  }
  const memberCols = db.prepare('PRAGMA table_info(project_members)').all() as Array<{
    name: string
  }>
  expect(memberCols.map((c) => c.name).sort()).toEqual([
    'joined_at',
    'project_id',
    'role',
    'user_id',
  ])
  const projectCols = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
  expect(projectCols.map((c) => c.name)).toContain('invite_token')
  db.close()
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/db/migration.test.ts`
Expected: FAIL (`0010_project_members.sql` が存在しない)

- [ ] **Step 3: マイグレーション作成**

`migrations/0010_project_members.sql`:

```sql
CREATE TABLE project_members (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'editor',
  joined_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);

ALTER TABLE projects ADD COLUMN invite_token TEXT;
CREATE UNIQUE INDEX idx_projects_invite_token ON projects(invite_token);
```

- [ ] **Step 4: `mock-d1.ts` のマイグレーション配列に追加**

`tests/helpers/mock-d1.ts` の `migrationFiles` 配列に `'0010_project_members.sql'` を末尾追加。

- [ ] **Step 5: Green 確認**

Run: `npx vitest run tests/db/migration.test.ts`
Expected: PASS

- [ ] **Step 6: 全テスト実行**

Run: `npm test`
Expected: 既存も含めて全 PASS

- [ ] **Step 7: コミット**

```bash
git add migrations/0010_project_members.sql tests/helpers/mock-d1.ts tests/db/migration.test.ts
git commit -m "feat(#306): add project_members table and projects.invite_token"
```

---

## Task 2: `project-access` lib を実装する

**Files:**

- Create: `api/lib/project-access.ts`
- Create: `api/lib/project-access.test.ts`

- [ ] **Step 1: テストを書く（Red）**

`api/lib/project-access.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../tests/helpers/mock-d1'
import { getProjectRole, canAccessFlow } from './project-access'

describe('getProjectRole', () => {
  let db: ReturnType<typeof Database>
  let d1: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createTestDb()
    d1 = createMockD1(db)
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES
       ('owner-1', 'owner@example.com', 'h', 'Owner'),
       ('editor-1', 'editor@example.com', 'h', 'Editor'),
       ('stranger-1', 'stranger@example.com', 'h', 'Stranger')`,
    ).run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('proj-1', 'owner-1', 'P1')`).run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('proj-1', 'editor-1', 'editor')`,
    ).run()
  })
  afterEach(() => db.close())

  it('returns "owner" for the project owner', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'owner-1')).toBe('owner')
  })
  it('returns "editor" for an added member', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'editor-1')).toBe('editor')
  })
  it('returns null for non-members', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'stranger-1')).toBeNull()
  })
  it('returns null for non-existent project', async () => {
    expect(await getProjectRole(d1, 'proj-none', 'owner-1')).toBeNull()
  })
})

describe('canAccessFlow', () => {
  let db: ReturnType<typeof Database>
  let d1: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createTestDb()
    d1 = createMockD1(db)
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES
       ('owner-1', 'owner@example.com', 'h', 'Owner'),
       ('editor-1', 'editor@example.com', 'h', 'Editor'),
       ('stranger-1', 'stranger@example.com', 'h', 'Stranger')`,
    ).run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('proj-1', 'owner-1', 'P1')`).run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('proj-1', 'editor-1', 'editor')`,
    ).run()
    // flow in project, owned by owner-1
    db.prepare(
      `INSERT INTO flows (id, user_id, title, project_id) VALUES ('flow-1', 'owner-1', 'F1', 'proj-1')`,
    ).run()
    // flow not in any project
    db.prepare(`INSERT INTO flows (id, user_id, title) VALUES ('flow-2', 'owner-1', 'F2')`).run()
    // soft-deleted flow
    db.prepare(
      `INSERT INTO flows (id, user_id, title, project_id, deleted_at) VALUES ('flow-3', 'owner-1', 'F3', 'proj-1', '2026-01-01T00:00:00Z')`,
    ).run()
  })
  afterEach(() => db.close())

  it('grants full access to the flow owner', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'owner-1')).toEqual({ canEdit: true, canDelete: true })
  })
  it('grants edit access but not delete access to project editors', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'editor-1')).toEqual({
      canEdit: true,
      canDelete: false,
    })
  })
  it('denies access to strangers', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'stranger-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
  it('treats flows without project_id as owner-only', async () => {
    expect(await canAccessFlow(d1, 'flow-2', 'editor-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
    expect(await canAccessFlow(d1, 'flow-2', 'owner-1')).toEqual({ canEdit: true, canDelete: true })
  })
  it('treats soft-deleted flows as not accessible', async () => {
    expect(await canAccessFlow(d1, 'flow-3', 'owner-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
    expect(await canAccessFlow(d1, 'flow-3', 'editor-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
  it('returns no access for non-existent flow', async () => {
    expect(await canAccessFlow(d1, 'flow-none', 'owner-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run api/lib/project-access.test.ts`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: 実装**

`api/lib/project-access.ts`:

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

- [ ] **Step 4: Green 確認**

Run: `npx vitest run api/lib/project-access.test.ts`
Expected: PASS（10 テスト）

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: コミット**

```bash
git add api/lib/project-access.ts api/lib/project-access.test.ts
git commit -m "feat(#306): add project-access lib (getProjectRole, canAccessFlow)"
```

---

## Task 3: 招待リンクエンドポイント（POST / DELETE `/projects/:id/invite-link`）

**Files:**

- Modify: `api/routes/projects.ts`
- Modify: `tests/api/routes/projects.test.ts`

- [ ] **Step 1: テストを追加（Red）**

既存 `tests/api/routes/projects.test.ts` の末尾付近（既存 describe ブロックの後）に追加。テストハーネス（db / env / userCookie / USER_ID 等）の既存パターンに合わせる:

```ts
describe('POST /api/projects/:id/invite-link', () => {
  it('generates and returns a new invite token for the owner', async () => {
    // seed: owner's project
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'My Project')`)
      .bind(USER_ID)
      .run()

    const res = await app.request(
      '/api/projects/p-1/invite-link',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { inviteToken: string; inviteUrl: string }
    expect(body.inviteToken).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.inviteUrl).toContain('/join/')
    const row = db.prepare('SELECT invite_token FROM projects WHERE id = ?').get('p-1') as {
      invite_token: string
    }
    expect(row.invite_token).toBe(body.inviteToken)
  })
  it('is idempotent — second call returns the same token', async () => {
    db.prepare(
      `INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'existing-token')`,
    )
      .bind(USER_ID)
      .run()
    const res = await app.request(
      '/api/projects/p-1/invite-link',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { inviteToken: string }
    expect(body.inviteToken).toBe('existing-token')
  })
  it('returns 403 when non-owner tries to generate', async () => {
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', 'other-user', 'P')`).run()
    const res = await app.request(
      '/api/projects/p-1/invite-link',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(403)
  })
  it('returns 404 for non-existent project', async () => {
    const res = await app.request(
      '/api/projects/nope/invite-link',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/:id/invite-link', () => {
  it('clears the invite token for the owner', async () => {
    db.prepare(
      `INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'tok')`,
    )
      .bind(USER_ID)
      .run()
    const res = await app.request(
      '/api/projects/p-1/invite-link',
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(204)
    const row = db.prepare('SELECT invite_token FROM projects WHERE id = ?').get('p-1') as {
      invite_token: string | null
    }
    expect(row.invite_token).toBeNull()
  })
  it('returns 403 when non-owner tries to delete', async () => {
    db.prepare(
      `INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', 'other', 'P', 'tok')`,
    ).run()
    const res = await app.request(
      '/api/projects/p-1/invite-link',
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`api/routes/projects.ts` の末尾（`export default projects` の直前）に追加:

```ts
import { generateId } from '../lib/id'

// POST /:id/invite-link
projects.post('/:id/invite-link', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')

  const project = await db
    .prepare('SELECT user_id, invite_token FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ user_id: string; invite_token: string | null }>()
  if (!project) return c.json({ error: 'プロジェクトが見つかりません' }, 404)
  if (project.user_id !== userId) {
    return c.json({ error: 'アクセス権限がありません', code: 'PROJECT_ACCESS_DENIED' }, 403)
  }

  let token = project.invite_token
  if (!token) {
    token = generateId()
    await db
      .prepare('UPDATE projects SET invite_token = ? WHERE id = ?')
      .bind(token, projectId)
      .run()
  }

  const origin = new URL(c.req.url).origin
  return c.json({ inviteToken: token, inviteUrl: `${origin}/join/${token}` })
})

// DELETE /:id/invite-link
projects.delete('/:id/invite-link', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')

  const project = await db
    .prepare('SELECT user_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ user_id: string }>()
  if (!project) return c.json({ error: 'プロジェクトが見つかりません' }, 404)
  if (project.user_id !== userId) {
    return c.json({ error: 'アクセス権限がありません', code: 'PROJECT_ACCESS_DENIED' }, 403)
  }

  await db.prepare('UPDATE projects SET invite_token = NULL WHERE id = ?').bind(projectId).run()
  return c.body(null, 204)
})
```

- [ ] **Step 4: Green 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/routes/projects.ts tests/api/routes/projects.test.ts
git commit -m "feat(#306): add invite-link generate/delete endpoints"
```

---

## Task 4: `POST /projects/join/:token`（参加）

**Files:**

- Modify: `api/routes/projects.ts`
- Modify: `tests/api/routes/projects.test.ts`

- [ ] **Step 1: テストを追加（Red）**

```ts
describe('POST /api/projects/join/:token', () => {
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(() => {
    // seed another user who will be the project owner
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'h', 'Other')`)
      .bind(OTHER_USER_ID, OTHER_EMAIL)
      .run()
    db.prepare(
      `INSERT INTO projects (id, user_id, name, invite_token) VALUES ('p-1', ?, 'P', 'tok-abc')`,
    )
      .bind(OTHER_USER_ID)
      .run()
  })

  it('adds the current user as an editor and returns 200', async () => {
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { projectId: string; role: string; alreadyMember?: boolean }
    expect(body.projectId).toBe('p-1')
    expect(body.role).toBe('editor')
    expect(body.alreadyMember).toBeFalsy()
    const member = db
      .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get('p-1', USER_ID) as { role: string } | undefined
    expect(member?.role).toBe('editor')
  })

  it('returns alreadyMember for owner visiting own invite', async () => {
    const ownerCookie = await authCookie(OTHER_USER_ID, OTHER_EMAIL)
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { role: string; alreadyMember?: boolean }
    expect(body.role).toBe('owner')
    expect(body.alreadyMember).toBe(true)
  })

  it('returns alreadyMember when an existing editor joins again', async () => {
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
    const res = await app.request(
      '/api/projects/join/tok-abc',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { role: string; alreadyMember?: boolean }
    expect(body.role).toBe('editor')
    expect(body.alreadyMember).toBe(true)
  })

  it('returns 404 INVITE_TOKEN_INVALID for unknown token', async () => {
    const res = await app.request(
      '/api/projects/join/nonexistent',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('INVITE_TOKEN_INVALID')
  })

  it('returns 401 when not authenticated', async () => {
    const res = await app.request('/api/projects/join/tok-abc', { method: 'POST' }, env)
    expect(res.status).toBe(401)
  })

  it('rejects NULL invite_token lookups (no accidental match)', async () => {
    db.prepare(`UPDATE projects SET invite_token = NULL WHERE id = 'p-1'`).run()
    const res = await app.request(
      '/api/projects/join/',
      { method: 'POST', headers: { Cookie: userCookie } },
      env,
    )
    // empty token path — router treats as not found
    expect([404, 400]).toContain(res.status)
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`api/routes/projects.ts` に追加:

```ts
// POST /join/:token
projects.post('/join/:token', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const token = c.req.param('token')

  if (!token) {
    return c.json({ error: '招待リンクが無効です', code: 'INVITE_TOKEN_INVALID' }, 404)
  }

  // Parameterized lookup; NULL invite_token rows cannot match a bound value
  const project = await db
    .prepare('SELECT id, user_id FROM projects WHERE invite_token IS NOT NULL AND invite_token = ?')
    .bind(token)
    .first<{ id: string; user_id: string }>()
  if (!project) {
    return c.json({ error: '招待リンクが無効です', code: 'INVITE_TOKEN_INVALID' }, 404)
  }

  // Owner visiting their own link
  if (project.user_id === userId) {
    return c.json({ projectId: project.id, role: 'owner', alreadyMember: true })
  }

  const existing = await db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .bind(project.id, userId)
    .first<{ role: string }>()
  if (existing) {
    return c.json({ projectId: project.id, role: existing.role, alreadyMember: true })
  }

  await db
    .prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
    .bind(project.id, userId, 'editor')
    .run()

  return c.json({ projectId: project.id, role: 'editor' })
})
```

- [ ] **Step 4: Green 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/routes/projects.ts tests/api/routes/projects.test.ts
git commit -m "feat(#306): add POST /projects/join/:token endpoint"
```

---

## Task 5: メンバー一覧・削除エンドポイント

**Files:**

- Modify: `api/routes/projects.ts`
- Modify: `tests/api/routes/projects.test.ts`

- [ ] **Step 1: テストを追加（Red）**

```ts
describe('GET /api/projects/:id/members', () => {
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(() => {
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'h', 'Other')`)
      .bind(OTHER_USER_ID, OTHER_EMAIL)
      .run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`)
      .bind(OTHER_USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
  })

  it('returns owner + editors for a member', async () => {
    const res = await app.request(
      '/api/projects/p-1/members',
      { headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      owner: { id: string; email: string; name: string }
      editors: Array<{ id: string; email: string; name: string }>
    }
    expect(body.owner.id).toBe(OTHER_USER_ID)
    expect(body.editors).toHaveLength(1)
    expect(body.editors[0].id).toBe(USER_ID)
  })

  it('returns 403 for non-members', async () => {
    db.prepare(`DELETE FROM project_members WHERE project_id = 'p-1' AND user_id = ?`)
      .bind(USER_ID)
      .run()
    const res = await app.request(
      '/api/projects/p-1/members',
      { headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/projects/:id/members/:userId', () => {
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(() => {
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'h', 'Other')`)
      .bind(OTHER_USER_ID, OTHER_EMAIL)
      .run()
  })

  it('allows owner to kick an editor', async () => {
    // current user is owner
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`)
      .bind(USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    )
      .bind(OTHER_USER_ID)
      .run()
    const res = await app.request(
      `/api/projects/p-1/members/${OTHER_USER_ID}`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(204)
    const row = db
      .prepare(`SELECT * FROM project_members WHERE project_id = 'p-1' AND user_id = ?`)
      .get(OTHER_USER_ID)
    expect(row).toBeUndefined()
  })

  it('allows editor to leave voluntarily (remove self)', async () => {
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`)
      .bind(OTHER_USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
    const res = await app.request(
      `/api/projects/p-1/members/${USER_ID}`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(204)
  })

  it('returns 403 when non-owner tries to kick someone else', async () => {
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`)
      .bind(OTHER_USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES ('third', 'third@x.com', 'h', 'T')`,
    ).run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-1', 'third', 'editor')`,
    ).run()
    const res = await app.request(
      `/api/projects/p-1/members/third`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 OWNER_CANNOT_LEAVE when owner tries to remove self', async () => {
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-1', ?, 'P')`)
      .bind(USER_ID)
      .run()
    const res = await app.request(
      `/api/projects/p-1/members/${USER_ID}`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('OWNER_CANNOT_LEAVE')
  })

  it('returns 404 for non-existent project', async () => {
    const res = await app.request(
      `/api/projects/nope/members/${USER_ID}`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`api/routes/projects.ts` に追加:

```ts
import { getProjectRole } from '../lib/project-access'

// GET /:id/members
projects.get('/:id/members', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')

  const project = await db
    .prepare('SELECT user_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ user_id: string }>()
  if (!project) return c.json({ error: 'プロジェクトが見つかりません' }, 404)

  const role = await getProjectRole(db, projectId, userId)
  if (role === null) {
    return c.json({ error: 'アクセス権限がありません', code: 'PROJECT_ACCESS_DENIED' }, 403)
  }

  const owner = await db
    .prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(project.user_id)
    .first<{ id: string; email: string; name: string }>()

  const editorsResult = await db
    .prepare(
      `SELECT u.id, u.email, u.name, pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.joined_at ASC`,
    )
    .bind(projectId)
    .all<{ id: string; email: string; name: string; joined_at: string }>()

  const editors = (editorsResult.results ?? []).map((e) => ({
    id: e.id,
    email: e.email,
    name: e.name,
    joinedAt: e.joined_at,
  }))

  return c.json({ owner, editors })
})

// DELETE /:id/members/:userId
projects.delete('/:id/members/:userId', async (c) => {
  const currentUserId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')
  const targetUserId = c.req.param('userId')

  const project = await db
    .prepare('SELECT user_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ user_id: string }>()
  if (!project) return c.json({ error: 'プロジェクトが見つかりません' }, 404)

  // Owner trying to remove self
  if (project.user_id === currentUserId && targetUserId === currentUserId) {
    return c.json(
      {
        error: 'オーナーは退出できません。プロジェクトを削除してください',
        code: 'OWNER_CANNOT_LEAVE',
      },
      400,
    )
  }

  // Non-owner can only remove self
  if (project.user_id !== currentUserId && targetUserId !== currentUserId) {
    return c.json({ error: 'アクセス権限がありません', code: 'PROJECT_ACCESS_DENIED' }, 403)
  }

  await db
    .prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .bind(projectId, targetUserId)
    .run()

  return c.body(null, 204)
})
```

- [ ] **Step 4: Green 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/routes/projects.ts tests/api/routes/projects.test.ts
git commit -m "feat(#306): add GET members + DELETE members endpoints"
```

---

## Task 6: `GET /projects/shared`

**Files:**

- Modify: `api/routes/projects.ts`
- Modify: `tests/api/routes/projects.test.ts`

- [ ] **Step 1: テストを追加（Red）**

```ts
describe('GET /api/projects/shared', () => {
  const OTHER_USER_ID = 'other-user-1'
  const OTHER_EMAIL = 'other@example.com'

  beforeEach(() => {
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'h', 'Other')`)
      .bind(OTHER_USER_ID, OTHER_EMAIL)
      .run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-own', ?, 'Mine')`)
      .bind(USER_ID)
      .run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-shared-1', ?, 'Shared1')`)
      .bind(OTHER_USER_ID)
      .run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('p-shared-2', ?, 'Shared2')`)
      .bind(OTHER_USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-shared-1', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('p-shared-2', ?, 'editor')`,
    )
      .bind(USER_ID)
      .run()
  })

  it('returns only projects where current user is a member (excludes owned projects)', async () => {
    const res = await app.request('/api/projects/shared', { headers: { Cookie: userCookie } }, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      projects: Array<{ id: string; name: string; ownerName: string; joinedAt: string }>
    }
    expect(body.projects).toHaveLength(2)
    expect(body.projects.map((p) => p.id).sort()).toEqual(['p-shared-1', 'p-shared-2'])
    expect(body.projects[0].ownerName).toBe('Other')
    expect(body.projects.every((p) => p.joinedAt)).toBe(true)
    // owned project excluded
    expect(body.projects.some((p) => p.id === 'p-own')).toBe(false)
  })

  it('returns empty list when user has not joined any project', async () => {
    db.prepare(`DELETE FROM project_members WHERE user_id = ?`).bind(USER_ID).run()
    const res = await app.request('/api/projects/shared', { headers: { Cookie: userCookie } }, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { projects: unknown[] }
    expect(body.projects).toEqual([])
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`api/routes/projects.ts` に追加:

```ts
// GET /shared - projects where current user is an editor member
projects.get('/shared', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const result = await db
    .prepare(
      `SELECT p.id, p.name, p.user_id, p.created_at, p.updated_at,
              pm.joined_at, u.name AS owner_name
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = p.user_id
       WHERE pm.user_id = ?
       ORDER BY pm.joined_at DESC`,
    )
    .bind(userId)
    .all<{
      id: string
      name: string
      user_id: string
      created_at: string
      updated_at: string
      joined_at: string
      owner_name: string
    }>()

  const list = (result.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ownerName: r.owner_name,
    joinedAt: r.joined_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return c.json({ projects: list })
})
```

**重要な route 順序の注意**: Hono のルーター優先順位で `/shared` を `/:id` よりも **先に宣言する** こと。`projects.get('/:id/...')` の後に `/shared` を置くと、`/:id` にマッチして `id="shared"` で 404 になる恐れがある。現在 `projects.get('/')` と `projects.get('/:id/...')` 群の中間に置くのが安全。

- [ ] **Step 4: Green 確認**

Run: `npx vitest run tests/api/routes/projects.test.ts`
Expected: PASS

- [ ] **Step 5: 全テスト**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add api/routes/projects.ts tests/api/routes/projects.test.ts
git commit -m "feat(#306): add GET /projects/shared endpoint"
```

---

## Task 7: 既存 `/flows` ルートの権限拡張

**Files:**

- Modify: `api/routes/flows.ts`
- Modify: `tests/api/routes/flows.test.ts`

- [ ] **Step 1: テストを追加（Red）— 編集者として他人のフローを編集できる**

`tests/api/routes/flows.test.ts` に共有ケース専用 describe ブロックを追加:

```ts
describe('Flow access via project membership', () => {
  const OWNER_ID = 'other-owner'
  const OWNER_EMAIL = 'other@example.com'
  const FLOW_ID = 'shared-flow-1'
  const PROJECT_ID = 'shared-proj-1'

  beforeEach(() => {
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'h', 'Owner')`)
      .bind(OWNER_ID, OWNER_EMAIL)
      .run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES (?, ?, 'Shared P')`)
      .bind(PROJECT_ID, OWNER_ID)
      .run()
    db.prepare(`INSERT INTO flows (id, user_id, title, project_id) VALUES (?, ?, 'Shared Flow', ?)`)
      .bind(FLOW_ID, OWNER_ID, PROJECT_ID)
      .run()
    // current user becomes editor
    db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'editor')`)
      .bind(PROJECT_ID, USER_ID)
      .run()
  })

  it('GET /flows/:id — editor can view shared flow', async () => {
    const res = await app.request(`/api/flows/${FLOW_ID}`, { headers: { Cookie: userCookie } }, env)
    expect(res.status).toBe(200)
  })

  it('PUT /flows/:id — editor can update shared flow', async () => {
    const res = await app.request(
      `/api/flows/${FLOW_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: JSON.stringify({ title: 'Updated by Editor' }),
      },
      env,
    )
    expect(res.status).toBe(200)
    const row = db.prepare('SELECT title FROM flows WHERE id = ?').get(FLOW_ID) as { title: string }
    expect(row.title).toBe('Updated by Editor')
  })

  it('DELETE /flows/:id — editor CANNOT delete shared flow', async () => {
    const res = await app.request(
      `/api/flows/${FLOW_ID}`,
      { method: 'DELETE', headers: { Cookie: userCookie } },
      env,
    )
    expect(res.status).toBe(403)
  })

  it('DELETE /flows/:id — owner CAN delete', async () => {
    const ownerCookie = await authCookie(OWNER_ID, OWNER_EMAIL)
    const res = await app.request(
      `/api/flows/${FLOW_ID}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    )
    expect(res.status).toBe(200)
  })

  it('GET /flows — editor sees shared flows alongside own flows', async () => {
    // also seed a flow owned by current user
    db.prepare(`INSERT INTO flows (id, user_id, title) VALUES ('own-flow', ?, 'Mine')`)
      .bind(USER_ID)
      .run()
    const res = await app.request('/api/flows', { headers: { Cookie: userCookie } }, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { flows: Array<{ id: string }> }
    const ids = body.flows.map((f) => f.id)
    expect(ids).toContain('own-flow')
    expect(ids).toContain(FLOW_ID)
  })

  it('POST /flows with project_id — editor can create flow in shared project', async () => {
    const res = await app.request(
      '/api/flows',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: JSON.stringify({ title: 'New by Editor', projectId: PROJECT_ID }),
      },
      env,
    )
    expect(res.status).toBe(201)
  })

  it('POST /flows with project_id — non-member is rejected 403', async () => {
    db.prepare(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`)
      .bind(PROJECT_ID, USER_ID)
      .run()
    const res = await app.request(
      '/api/flows',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: JSON.stringify({ title: 'New', projectId: PROJECT_ID }),
      },
      env,
    )
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: FAIL（既存コードは `user_id = ?` のみでチェック、編集者アクセスを拒否）

- [ ] **Step 3: 実装 — 既存の `checkFlowOwnership` を用途別に分岐**

`api/routes/flows.ts` の先頭付近に import を追加:

```ts
import { canAccessFlow, getProjectRole } from '../lib/project-access'
```

次に、**既存の `checkFlowOwnership` は残しつつ**、新しいヘルパー `checkFlowAccess` を追加:

```ts
async function checkFlowAccess(
  db: D1Database,
  flowId: string,
  userId: string,
  op: 'edit' | 'delete',
) {
  const flow = await db
    .prepare('SELECT id, user_id, deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ id: string; user_id: string; deleted_at: string | null }>()
  if (!flow) return { error: 'not_found' as const, deletedAt: null }
  if (flow.deleted_at) return { error: 'not_found' as const, deletedAt: flow.deleted_at }

  const access = await canAccessFlow(db, flowId, userId)
  const allowed = op === 'edit' ? access.canEdit : access.canDelete
  if (!allowed) return { error: 'forbidden' as const, deletedAt: null }
  return { error: null, deletedAt: null }
}
```

**既存の call sites を更新**（概ね `ownership = await checkFlowOwnership(...)` を `ownership = await checkFlowAccess(...)` に置き換える。op 引数は以下のルールで決定）:

| 行番号（概算） | ハンドラ                    | `op`                                             |
| -------------- | --------------------------- | ------------------------------------------------ |
| 252            | `GET /flows/:id`            | `'edit'`（閲覧=編集と同等にアクセス可かどうか）  |
| 278            | `PUT /flows/:id`            | `'edit'`                                         |
| 473            | `POST /flows/:id/share`     | owner-only — `checkFlowOwnership` のまま（後述） |
| 495            | `DELETE /flows/:id/share`   | owner-only — `checkFlowOwnership` のまま         |
| 521            | `GET /flows/:id/export`     | `'edit'`                                         |
| 552            | `DELETE /flows/:id`（soft） | `'delete'`                                       |
| 584            | `POST /flows/:id/restore`   | `'delete'`（復元は削除権の派生）                 |

実際の grep 結果で正確な call sites を確認し、**共有トークン操作（share/unshare）だけは `checkFlowOwnership` のままにする**。スペック「共有トークン操作は所有者のみ（編集者不可）」に従うため。

次に、`GET /flows` (list) のクエリを拡張。`api/routes/flows.ts:96, 119` 付近の `WHERE f.user_id = ?` を所有 OR プロジェクトメンバーシップの OR 条件に変更:

```ts
// before
// WHERE f.user_id = ?

// after
// WHERE (f.user_id = ? OR f.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?))
```

bind は両方に同じ userId を渡す。検索クエリ `q` と `projectClause` との AND 結合は既存ロジックを維持。

`POST /flows` で `projectId` が指定された場合のアクセスチェック追加:

```ts
// 既存の作成ロジックの project_id validation 直後
if (parsed.data.projectId) {
  const role = await getProjectRole(db, parsed.data.projectId, userId)
  if (role === null) {
    return c.json(
      { error: 'プロジェクトへのアクセス権限がありません', code: 'PROJECT_ACCESS_DENIED' },
      403,
    )
  }
}
```

`PATCH /flows/:id/project`（存在すれば）で移動先プロジェクトへのアクセスチェック。`projectId` が null（uncategorized 化）は常に OK、値指定時は `getProjectRole() !== null`。

- [ ] **Step 4: Green 確認**

Run: `npx vitest run tests/api/routes/flows.test.ts`
Expected: PASS（新規 + 既存すべて）

- [ ] **Step 5: 全テスト**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add api/routes/flows.ts tests/api/routes/flows.test.ts
git commit -m "feat(#306): extend flow access checks to project members"
```

---

## Task 8: i18n ファイル追加と namespace 登録

**Files:**

- Create: `src/locales/ja/project.json`
- Create: `src/locales/en/project.json`
- Modify: `src/i18n.ts`

- [ ] **Step 1: `src/locales/ja/project.json` 作成**

```json
{
  "sharedProjects": {
    "title": "共有されたプロジェクト",
    "empty": "共有されたプロジェクトはありません",
    "ownerLabel": "({{name}})"
  },
  "actionBar": {
    "settings": "設定",
    "members": "メンバー",
    "leave": "退出"
  },
  "memberManagement": {
    "title": "メンバー",
    "inviteLink": {
      "heading": "招待リンク",
      "generate": "招待リンクを生成",
      "copy": "コピー",
      "copySuccess": "コピーしました",
      "revoke": "取り消し",
      "revokeConfirm": "招待リンクを取り消しますか？既存メンバーは影響を受けません。"
    },
    "memberList": "現在のメンバー",
    "ownerBadge": "オーナー",
    "you": "あなた",
    "remove": "削除",
    "removeConfirm": "{{name}} さんを削除しますか？"
  },
  "leave": {
    "confirm": "このプロジェクトから退出しますか？"
  },
  "joinPage": {
    "title": "プロジェクトに参加",
    "joining": "参加処理中...",
    "success": "{{projectName}} に参加しました",
    "alreadyMember": "既に参加済みです",
    "tokenInvalid": "招待リンクが無効です。オーナーに再発行を依頼してください。",
    "requireBetaInvite": "このプロジェクトに参加するには、先に β 招待コードでアカウント登録が必要です。",
    "goToLanding": "トップに戻る"
  },
  "roles": {
    "owner": "オーナー",
    "editor": "編集者"
  },
  "errors": {
    "projectAccessDenied": "プロジェクトへのアクセス権限がありません",
    "ownerCannotLeave": "オーナーは退出できません。プロジェクトを削除してください",
    "inviteTokenInvalid": "招待リンクが無効です"
  }
}
```

- [ ] **Step 2: `src/locales/en/project.json` 作成**

同じキー構造で英訳:

```json
{
  "sharedProjects": {
    "title": "Shared projects",
    "empty": "No shared projects yet",
    "ownerLabel": "({{name}})"
  },
  "actionBar": {
    "settings": "Settings",
    "members": "Members",
    "leave": "Leave"
  },
  "memberManagement": {
    "title": "Members",
    "inviteLink": {
      "heading": "Invite link",
      "generate": "Generate invite link",
      "copy": "Copy",
      "copySuccess": "Copied",
      "revoke": "Revoke",
      "revokeConfirm": "Revoke the invite link? Existing members are not affected."
    },
    "memberList": "Current members",
    "ownerBadge": "Owner",
    "you": "you",
    "remove": "Remove",
    "removeConfirm": "Remove {{name}}?"
  },
  "leave": {
    "confirm": "Leave this project?"
  },
  "joinPage": {
    "title": "Join project",
    "joining": "Joining...",
    "success": "Joined {{projectName}}",
    "alreadyMember": "You're already a member",
    "tokenInvalid": "This invite link is invalid. Ask the owner to generate a new one.",
    "requireBetaInvite": "You need to register with a beta invitation code first before joining this project.",
    "goToLanding": "Back to landing"
  },
  "roles": {
    "owner": "Owner",
    "editor": "Editor"
  },
  "errors": {
    "projectAccessDenied": "You don't have access to this project",
    "ownerCannotLeave": "Owners cannot leave. Delete the project instead.",
    "inviteTokenInvalid": "Invite link is invalid"
  }
}
```

- [ ] **Step 3: namespace 登録**

`src/i18n.ts` に:

```ts
import jaProject from './locales/ja/project.json'
import enProject from './locales/en/project.json'
```

`resources.ja` と `resources.en` に `project: jaProject` / `project: enProject` を追加。

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja/project.json src/locales/en/project.json src/i18n.ts
git commit -m "feat(#306): add project i18n namespace (ja/en)"
```

---

## Task 9: サイドバーに「共有されたプロジェクト」セクション

**Files:**

- Create: `src/features/dashboard/SharedProjectList.tsx`
- Modify: `src/features/dashboard/DashboardSidebar.tsx`
- Modify: `src/features/dashboard/DashboardSidebar.test.tsx`

- [ ] **Step 1: テストを追加（Red）**

`DashboardSidebar.test.tsx` に:

```tsx
it('renders shared projects section when user has shared projects', async () => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/projects') return Promise.resolve({ projects: [] })
    if (path === '/projects/shared') {
      return Promise.resolve({
        projects: [
          {
            id: 's1',
            name: 'SharedA',
            ownerName: 'Alice',
            joinedAt: '2026-04-24T00:00:00Z',
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 's2',
            name: 'SharedB',
            ownerName: 'Bob',
            joinedAt: '2026-04-23T00:00:00Z',
            createdAt: '',
            updatedAt: '',
          },
        ],
      })
    }
    return Promise.resolve({})
  })
  render(<DashboardSidebar {...defaultProps} />)
  await waitFor(() => expect(screen.getByTestId('shared-projects-section')).toBeInTheDocument())
  expect(screen.getByText('SharedA')).toBeInTheDocument()
  expect(screen.getByText(/Alice/)).toBeInTheDocument()
})

it('hides shared projects section when list is empty', async () => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/projects') return Promise.resolve({ projects: [] })
    if (path === '/projects/shared') return Promise.resolve({ projects: [] })
    return Promise.resolve({})
  })
  render(<DashboardSidebar {...defaultProps} />)
  await waitFor(() => {
    // should render (no throws) but not show the section when empty
    expect(screen.queryByTestId('shared-projects-section')).toBeNull()
  })
})
```

（既存テストのモック構造に合わせて `mockImplementation` か `mockResolvedValue` を使い分ける。apiFetch モックのパターンは前タスクで使った `routeApiFetch` と同様か個別設定。）

- [ ] **Step 2: Red 確認**

Run: `npx vitest run src/features/dashboard/DashboardSidebar.test.tsx`
Expected: FAIL

- [ ] **Step 3: `SharedProjectList` コンポーネント実装**

`src/features/dashboard/SharedProjectList.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import styles from './DashboardSidebar.module.css'

interface SharedProject {
  id: string
  name: string
  ownerName: string
}

interface Props {
  projects: SharedProject[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
}

export function SharedProjectList({ projects, selectedProjectId, onSelect }: Props) {
  const { t } = useTranslation(['project'])
  if (projects.length === 0) return null

  return (
    <div className={styles.section} data-testid="shared-projects-section">
      <div className={styles.sectionTitle}>{t('project:sharedProjects.title')}</div>
      <ul className={styles.projectList}>
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`${styles.projectItem} ${selectedProjectId === p.id ? styles.active : ''}`}
              onClick={() => onSelect(p.id)}
              data-testid={`shared-project-${p.id}`}
            >
              <span>{p.name}</span>
              <span className={styles.ownerLabel}>
                {t('project:sharedProjects.ownerLabel', { name: p.ownerName })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: `DashboardSidebar.tsx` に組み込み**

既存の own projects フェッチの後に `/projects/shared` を並行フェッチし、own projects セクションの下に `<SharedProjectList>` を挿入。

```tsx
// 既存 state の横に
const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([])

useEffect(() => {
  void apiFetch<{ projects: SharedProject[] }>('/projects/shared').then(
    (d) => setSharedProjects(d.projects ?? []),
  ).catch(() => { /* swallow */ })
}, [])

// JSX 末尾付近に
<SharedProjectList
  projects={sharedProjects}
  selectedProjectId={currentProjectId}
  onSelect={onProjectSelect}
/>
```

CSS の `.ownerLabel` を `DashboardSidebar.module.css` に追加:

```css
.ownerLabel {
  color: #6b7280;
  font-size: 12px;
  margin-left: 6px;
}
```

- [ ] **Step 5: Green 確認**

Run: `npx vitest run src/features/dashboard/DashboardSidebar.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/features/dashboard/SharedProjectList.tsx \
        src/features/dashboard/DashboardSidebar.tsx \
        src/features/dashboard/DashboardSidebar.module.css \
        src/features/dashboard/DashboardSidebar.test.tsx
git commit -m "feat(#306): add shared projects section to dashboard sidebar"
```

---

## Task 10: メンバー管理モーダル

**Files:**

- Create: `src/features/dashboard/MemberManagementModal.tsx`
- Create: `src/features/dashboard/MemberManagementModal.module.css`
- Create: `src/features/dashboard/MemberManagementModal.test.tsx`

- [ ] **Step 1: テストを書く（Red）**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemberManagementModal } from './MemberManagementModal'
import '../../i18n'

const mockApiFetch = vi.fn()
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, apiFetch: (...a: unknown[]) => mockApiFetch(...a) }
})

describe('MemberManagementModal', () => {
  beforeEach(() => mockApiFetch.mockReset())

  function ownerMembersResponse() {
    return {
      owner: { id: 'u-owner', email: 'o@x.com', name: 'Owner' },
      editors: [
        { id: 'u-editor', email: 'e@x.com', name: 'Editor', joinedAt: '2026-04-24T00:00:00Z' },
      ],
    }
  }

  it('owner view: shows invite-link section and remove button for each editor', async () => {
    mockApiFetch.mockResolvedValueOnce(ownerMembersResponse())
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    expect(screen.getByTestId('invite-link-section')).toBeInTheDocument()
    expect(screen.getByTestId('remove-btn-u-editor')).toBeInTheDocument()
  })

  it('editor view: hides invite-link and remove buttons', async () => {
    mockApiFetch.mockResolvedValueOnce(ownerMembersResponse())
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-editor"
        isOwner={false}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    expect(screen.queryByTestId('invite-link-section')).toBeNull()
    expect(screen.queryByTestId(/^remove-btn-/)).toBeNull()
  })

  it('owner: generate invite link displays URL after API response', async () => {
    mockApiFetch
      .mockResolvedValueOnce(ownerMembersResponse())
      .mockResolvedValueOnce({ inviteToken: 'tok-abc', inviteUrl: 'https://x/join/tok-abc' })
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    fireEvent.click(screen.getByTestId('generate-invite-link-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('invite-url')).toHaveTextContent('https://x/join/tok-abc'),
    )
  })

  it('owner: remove-btn triggers confirm then DELETE call', async () => {
    mockApiFetch
      .mockResolvedValueOnce(ownerMembersResponse())
      .mockResolvedValueOnce(undefined) // DELETE response
      .mockResolvedValueOnce({
        owner: { id: 'u-owner', email: 'o@x.com', name: 'Owner' },
        editors: [],
      })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Editor'))
    fireEvent.click(screen.getByTestId('remove-btn-u-editor'))
    await waitFor(() => {
      const deleteCall = mockApiFetch.mock.calls.find(
        ([path, init]) =>
          path === '/projects/p-1/members/u-editor' && (init as RequestInit)?.method === 'DELETE',
      )
      expect(deleteCall).toBeTruthy()
    })
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run src/features/dashboard/MemberManagementModal.test.tsx`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: 実装**

`src/features/dashboard/MemberManagementModal.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import styles from './MemberManagementModal.module.css'

interface Member {
  id: string
  email: string
  name: string
  joinedAt?: string
}
interface MembersResponse {
  owner: Member
  editors: Member[]
}
interface InviteLinkResponse {
  inviteToken: string
  inviteUrl: string
}

interface Props {
  projectId: string
  currentUserId: string
  isOwner: boolean
  onClose: () => void
}

export function MemberManagementModal({ projectId, currentUserId, isOwner, onClose }: Props) {
  const { t } = useTranslation(['project'])
  const [members, setMembers] = useState<MembersResponse | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MembersResponse>(`/projects/${projectId}/members`)
      setMembers(data)
    } catch {
      setError('読み込みに失敗しました')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerate = async () => {
    setBusy(true)
    try {
      const res = await apiFetch<InviteLinkResponse>(`/projects/${projectId}/invite-link`, {
        method: 'POST',
      })
      setInviteUrl(res.inviteUrl)
    } catch {
      setError('招待リンクの生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async () => {
    if (!window.confirm(t('project:memberManagement.inviteLink.revokeConfirm'))) return
    setBusy(true)
    try {
      await apiFetch(`/projects/${projectId}/invite-link`, { method: 'DELETE' })
      setInviteUrl(null)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(t('project:memberManagement.removeConfirm', { name }))) return
    setBusy(true)
    try {
      await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} data-testid="member-modal">
        <h3 className={styles.title}>{t('project:memberManagement.title')}</h3>
        {error && <div className={styles.error}>{error}</div>}

        {isOwner && (
          <section className={styles.inviteSection} data-testid="invite-link-section">
            <h4>{t('project:memberManagement.inviteLink.heading')}</h4>
            {inviteUrl ? (
              <>
                <div className={styles.inviteUrl} data-testid="invite-url">
                  {inviteUrl}
                </div>
                <button type="button" onClick={() => void handleCopy()}>
                  {copied
                    ? t('project:memberManagement.inviteLink.copySuccess')
                    : t('project:memberManagement.inviteLink.copy')}
                </button>
                <button type="button" onClick={() => void handleRevoke()} disabled={busy}>
                  {t('project:memberManagement.inviteLink.revoke')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={busy}
                data-testid="generate-invite-link-btn"
              >
                {t('project:memberManagement.inviteLink.generate')}
              </button>
            )}
          </section>
        )}

        <section className={styles.listSection}>
          <h4>{t('project:memberManagement.memberList')}</h4>
          {members && (
            <ul>
              <li>
                <strong>👑 {members.owner.name}</strong>{' '}
                <span className={styles.badge}>{t('project:memberManagement.ownerBadge')}</span>
                {members.owner.id === currentUserId && (
                  <span className={styles.you}>({t('project:memberManagement.you')})</span>
                )}
              </li>
              {members.editors.map((m) => (
                <li key={m.id}>
                  ✏️ {m.name}
                  {m.id === currentUserId && (
                    <span className={styles.you}>({t('project:memberManagement.you')})</span>
                  )}
                  {isOwner && m.id !== currentUserId && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => void handleRemove(m.id, m.name)}
                      disabled={busy}
                      data-testid={`remove-btn-${m.id}`}
                    >
                      {t('project:memberManagement.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
```

CSS:

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: white;
  padding: 24px 32px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 560px;
}
.title {
  font-size: 18px;
  margin: 0 0 16px;
}
.error {
  color: #dc2626;
  margin-bottom: 12px;
}
.inviteSection {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 20px;
}
.inviteUrl {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  padding: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin: 8px 0;
}
.listSection ul {
  list-style: none;
  padding: 0;
}
.listSection li {
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge {
  background: #ede9fe;
  color: #5b21b6;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}
.you {
  color: #6b7280;
  font-size: 12px;
}
.removeBtn {
  margin-left: auto;
  background: #dc2626;
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.removeBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Green 確認**

Run: `npx vitest run src/features/dashboard/MemberManagementModal.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/dashboard/MemberManagementModal.tsx \
        src/features/dashboard/MemberManagementModal.module.css \
        src/features/dashboard/MemberManagementModal.test.tsx
git commit -m "feat(#306): add member management modal"
```

---

## Task 11: プロジェクトアクションバー + Dashboard 統合

**Files:**

- Create: `src/features/dashboard/ProjectActionBar.tsx`
- Create: `src/features/dashboard/ProjectActionBar.module.css`
- Create: `src/features/dashboard/ProjectActionBar.test.tsx`
- Modify: `src/features/dashboard/Dashboard.tsx`
- Modify: `src/features/dashboard/Dashboard.test.tsx`

- [ ] **Step 1: ProjectActionBar のテスト（Red）**

`ProjectActionBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectActionBar } from './ProjectActionBar'
import '../../i18n'

describe('ProjectActionBar', () => {
  const noop = () => {}

  it('owner view shows Settings and Members buttons', () => {
    render(
      <ProjectActionBar
        projectName="P"
        ownerName={null}
        role="owner"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={noop}
      />,
    )
    expect(screen.getByTestId('project-settings-btn')).toBeInTheDocument()
    expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('project-leave-btn')).toBeNull()
  })

  it('editor view shows Members and Leave, owner name appended', () => {
    render(
      <ProjectActionBar
        projectName="P"
        ownerName="Alice"
        role="editor"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={noop}
      />,
    )
    expect(screen.queryByTestId('project-settings-btn')).toBeNull()
    expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
    expect(screen.getByTestId('project-leave-btn')).toBeInTheDocument()
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })

  it('Leave button triggers onLeave callback after confirm', () => {
    const onLeave = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <ProjectActionBar
        projectName="P"
        ownerName="Alice"
        role="editor"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={onLeave}
      />,
    )
    fireEvent.click(screen.getByTestId('project-leave-btn'))
    expect(onLeave).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run src/features/dashboard/ProjectActionBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`ProjectActionBar.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import styles from './ProjectActionBar.module.css'

interface Props {
  projectName: string
  ownerName: string | null
  role: 'owner' | 'editor'
  onOpenSettings: () => void
  onOpenMembers: () => void
  onLeave: () => void
}

export function ProjectActionBar({
  projectName,
  ownerName,
  role,
  onOpenSettings,
  onOpenMembers,
  onLeave,
}: Props) {
  const { t } = useTranslation(['project'])

  return (
    <div className={styles.bar} data-testid="project-action-bar">
      <div className={styles.title}>
        🗂 {projectName}
        {role === 'editor' && ownerName && (
          <span className={styles.ownerLabel}>
            {t('project:sharedProjects.ownerLabel', { name: ownerName })}
          </span>
        )}
      </div>
      <div className={styles.actions}>
        {role === 'owner' && (
          <>
            <button type="button" onClick={onOpenSettings} data-testid="project-settings-btn">
              ⚙ {t('project:actionBar.settings')}
            </button>
            <button type="button" onClick={onOpenMembers} data-testid="project-members-btn">
              👥 {t('project:actionBar.members')}
            </button>
          </>
        )}
        {role === 'editor' && (
          <>
            <button type="button" onClick={onOpenMembers} data-testid="project-members-btn">
              👥 {t('project:actionBar.members')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('project:leave.confirm'))) onLeave()
              }}
              data-testid="project-leave-btn"
            >
              🚪 {t('project:actionBar.leave')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

CSS:

```css
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.ownerLabel {
  color: #6b7280;
  font-weight: 400;
  font-size: 14px;
  margin-left: 6px;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  cursor: pointer;
  font-size: 13px;
}
```

- [ ] **Step 4: Dashboard への統合**

`src/features/dashboard/Dashboard.tsx` で、プロジェクト選択時（`currentProjectId !== null`）に:

1. 現在のプロジェクト情報（name, role, ownerName）を state として持つ
2. `GET /projects/:id/members` で role と ownerName を取得する fetch を追加（or 既存の sharedProjects / projects リストから解決）
3. `<ProjectActionBar>` をフロー一覧の上に表示
4. `onOpenMembers` で `<MemberManagementModal>` を開く state を管理
5. `onLeave` で `DELETE /projects/:id/members/<currentUserId>` を呼び出し、成功したらサイドバーの shared projects を再フェッチ + プロジェクト選択を解除

`Dashboard.test.tsx` に以下のテストを追加（既存テストの `mockApiFetch` モックパターンに合わせる）:

```tsx
it('renders ProjectActionBar with leave button when editor selects shared project', async () => {
  // seed apiFetch responses
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/projects') return Promise.resolve({ projects: [] })
    if (path === '/projects/shared') {
      return Promise.resolve({
        projects: [
          {
            id: 'shared-p1',
            name: 'Shared',
            ownerName: 'Alice',
            joinedAt: '2026-04-24T00:00:00Z',
            createdAt: '',
            updatedAt: '',
          },
        ],
      })
    }
    if (path === '/projects/shared-p1/members') {
      return Promise.resolve({
        owner: { id: 'u-alice', email: 'a@x.com', name: 'Alice' },
        editors: [{ id: 'u-me', email: 'me@x.com', name: 'Me', joinedAt: '2026-04-24T00:00:00Z' }],
      })
    }
    if (path.startsWith('/flows')) return Promise.resolve({ flows: [] })
    return Promise.resolve({})
  })

  render(
    <MemoryRouter initialEntries={['/flows?project=shared-p1']}>
      <Dashboard />
    </MemoryRouter>,
  )

  await waitFor(() => expect(screen.getByTestId('project-action-bar')).toBeInTheDocument())
  expect(screen.getByTestId('project-leave-btn')).toBeInTheDocument()
  expect(screen.queryByTestId('project-settings-btn')).toBeNull()
})

it('renders ProjectActionBar with settings+members when owner selects own project', async () => {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/projects')
      return Promise.resolve({
        projects: [{ id: 'p1', name: 'Mine', createdAt: '', updatedAt: '' }],
      })
    if (path === '/projects/shared') return Promise.resolve({ projects: [] })
    if (path === '/projects/p1/members') {
      return Promise.resolve({
        owner: { id: 'u-me', email: 'me@x.com', name: 'Me' },
        editors: [],
      })
    }
    if (path.startsWith('/flows')) return Promise.resolve({ flows: [] })
    return Promise.resolve({})
  })

  render(
    <MemoryRouter initialEntries={['/flows?project=p1']}>
      <Dashboard />
    </MemoryRouter>,
  )

  await waitFor(() => expect(screen.getByTestId('project-settings-btn')).toBeInTheDocument())
  expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
  expect(screen.queryByTestId('project-leave-btn')).toBeNull()
})
```

**Note**: `GET /projects/:id/members` を Dashboard マウント時に呼ぶ前提の設計。role 判定は owner.id === currentUser なら owner、そうでなければ editor（メンバー一覧に自分が含まれる前提）。

- [ ] **Step 5: Green 確認**

Run: `npx vitest run src/features/dashboard/ProjectActionBar.test.tsx src/features/dashboard/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/features/dashboard/ProjectActionBar.tsx \
        src/features/dashboard/ProjectActionBar.module.css \
        src/features/dashboard/ProjectActionBar.test.tsx \
        src/features/dashboard/Dashboard.tsx \
        src/features/dashboard/Dashboard.test.tsx
git commit -m "feat(#306): add project action bar + Dashboard integration"
```

---

## Task 12: `/join/:token` ルート + JoinProjectPage

**Files:**

- Create: `src/features/projects/JoinProjectPage.tsx`
- Create: `src/features/projects/JoinProjectPage.module.css`
- Create: `src/features/projects/JoinProjectPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: テストを書く（Red）**

`JoinProjectPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JoinProjectPage } from './JoinProjectPage'
import '../../i18n'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiFetch = vi.fn()
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, apiFetch: (...a: unknown[]) => mockApiFetch(...a) }
})

const mockUseAuth = { user: null as { id: string } | null, loading: false }
vi.mock('../../hooks/useAuth', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAuth')>('../../hooks/useAuth')
  return { ...actual, useAuth: () => mockUseAuth }
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:token" element={<JoinProjectPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinProjectPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockNavigate.mockReset()
    mockUseAuth.user = null
    mockUseAuth.loading = false
  })

  it('shows β-invite-required screen when not logged in', async () => {
    mockUseAuth.user = null
    renderAt('/join/tok-1')
    await waitFor(() =>
      expect(screen.getByText(/β 招待コード|beta invitation code/i)).toBeInTheDocument(),
    )
  })

  it('calls join API when logged in and navigates on success', async () => {
    mockUseAuth.user = { id: 'u-1' }
    mockApiFetch.mockResolvedValueOnce({ projectId: 'p-1', role: 'editor' })
    renderAt('/join/tok-1')
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('p-1'), expect.anything()),
    )
  })

  it('shows alreadyMember message then navigates', async () => {
    mockUseAuth.user = { id: 'u-1' }
    mockApiFetch.mockResolvedValueOnce({ projectId: 'p-1', role: 'editor', alreadyMember: true })
    renderAt('/join/tok-1')
    await waitFor(() => screen.getByText(/既に参加済み|already a member/i))
  })

  it('shows token-invalid error for 404', async () => {
    mockUseAuth.user = { id: 'u-1' }
    const err = Object.assign(new Error('invalid'), { status: 404, code: 'INVITE_TOKEN_INVALID' })
    mockApiFetch.mockRejectedValueOnce(err)
    renderAt('/join/tok-1')
    await waitFor(() => screen.getByText(/招待リンクが無効|invite link is invalid/i))
  })
})
```

- [ ] **Step 2: Red 確認**

Run: `npx vitest run src/features/projects/JoinProjectPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`JoinProjectPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch, ApiError } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import styles from './JoinProjectPage.module.css'

type Status = 'initial' | 'joining' | 'success' | 'already' | 'invalid' | 'require-beta'

export function JoinProjectPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation(['project'])
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<Status>('initial')

  useEffect(() => {
    if (loading) return
    if (!user) {
      setStatus('require-beta')
      return
    }
    if (!token) {
      setStatus('invalid')
      return
    }
    setStatus('joining')
    apiFetch<{ projectId: string; role: string; alreadyMember?: boolean }>(
      `/projects/join/${token}`,
      { method: 'POST' },
    )
      .then((res) => {
        if (res.alreadyMember) {
          setStatus('already')
          setTimeout(() => navigate(`/flows?project=${res.projectId}`, { replace: true }), 1200)
        } else {
          setStatus('success')
          setTimeout(() => navigate(`/flows?project=${res.projectId}`, { replace: true }), 1200)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setStatus('invalid')
        } else {
          setStatus('invalid')
        }
      })
  }, [loading, user, token, navigate])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('project:joinPage.title')}</h1>
      {status === 'joining' && <p>{t('project:joinPage.joining')}</p>}
      {status === 'success' && <p>{t('project:joinPage.success', { projectName: '' })}</p>}
      {status === 'already' && <p>{t('project:joinPage.alreadyMember')}</p>}
      {status === 'invalid' && (
        <>
          <p>{t('project:joinPage.tokenInvalid')}</p>
          <Link to="/" className={styles.link}>
            {t('project:joinPage.goToLanding')}
          </Link>
        </>
      )}
      {status === 'require-beta' && (
        <>
          <p>{t('project:joinPage.requireBetaInvite')}</p>
          <Link to="/" className={styles.link}>
            {t('project:joinPage.goToLanding')}
          </Link>
        </>
      )}
    </div>
  )
}
```

`JoinProjectPage.module.css`:

```css
.container {
  max-width: 560px;
  margin: 80px auto;
  padding: 32px;
  text-align: center;
}
.title {
  font-size: 24px;
  margin-bottom: 24px;
}
.link {
  display: inline-block;
  margin-top: 16px;
  color: #7c5cfc;
  text-decoration: underline;
}
```

- [ ] **Step 4: `src/App.tsx` にルート追加**

既存の `<Routes>` 内に:

```tsx
<Route path="/join/:token" element={<JoinProjectPage />} />
```

を、他の認証・コンテンツルートの近くに挿入。`useAuth.loading` の間は何も表示しない挙動（JoinProjectPage 内で handle 済み）。

- [ ] **Step 5: Green 確認**

Run: `npx vitest run src/features/projects/JoinProjectPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 全テスト**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/features/projects/JoinProjectPage.tsx \
        src/features/projects/JoinProjectPage.module.css \
        src/features/projects/JoinProjectPage.test.tsx \
        src/App.tsx
git commit -m "feat(#306): add /join/:token route and JoinProjectPage"
```

---

## Task 13: プレビュービルド確認 + PR 作成

- [ ] **Step 1: main を最新化してリベース**

```bash
git fetch origin
git rebase origin/main
npm test
```

- [ ] **Step 2: プレビュービルド**

`~/.claude/skills/preview/SKILL.md` を参照してローカルビルド確認。

- [ ] **Step 3: Push**

```bash
git push -u origin feat/project-sharing-306
```

- [ ] **Step 4: PR 作成**

```bash
gh pr create --title "feat(#306): project-level sharing with editor role" --body "$(cat <<'EOF'
## Summary

- プロジェクト単位の共同編集機能（オーナー / 編集者の2階層）
- `project_members` テーブル + `projects.invite_token` 追加
- 招待リンク（POST/DELETE /invite-link）、参加（POST /join/:token）、メンバー一覧・削除、共有プロジェクト一覧エンドポイント
- 既存 `/flows` ルートの権限判定を `canAccessFlow()` に差し替え
- Dashboard サイドバーに「共有されたプロジェクト」セクション、プロジェクトアクションバー（設定/メンバー/退出）、メンバー管理モーダル、`/join/:token` ページ

Closes #306

## Test plan
- [ ] `npm test` 全通過
- [ ] 管理画面 → プロジェクト作成 → 招待リンク生成 → 別アカウントでリンクを踏む → 編集者として参加
- [ ] 編集者は共有プロジェクトのフローを編集可、削除は不可（403）
- [ ] メンバーが退出すると共有プロジェクトから消える
- [ ] オーナーがメンバーを削除できる
- [ ] LCP < 1秒

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI watch**

```bash
gh pr checks --watch
```

- [ ] **Step 6: Claude レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 7: レビュー修正ループ（最大 10 回）**

CLAUDE.md の「Step 9 レビュー修正ループ」に従う。

- [ ] **Step 8: Merge & Deploy Verification**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

`~/.claude/skills/deploy/SKILL.md` でデプロイ確認。

- [ ] **Step 9: Worktree Cleanup**

```bash
git worktree remove .worktrees/feat-project-sharing-306
git branch -d feat/project-sharing-306
git worktree list
```
