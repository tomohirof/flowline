// =============================================
// Theme & Palette types (from mockup constants)
// =============================================

export interface Palette {
  dot: string
  tag: string
  text: string
  name: string
}

export interface Theme {
  name: string
  emoji: string
  bg: string
  canvasBg: string
  dotGrid: string
  sidebar: string
  sidebarBorder: string
  sidebarIcon: string
  sidebarActive: string
  sidebarActiveBg: string
  titleBar: string
  titleBarBorder: string
  titleColor: string
  titleSub: string
  laneBg: string
  laneHeaderBg: string
  laneBorder: string
  laneAccentOpacity: number
  nodeStroke: string
  nodeFill: string
  nodeShadow: string
  nodeSelStroke: string
  arrowColor: string
  arrowSel: string
  accent: string
  statusBg: string
  statusBorder: string
  statusText: string
  commentPill: string
  commentBorder: string
  commentText: string
  panelBg: string
  panelBorder: string
  panelText: string
  panelLabel: string
  inputBg: string
  inputBorder: string
  laneGap: number
}

export type ThemeId = 'cloud' | 'midnight' | 'blueprint'

// =============================================
// Data model types (matching API response format)
// =============================================

export interface Lane {
  id: string
  name: string
  colorIndex: number
  position: number
}

export interface Node {
  id: string
  laneId: string
  rowIndex: number
  label: string
  note: string | null
  orderIndex: number
}

export interface Arrow {
  id: string
  fromNodeId: string
  toNodeId: string
  comment: string | null
}

export interface Flow {
  id: string
  title: string
  themeId: string
  shareToken: string | null
  createdAt: string
  updatedAt: string
  lanes: Lane[]
  nodes: Node[]
  arrows: Arrow[]
}

// =============================================
// API response types
// =============================================

export interface FlowSummary {
  id: string
  title: string
  themeId: string
  shareToken: string | null
  createdAt: string
  updatedAt: string
}

export interface FlowListResponse {
  flows: FlowSummary[]
}

export interface FlowDetailResponse {
  flow: Flow
}

// =============================================
// API request types
// =============================================

export interface FlowSavePayload {
  title: string
  themeId: string
  lanes: Lane[]
  nodes: Node[]
  arrows: Arrow[]
}

// =============================================
// Save status for useFlow hook
// =============================================

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

// =============================================
// Editor internal types (used by FlowEditor component)
// =============================================

/** Internal task map: key = `${laneId}_${rowId}` */
export interface TaskData {
  label: string
  lid: string
  rid: string
  /** Stable node ID for API persistence. Generated on creation, preserved across saves. */
  nodeId: string
}

export interface RowData {
  id: string
}

export interface InternalLane {
  id: string
  name: string
  ci: number
}

export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
}

export interface DragState {
  key: string
}

export interface ArrowPathResult {
  d: string
  mx: number
  my: number
}

export interface CellInfo {
  lid: string
  rid: string
  li: number
  ri: number
  key: string
}

export interface Point {
  x: number
  y: number
}

export type ToolId = 'select' | 'connect' | 'addRow' | 'rmRow' | 'zoomIn' | 'zoomOut' | 'export'

export interface SideTool {
  id: ToolId
  icon: React.ReactNode
  tip: string
  action?: () => void
}

export interface EditorSnapshot {
  tasks: Record<string, TaskData>
  order: string[]
  arrows: InternalArrow[]
  notes: Record<string, string>
  lanes: InternalLane[]
  rows: RowData[]
}
