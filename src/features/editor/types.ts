import type { InternalArrow, ArrowPathResult } from '../../lib/types'
export type { InternalArrow, ArrowPathResult }

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
  commentIconColor: string
  dangerColor: string
  toolbarBg: string
  toolbarBorder: string
  toolbarShadow: string
  memoBg: string
  memoBorder: string
  memoBorderHover: string
  memoText: string
  memoConnector: string
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
  groupId?: string
  groupRole?: 'parent' | 'sub'
}

export interface Node {
  id: string
  laneId: string
  rowIndex: number
  label: string
  note: string | null
  orderIndex: number
  bg?: string | null
  strokeColor?: string | null
  dash?: string | null
  shape?: 'diamond' | null
}

export interface Arrow {
  id: string
  fromNodeId: string
  toNodeId: string
  comment: string | null
  color?: string | null
  dash?: string | null
}

export interface Flow {
  id: string
  title: string
  themeId: string
  shareToken: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  lanes: Lane[]
  nodes: Node[]
  arrows: Arrow[]
  authorName?: string
}

// =============================================
// API response types
// =============================================

export interface FlowSummary {
  id: string
  title: string
  themeId: string
  shareToken: string | null
  deletedAt: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface FlowListResponse {
  flows: FlowSummary[]
}

export interface FlowDetailResponse {
  flow: Flow
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectListResponse {
  projects: Project[]
}

// =============================================
// API request types
// =============================================

export interface FlowSavePayload {
  title: string
  themeId: string
  lanes?: Lane[]
  nodes?: Node[]
  arrows?: Arrow[]
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
  bg?: string
  strokeColor?: string
  dash?: string
  shape?: 'diamond'
}

export interface MemoData {
  text: string
  dx: number
  dy: number
}

export interface RowData {
  id: string
}

export interface InternalLane {
  id: string
  name: string
  ci: number
  groupId?: string
  groupRole?: 'parent' | 'sub'
}

export interface DragState {
  key: string
  multi?: boolean
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
  memos: Record<string, MemoData>
  lanes: InternalLane[]
  rows: RowData[]
}

export interface EditorSettings {
  copyLabelOnSameRow: boolean
  autoConnect: boolean
  autoAddRow: boolean
  enterEditOnCreate: boolean
  autoRepair: boolean
  showDotGrid: boolean
  showOrderBadge: boolean
}
