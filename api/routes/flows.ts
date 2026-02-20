import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { createFlowSchema, updateFlowSchema } from '../lib/validators'
import { generateId } from '../lib/id'
import {
  type FlowRow,
  type LaneRow,
  type NodeRow,
  type ArrowRow,
  toFlowSummary,
  toLane,
  toNode,
  toArrow,
} from '../lib/flow-transform'

const flows = new Hono<AuthEnv>()

flows.use('*', authMiddleware)

// =============================================
// Helper: get flow detail (flow + lanes + nodes + arrows)
// =============================================

async function getFlowDetail(db: D1Database, flowId: string) {
  const [flowResult, lanesResult, nodesResult, arrowsResult] = await db.batch([
    db.prepare('SELECT * FROM flows WHERE id = ?').bind(flowId),
    db.prepare('SELECT * FROM lanes WHERE flow_id = ? ORDER BY position ASC').bind(flowId),
    db
      .prepare('SELECT * FROM nodes WHERE flow_id = ? ORDER BY row_index ASC, order_index ASC')
      .bind(flowId),
    db.prepare('SELECT * FROM arrows WHERE flow_id = ?').bind(flowId),
  ])

  const flowRows = (flowResult as { results: FlowRow[] }).results ?? []
  if (flowRows.length === 0) return null
  const flow = flowRows[0]

  const lanes = ((lanesResult as { results: LaneRow[] }).results ?? []).map(toLane)
  const nodes = ((nodesResult as { results: NodeRow[] }).results ?? []).map(toNode)
  const arrows = ((arrowsResult as { results: ArrowRow[] }).results ?? []).map(toArrow)

  return {
    ...toFlowSummary(flow),
    lanes,
    nodes,
    arrows,
  }
}

// =============================================
// Helper: check flow ownership
// =============================================

async function checkFlowOwnership(db: D1Database, flowId: string, userId: string) {
  const flow = await db
    .prepare('SELECT id, user_id FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ id: string; user_id: string }>()
  if (!flow) return { error: 'not_found' as const }
  if (flow.user_id !== userId) return { error: 'forbidden' as const }
  return { error: null }
}

// =============================================
// GET / - List user's flows
// =============================================

flows.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  const result = await db
    .prepare('SELECT * FROM flows WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(userId)
    .all<FlowRow>()

  const flowList = (result.results ?? []).map(toFlowSummary)

  return c.json({ flows: flowList })
})

// =============================================
// POST / - Create flow
// =============================================

flows.post('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  const parsed = createFlowSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 400)
  }

  const { title, themeId, lanes, nodes, arrows } = parsed.data
  const flowId = generateId()
  const flowTitle = title ?? '無題のフロー'
  const flowThemeId = themeId ?? 'cloud'

  // Build batch statements
  const statements: Array<ReturnType<D1Database['prepare']>> = []

  // INSERT flow
  statements.push(
    db
      .prepare('INSERT INTO flows (id, user_id, title, theme_id) VALUES (?, ?, ?, ?)')
      .bind(flowId, userId, flowTitle, flowThemeId),
  )

  // INSERT lanes
  for (const lane of lanes) {
    statements.push(
      db
        .prepare(
          'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(lane.id, flowId, lane.name, lane.colorIndex, lane.position),
    )
  }

  // INSERT nodes
  for (const node of nodes) {
    statements.push(
      db
        .prepare(
          'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          node.id,
          flowId,
          node.laneId,
          node.rowIndex,
          node.label,
          node.note ?? null,
          node.orderIndex,
        ),
    )
  }

  // INSERT arrows
  for (const arrow of arrows) {
    statements.push(
      db
        .prepare(
          'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(arrow.id, flowId, arrow.fromNodeId, arrow.toNodeId, arrow.comment ?? null),
    )
  }

  await db.batch(statements)

  const detail = await getFlowDetail(db, flowId)
  return c.json({ flow: detail }, 201)
})

// =============================================
// GET /:id - Get flow detail
// =============================================

flows.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  const detail = await getFlowDetail(db, flowId)
  return c.json({ flow: detail })
})

// =============================================
// PUT /:id - Update flow
// =============================================

flows.put('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  const parsed = updateFlowSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 400)
  }

  const { title, themeId, lanes, nodes, arrows } = parsed.data

  // Build batch: DELETE old children -> UPDATE flow -> INSERT new children
  const statements: Array<ReturnType<D1Database['prepare']>> = []

  // DELETE old arrows, nodes, lanes (order matters due to FK)
  statements.push(db.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId))
  statements.push(db.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId))
  statements.push(db.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId))

  // UPDATE flow
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const updateParts: string[] = []
  const updateParams: unknown[] = []

  if (title !== undefined) {
    updateParts.push('title = ?')
    updateParams.push(title)
  }
  if (themeId !== undefined) {
    updateParts.push('theme_id = ?')
    updateParams.push(themeId)
  }
  updateParts.push('updated_at = ?')
  updateParams.push(now)
  updateParams.push(flowId)

  statements.push(
    db.prepare(`UPDATE flows SET ${updateParts.join(', ')} WHERE id = ?`).bind(...updateParams),
  )

  // INSERT new lanes
  for (const lane of lanes) {
    statements.push(
      db
        .prepare(
          'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(lane.id, flowId, lane.name, lane.colorIndex, lane.position),
    )
  }

  // INSERT new nodes
  for (const node of nodes) {
    statements.push(
      db
        .prepare(
          'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          node.id,
          flowId,
          node.laneId,
          node.rowIndex,
          node.label,
          node.note ?? null,
          node.orderIndex,
        ),
    )
  }

  // INSERT new arrows
  for (const arrow of arrows) {
    statements.push(
      db
        .prepare(
          'INSERT INTO arrows (id, flow_id, from_node_id, to_node_id, comment) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(arrow.id, flowId, arrow.fromNodeId, arrow.toNodeId, arrow.comment ?? null),
    )
  }

  await db.batch(statements)

  const detail = await getFlowDetail(db, flowId)
  return c.json({ flow: detail })
})

// =============================================
// POST /:id/share - Share flow (generate token)
// =============================================

flows.post('/:id/share', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const flow = await db
    .prepare('SELECT id, user_id, share_token FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ id: string; user_id: string; share_token: string | null }>()
  if (!flow) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (flow.user_id !== userId) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // If already shared, return existing token
  if (flow.share_token) {
    return c.json({ shareToken: flow.share_token, shareUrl: `/shared/${flow.share_token}` })
  }

  // Generate new token
  const shareToken = crypto.randomUUID()
  await db.prepare('UPDATE flows SET share_token = ? WHERE id = ?').bind(shareToken, flowId).run()

  return c.json({ shareToken, shareUrl: `/shared/${shareToken}` })
})

// =============================================
// DELETE /:id/share - Unshare flow
// =============================================

flows.delete('/:id/share', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  await db.prepare('UPDATE flows SET share_token = NULL WHERE id = ?').bind(flowId).run()

  return c.json({ message: '共有を解除しました' })
})

// =============================================
// DELETE /:id - Delete flow
// =============================================

flows.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('id')

  const ownership = await checkFlowOwnership(db, flowId, userId)
  if (ownership.error === 'not_found') {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (ownership.error === 'forbidden') {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }

  // Explicitly delete related data first (D1 may not enforce ON DELETE CASCADE)
  await db.batch([
    db.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId),
    db.prepare('DELETE FROM flows WHERE id = ?').bind(flowId),
  ])

  return c.json({ message: 'フローを削除しました' })
})

export { flows }
