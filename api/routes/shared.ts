import { Hono } from 'hono'
import type { Bindings } from '../app'

interface FlowRow {
  id: string
  user_id: string
  title: string
  theme_id: string
  share_token: string | null
  created_at: string
  updated_at: string
}

interface LaneRow {
  id: string
  flow_id: string
  name: string
  color_index: number
  position: number
  created_at: string
  updated_at: string
}

interface NodeRow {
  id: string
  flow_id: string
  lane_id: string
  row_index: number
  label: string
  note: string | null
  order_index: number
  created_at: string
  updated_at: string
}

interface ArrowRow {
  id: string
  flow_id: string
  from_node_id: string
  to_node_id: string
  comment: string | null
  created_at: string
  updated_at: string
}

function toFlowSummary(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toLane(row: LaneRow) {
  return {
    id: row.id,
    name: row.name,
    colorIndex: row.color_index,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toNode(row: NodeRow) {
  return {
    id: row.id,
    laneId: row.lane_id,
    rowIndex: row.row_index,
    label: row.label,
    note: row.note,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toArrow(row: ArrowRow) {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    comment: row.comment,
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
      ...toFlowSummary(flow),
      lanes,
      nodes,
      arrows,
    },
  })
})

export { shared }
