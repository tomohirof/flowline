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
function toPublicFlowSummary(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const shared = new Hono<{ Bindings: Bindings }>()

// =============================================
// GET /:token - Get shared flow (NO auth required)
// =============================================

shared.get('/:token', async (c) => {
  const token = c.req.param('token')
  const db = c.env.FLOWLINE_DB

  // Find flow by share_token
  const flow = await db.prepare('SELECT * FROM flows WHERE share_token = ?').bind(token).first<FlowRow>()
  if (!flow) {
    return c.json({ error: '共有フローが見つかりません' }, 404)
  }

  const flowId = flow.id

  const [lanesResult, nodesResult, arrowsResult] = await db.batch([
    db.prepare('SELECT * FROM lanes WHERE flow_id = ? ORDER BY position ASC').bind(flowId),
    db.prepare('SELECT * FROM nodes WHERE flow_id = ? ORDER BY row_index ASC, order_index ASC').bind(flowId),
    db.prepare('SELECT * FROM arrows WHERE flow_id = ?').bind(flowId),
  ])

  const lanes = ((lanesResult as { results: LaneRow[] }).results ?? []).map(toLane)
  const nodes = ((nodesResult as { results: NodeRow[] }).results ?? []).map(toNode)
  const arrows = ((arrowsResult as { results: ArrowRow[] }).results ?? []).map(toArrow)

  return c.json({
    flow: {
      ...toPublicFlowSummary(flow),
      lanes,
      nodes,
      arrows,
    },
  })
})

export { shared }
