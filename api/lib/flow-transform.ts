// =============================================
// DB row types and camelCase transform helpers
// Shared between flows.ts and shared.ts routes
// =============================================

export interface FlowRow {
  id: string
  user_id: string
  title: string
  theme_id: string
  share_token: string | null
  created_at: string
  updated_at: string
}

export interface LaneRow {
  id: string
  flow_id: string
  name: string
  color_index: number
  position: number
  created_at: string
  updated_at: string
}

export interface NodeRow {
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

export interface ArrowRow {
  id: string
  flow_id: string
  from_node_id: string
  to_node_id: string
  comment: string | null
  created_at: string
  updated_at: string
}

export function toFlowSummary(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toLane(row: LaneRow) {
  return {
    id: row.id,
    name: row.name,
    colorIndex: row.color_index,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toNode(row: NodeRow) {
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

export function toArrow(row: ArrowRow) {
  return {
    id: row.id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
