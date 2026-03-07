import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { createProjectSchema, updateProjectSchema } from '../lib/validators'
import { generateId } from '../lib/id'
import { type ProjectRow, toProject } from '../lib/flow-transform'

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

export { projects }
