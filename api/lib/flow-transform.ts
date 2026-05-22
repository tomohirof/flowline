// =============================================
// DB row types and camelCase transform helpers
// Shared between flows.ts and shared.ts routes
// =============================================

export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'

export interface FlowRow {
  id: string
  user_id: string
  title: string
  theme_id: string
  share_token: string | null
  deleted_at: string | null
  project_id: string | null
  created_at: string
  updated_at: string
}

export interface LaneRow {
  id: string
  flow_id: string
  name: string
  color_index: number
  position: number
  group_id: string | null
  group_role: 'parent' | 'sub' | null
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
  bg: string | null
  stroke_color: string | null
  dash: string | null
  shape: string | null
  created_at: string
  updated_at: string
}

export interface ArrowRow {
  id: string
  flow_id: string
  from_node_id: string
  to_node_id: string
  comment: string | null
  color: string | null
  dash: string | null
  bidirectional: number | null
  from_side: ArrowSide | null
  created_at: string
  updated_at: string
}

export function toFlowSummary(row: FlowRow) {
  return {
    id: row.id,
    title: row.title,
    themeId: row.theme_id,
    shareToken: row.share_token,
    deletedAt: row.deleted_at,
    projectId: row.project_id,
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
    // null → undefined so JSON omits the key for ungrouped lanes (matches Lane.groupId?)
    groupId: row.group_id ?? undefined,
    groupRole: row.group_role ?? undefined,
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
    bg: row.bg,
    strokeColor: row.stroke_color,
    dash: row.dash,
    shape: row.shape,
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
    color: row.color,
    dash: row.dash,
    bidirectional: row.bidirectional === 1,
    fromSide: row.from_side,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface ProjectRow {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export function toProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
