import { Hono } from 'hono'
import type { Bindings } from '../app'
import {
  type FlowRow,
  type LaneRow,
  type NodeRow,
  type ArrowRow,
  toLane,
  toNode,
  toArrow,
} from '../lib/flow-transform'

// Public flow summary: excludes shareToken and userId for security
function toPublicFlowSummary(row: FlowRow, authorName?: string) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(authorName !== undefined && { authorName }),
  }
}

const shared = new Hono<{ Bindings: Bindings }>()

// =============================================
// GET /:token - Get shared flow (NO auth required)
// =============================================

shared.get('/:token', async (c) => {
  const token = c.req.param('token')
  const db = c.env.FLOWLINE_DB

  // Find flow by share_token with author name (exclude soft-deleted flows)
  // LEFT JOIN ensures flow is returned even if author user was deleted
  const flow = await db
    .prepare(
      'SELECT f.*, u.name as author_name FROM flows f LEFT JOIN users u ON f.user_id = u.id WHERE f.share_token = ? AND f.deleted_at IS NULL',
    )
    .bind(token)
    .first<FlowRow & { author_name: string | null }>()
  if (!flow) {
    return c.json({ error: '共有フローが見つかりません' }, 404)
  }

  const flowId = flow.id

  const [lanesResult, nodesResult, arrowsResult] = await db.batch([
    db.prepare('SELECT * FROM lanes WHERE flow_id = ? ORDER BY position ASC').bind(flowId),
    db
      .prepare('SELECT * FROM nodes WHERE flow_id = ? ORDER BY row_index ASC, order_index ASC')
      .bind(flowId),
    db.prepare('SELECT * FROM arrows WHERE flow_id = ?').bind(flowId),
  ])

  const lanes = ((lanesResult as { results: LaneRow[] }).results ?? []).map(toLane)
  const nodes = ((nodesResult as { results: NodeRow[] }).results ?? []).map(toNode)
  const arrows = ((arrowsResult as { results: ArrowRow[] }).results ?? []).map(toArrow)

  return c.json({
    flow: {
      ...toPublicFlowSummary(flow, flow.author_name ?? undefined),
      lanes,
      nodes,
      arrows,
    },
  })
})

export { shared }
