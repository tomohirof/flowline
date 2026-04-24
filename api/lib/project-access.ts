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
