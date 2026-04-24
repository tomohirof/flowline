import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { createProjectSchema, updateProjectSchema } from '../lib/validators'
import { generateId } from '../lib/id'
import { type ProjectRow, toProject } from '../lib/flow-transform'
import { getProjectRole } from '../lib/project-access'

const projects = new Hono<AuthEnv>()
projects.use('*', authMiddleware)

// GET / - List user's projects
projects.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const result = await db
    .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY name ASC')
    .bind(userId)
    .all<ProjectRow>()
  return c.json({ projects: (result.results ?? []).map(toProject) })
})

// =============================================
// GET /shared - List projects where current user is an editor member
// Note: declared before /:id routes to avoid parameter shadowing.
// =============================================

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

// POST / - Create project
projects.post('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const body = await c.req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)

  const id = generateId()
  await db
    .prepare('INSERT INTO projects (id, user_id, name) VALUES (?, ?, ?)')
    .bind(id, userId, parsed.data.name)
    .run()

  const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>()
  return c.json({ project: toProject(row!) }, 201)
})

// PUT /:id - Rename project
projects.put('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')

  const project = await db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .bind(projectId, userId)
    .first<ProjectRow>()
  if (!project) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json()
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)

  await db
    .prepare(
      "UPDATE projects SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    )
    .bind(parsed.data.name, projectId)
    .run()

  const updated = await db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .bind(projectId)
    .first<ProjectRow>()
  return c.json({ project: toProject(updated!) })
})

// DELETE /:id - Delete project (flows become uncategorized via ON DELETE SET NULL)
projects.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const projectId = c.req.param('id')

  const project = await db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .bind(projectId, userId)
    .first<ProjectRow>()
  if (!project) return c.json({ error: 'Not found' }, 404)

  await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run()
  return c.json({ ok: true })
})

// =============================================
// POST /:id/invite-link - Generate or retrieve the project's invite token (owner only)
// =============================================

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

// =============================================
// DELETE /:id/invite-link - Clear the project's invite token (owner only)
// =============================================

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

  await db
    .prepare('UPDATE projects SET invite_token = NULL WHERE id = ?')
    .bind(projectId)
    .run()
  return c.body(null, 204)
})

// =============================================
// POST /join/:token - Join a project via invite link
// =============================================

projects.post('/join/:token', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const token = c.req.param('token')

  if (!token) {
    return c.json({ error: '招待リンクが無効です', code: 'INVITE_TOKEN_INVALID' }, 404)
  }

  const project = await db
    .prepare('SELECT id, user_id FROM projects WHERE invite_token IS NOT NULL AND invite_token = ?')
    .bind(token)
    .first<{ id: string; user_id: string }>()
  if (!project) {
    return c.json({ error: '招待リンクが無効です', code: 'INVITE_TOKEN_INVALID' }, 404)
  }

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

// =============================================
// GET /:id/members - List project members (owner + editors)
// =============================================

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

// =============================================
// DELETE /:id/members/:userId - Remove member (owner kicks or member leaves)
// =============================================

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
      { error: 'オーナーは退出できません。プロジェクトを削除してください', code: 'OWNER_CANNOT_LEAVE' },
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

export { projects }
