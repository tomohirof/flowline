import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { BRAND } from '../../constants/brand'
import { useNavigate, Link } from 'react-router-dom'
import { ShareDialog } from './components/ShareDialog'
import { AiAssistant } from './components/AiAssistant'
import { useAuth } from '../../hooks/useAuth'
import { UserMenuPanel } from '../../components/UserMenuPanel'
import { apiFetch } from '../../lib/api'
import styles from './FlowEditor.module.css'
import type {
  Theme,
  ThemeId,
  TaskData,
  RowData,
  InternalLane,
  InternalArrow,
  DragState,
  ArrowPathResult,
  CellInfo,
  Point,
  ToolId,
  SideTool,
  EditorSnapshot,
  Flow,
  FlowSavePayload,
  SaveStatus,
} from './types'
import {
  PALETTES,
  THEMES,
  NODE_COLORS,
  NODE_COLORS_DARK,
  LINE_COLORS,
  STROKE_STYLES,
} from './theme-constants'
import { calcLaneWidth } from './calcLaneWidth'
import { DS } from '../../lib/arrow-routing'
import { useToast } from './hooks/useToast'
import { ToastList } from './components/Toast'
import { useArrows } from './hooks/useArrows'
import { useMoveAutoRepair } from './hooks/useMoveAutoRepair'
import { uid } from '../../lib/uid'
import { computeBridgeArrows } from './auto-connect'
import {
  remapArrows,
  swapKeys,
  filterArrowsByDeletedKeys,
  calcArrowPath,
} from '../../lib/flow-engine'

// =============================================
// Icons
// =============================================

const I: Record<string, ReactNode> = {
  cursor: (
    <path
      d="M4 4l7 7-3 1 2 5-2.5 1-2-5-2.5 2.5z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  ),
  connect: (
    <>
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="12" r="2" fill="currentColor" />
    </>
  ),
  export: (
    <>
      <path
        d="M12 3v12M12 15l-4-4m4 4l4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line
        x1="8"
        y1="11"
        x2="14"
        y2="11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="8"
        x2="11"
        y2="14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="20"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line
        x1="8"
        y1="11"
        x2="14"
        y2="11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="20"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  addRow: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="3"
        y="13"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rmRow: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="3"
        y="13"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="3,2"
      />
    </>
  ),
}

const Ico = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </svg>
)

// =============================================
// Right Panel Sub-Components
// =============================================

const PanelSection = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className={styles.panelSection}>
    {label && <div className={styles.panelSectionLabel}>{label}</div>}
    {children}
  </div>
)

const PanelRow = ({ label, children }: { label: string; children?: ReactNode }) => (
  <div className={styles.panelRow}>
    <span className={styles.panelRowLabel}>{label}</span>
    <div className={styles.panelRowChildren}>{children}</div>
  </div>
)

const PanelInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={styles.panelInput}
  />
)

const PanelBtn = ({
  label,
  color,
  bg,
  onClick,
  full,
}: {
  label: string
  color: string
  bg?: string
  onClick: () => void
  full?: boolean
}) => (
  <button
    onClick={onClick}
    className={`${styles.panelBtn} ${full ? styles.panelBtnFull : styles.panelBtnAuto}`}
    style={{
      border: `1px solid ${color}30`,
      background: bg || `${color}10`,
      color,
    }}
  >
    {label}
  </button>
)

// =============================================
// Helpers: convert API data <-> internal state
// =============================================

function flowToInternalState(flow: Flow): {
  lanes: InternalLane[]
  rows: RowData[]
  tasks: Record<string, TaskData>
  order: string[]
  arrows: InternalArrow[]
  notes: Record<string, string>
  title: string
  themeId: ThemeId
} {
  // Build lanes
  const sortedLanes = [...flow.lanes].sort((a, b) => a.position - b.position)
  const lanes: InternalLane[] = sortedLanes.map((l) => ({
    id: l.id,
    name: l.name,
    ci: l.colorIndex,
  }))

  // Build rows from nodes: collect unique rowIndex values
  const rowIndices = new Set<number>()
  flow.nodes.forEach((n) => rowIndices.add(n.rowIndex))
  // Ensure at least 7 rows
  const maxRow = Math.max(6, ...[...rowIndices])
  const rowCount = rowIndices.size > 0 ? maxRow + 2 : maxRow + 1
  const rows: RowData[] = Array.from({ length: rowCount }, () => ({ id: uid() }))

  // Build task map and order from nodes
  const tasks: Record<string, TaskData> = {}
  const notes: Record<string, string> = {}
  const sortedNodes = [...flow.nodes].sort((a, b) => a.orderIndex - b.orderIndex)

  // We need stable mapping from (laneId, rowIndex) -> row id
  // We use laneId + "_" + rows[rowIndex].id as key
  const nodeIdToKey: Record<string, string> = {}

  sortedNodes.forEach((n) => {
    const ri = n.rowIndex
    if (ri >= 0 && ri < rows.length) {
      const key = `${n.laneId}_${rows[ri].id}`
      tasks[key] = {
        label: n.label,
        lid: n.laneId,
        rid: rows[ri].id,
        nodeId: n.id,
        bg: n.bg || undefined,
        strokeColor: n.strokeColor || undefined,
        dash: n.dash || undefined,
        shape: (n.shape as 'diamond' | undefined) || undefined,
      }
      if (n.note) {
        notes[key] = n.note
      }
      nodeIdToKey[n.id] = key
    }
  })

  const order = sortedNodes
    .map((n) => nodeIdToKey[n.id])
    .filter((k): k is string => k !== undefined)

  // Build arrows
  const arrows: InternalArrow[] = flow.arrows
    .map((a) => {
      const from = nodeIdToKey[a.fromNodeId]
      const to = nodeIdToKey[a.toNodeId]
      if (!from || !to) return null
      const arr: InternalArrow = { id: a.id, from, to, comment: a.comment ?? '' }
      if (a.color) arr.color = a.color
      if (a.dash) arr.dash = a.dash
      return arr
    })
    .filter((a): a is InternalArrow => a !== null)

  const themeId = (Object.keys(THEMES).includes(flow.themeId) ? flow.themeId : 'cloud') as ThemeId

  return { lanes, rows, tasks, order, arrows, notes, title: flow.title, themeId }
}

function internalStateToPayload(
  lanes: InternalLane[],
  rows: RowData[],
  tasks: Record<string, TaskData>,
  order: string[],
  arrows: InternalArrow[],
  notes: Record<string, string>,
  title: string,
  themeId: ThemeId,
): FlowSavePayload {
  // Build API lanes
  const apiLanes = lanes.map((l, i) => ({
    id: l.id,
    name: l.name,
    colorIndex: l.ci,
    position: i,
  }))

  // Build row id -> index map
  const riMap: Record<string, number> = {}
  rows.forEach((r, i) => (riMap[r.id] = i))

  // Build composite key -> stable nodeId map for arrow resolution
  const keyToNodeId: Record<string, string> = {}

  // Build API nodes from task map
  const apiNodes = order
    .filter((k) => tasks[k])
    .map((k, orderIdx) => {
      const task = tasks[k]
      keyToNodeId[k] = task.nodeId
      return {
        id: task.nodeId,
        laneId: task.lid,
        rowIndex: riMap[task.rid] ?? 0,
        label: task.label,
        note: notes[k] || null,
        orderIndex: orderIdx,
        bg: task.bg || null,
        strokeColor: task.strokeColor || null,
        dash: task.dash || null,
        shape: task.shape || null,
      }
    })

  // Build API arrows using stable nodeIds
  const apiArrows = arrows
    .map((a) => {
      const fromNodeId = keyToNodeId[a.from]
      const toNodeId = keyToNodeId[a.to]
      if (!fromNodeId || !toNodeId) return null
      return {
        id: a.id,
        fromNodeId,
        toNodeId,
        comment: a.comment || null,
        color: a.color || null,
        dash: a.dash || null,
      }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  return {
    title,
    themeId,
    lanes: apiLanes,
    nodes: apiNodes,
    arrows: apiArrows,
  }
}

// =============================================
// FlowEditor Component Props
// =============================================

interface FlowEditorProps {
  flow: Flow
  onSave: (payload: FlowSavePayload) => void
  saveStatus: SaveStatus
  onShareChange?: (token: string | null) => void
  onRetrySave?: () => void
}

// =============================================
// FlowEditor Component
// =============================================

export default function FlowEditor({
  flow,
  onSave,
  saveStatus,
  onShareChange,
  onRetrySave,
}: FlowEditorProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  // Initialize state from flow data (lazy initialization to avoid recomputing on every render)
  const [initState] = useState(() => flowToInternalState(flow))
  const [lanes, setLanes] = useState<InternalLane[]>(initState.lanes)
  const [rows, setRows] = useState<RowData[]>(initState.rows)
  const [tasks, setTasks] = useState<Record<string, TaskData>>(initState.tasks)
  const [order, setOrder] = useState<string[]>(initState.order)
  const [notes, setNotes] = useState<Record<string, string>>(initState.notes)

  const [editing, setEditing] = useState<string | null>(null)
  const [editLane, setEditLane] = useState<string | null>(null)
  const [selTask, setSelTask] = useState<string | null>(null)
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [selArrow, setSelArrow] = useState<string | null>(null)
  const [editArrowComment, setEditArrowComment] = useState<string | null>(null)
  const [selLane, setSelLane] = useState<string | null>(null)
  const [editNote, setEditNote] = useState<string | null>(null)
  const [showExport, setShowExport] = useState<boolean>(false)
  const [title, setTitle] = useState<string>(initState.title)
  const [editTitle, setEditTitle] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredLaneGap, setHoveredLaneGap] = useState<number | null>(null)
  const [hoveredRowGap, setHoveredRowGap] = useState<number | null>(null)
  const [ghostCell, setGhostCell] = useState<{
    li: number
    ri: number
    lid: string
    rid: string
  } | null>(null)
  const [ghostRowGap, setGhostRowGap] = useState<number | null>(null)
  const [bouncingNode, setBouncingNode] = useState<string | null>(null)
  const [hoveredRowNum, setHoveredRowNum] = useState<number | null>(null)
  const [rowAnim, setRowAnim] = useState<{ type: 'add' | 'delete'; index: number } | null>(null)
  const [mermaidCopied, setMermaidCopied] = useState<boolean>(false)
  const mermaidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bouncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    toasts,
    addConfirmToast,
    addSuccessToast,
    addErrorToast,
    dismissToast,
    dismissToastByType,
    confirmToast,
  } = useToast()

  // Show/dismiss error toast based on saveStatus
  useEffect(() => {
    if (saveStatus === 'error') {
      addErrorToast({
        message: '保存に失敗しました',
        detail: '変更内容が保存されていません。ネットワーク接続を確認してください。',
        onRetry: onRetrySave,
      })
    } else {
      dismissToastByType('error')
    }
  }, [saveStatus, addErrorToast, dismissToastByType, onRetrySave])
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [connectDragPt, setConnectDragPt] = useState<Point | null>(null)
  const [connectFromPt, setConnectFromPt] = useState<Point | null>(null)
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId | string>('select')
  const [themeId, setThemeId] = useState<ThemeId>(initState.themeId)
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false)
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false)
  const [shareToken, setShareToken] = useState<string | null>(flow.shareToken)
  const [editorSettings, setEditorSettings] = useState<{
    copyLabelOnSameRow: boolean
    autoConnect: boolean
    autoAddRow: boolean
    enterEditOnCreate: boolean
    showDotGrid: boolean
    showOrderBadge: boolean
  }>({
    copyLabelOnSameRow: false,
    autoConnect: true,
    autoAddRow: true,
    enterEditOnCreate: true,
    showDotGrid: true,
    showOrderBadge: true,
  })

  const { arrows, setArrows, setRecentInsertedRow, autoConnectOnCreate, detectCrossing } =
    useArrows({
      initialArrows: initState.arrows,
      tasks,
      rows,
      lanes,
      autoConnect: editorSettings.autoConnect,
    })

  const { triggerMoveRepairCheck, repairPreview, clearRepairPreview } = useMoveAutoRepair({
    arrows,
    setArrows,
    tasks,
    rows,
    addConfirmToast,
  })

  const fullSettingsRef = useRef<Record<string, unknown>>({})
  const settingsLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ settings: Record<string, unknown> }>('/settings')
      .then((data) => {
        if (!cancelled) {
          fullSettingsRef.current = data.settings
          settingsLoadedRef.current = true
          setEditorSettings((prev) => ({
            ...prev,
            ...(typeof data.settings.copyLabelOnSameRow === 'boolean' && {
              copyLabelOnSameRow: data.settings.copyLabelOnSameRow,
            }),
            ...(typeof data.settings.autoConnect === 'boolean' && {
              autoConnect: data.settings.autoConnect,
            }),
            ...(typeof data.settings.autoAddRow === 'boolean' && {
              autoAddRow: data.settings.autoAddRow,
            }),
            ...(typeof data.settings.enterEditOnCreate === 'boolean' && {
              enterEditOnCreate: data.settings.enterEditOnCreate,
            }),
            ...(typeof data.settings.showDotGrid === 'boolean' && {
              showDotGrid: data.settings.showDotGrid,
            }),
            ...(typeof data.settings.showOrderBadge === 'boolean' && {
              showOrderBadge: data.settings.showOrderBadge,
            }),
          }))
        }
      })
      .catch(() => {
        // API失敗時はデフォルト値のまま
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (mermaidTimerRef.current) clearTimeout(mermaidTimerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (rowAnimTimerRef.current) clearTimeout(rowAnimTimerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (bouncingTimerRef.current) clearTimeout(bouncingTimerRef.current)
    }
  }, [])

  const updateEditorSetting = useCallback((key: string, value: boolean) => {
    setEditorSettings((prev) => ({ ...prev, [key]: value }))
    if (!settingsLoadedRef.current) return
    const merged = { ...fullSettingsRef.current, [key]: value }
    fullSettingsRef.current = merged
    apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(merged),
    }).catch(() => {
      // 保存失敗は無視（UIは即時反映）
    })
  }, [])

  const inputRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // --- Notify parent of changes ---
  const prevStructSnapRef = useRef<string>('')
  const prevMetaSnapRef = useRef<string>('')

  const buildPayload = useCallback((): FlowSavePayload => {
    return internalStateToPayload(lanes, rows, tasks, order, arrows, notes, title, themeId)
  }, [lanes, rows, tasks, order, arrows, notes, title, themeId])

  // Re-initialize when flow prop changes (render-time state adjustment)
  const [prevFlowId, setPrevFlowId] = useState(flow.id)
  if (flow.id !== prevFlowId) {
    setPrevFlowId(flow.id)
    const state = flowToInternalState(flow)
    setLanes(state.lanes)
    setRows(state.rows)
    setTasks(state.tasks)
    setOrder(state.order)
    setArrows(state.arrows)
    setNotes(state.notes)
    setTitle(state.title)
    setThemeId(state.themeId)
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
    setEditing(null)
  }

  // Reset snapshot refs when flow changes (must be declared BEFORE auto-save effect)
  useEffect(() => {
    prevStructSnapRef.current = ''
    prevMetaSnapRef.current = ''
  }, [prevFlowId])

  useEffect(() => {
    const structSnap = JSON.stringify({ tasks, order, arrows, notes, lanes, rows })
    const metaSnap = JSON.stringify({ title, themeId })

    const structChanged =
      prevStructSnapRef.current !== '' && prevStructSnapRef.current !== structSnap
    const metaChanged = prevMetaSnapRef.current !== '' && prevMetaSnapRef.current !== metaSnap

    if (structChanged) {
      onSave(buildPayload())
    } else if (metaChanged) {
      onSave({ title, themeId })
    }

    prevStructSnapRef.current = structSnap
    prevMetaSnapRef.current = metaSnap
  }, [tasks, order, arrows, notes, lanes, rows, title, themeId, onSave, buildPayload])

  // --- Undo / Redo ---
  const historyRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const skipSnap = useRef<boolean>(false)

  const snap = useCallback(
    (): string =>
      JSON.stringify({
        tasks,
        order,
        arrows,
        notes,
        lanes: lanes.map((l) => ({ ...l })),
        rows: rows.map((r) => ({ ...r })),
      }),
    [tasks, order, arrows, notes, lanes, rows],
  )

  // Save snapshot before each meaningful change
  const undoPrevSnap = useRef<string | null>(null)
  useEffect(() => {
    const s = snap()
    if (undoPrevSnap.current && undoPrevSnap.current !== s) {
      historyRef.current = [...historyRef.current.slice(-60), undoPrevSnap.current]
      futureRef.current = []
    }
    undoPrevSnap.current = s
  }, [snap])

  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize((prev) => {
        if (prev.width === width && prev.height === height) return prev
        return { width, height }
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const applySnap = useCallback(
    (s: string): void => {
      const d: EditorSnapshot = JSON.parse(s)
      skipSnap.current = true
      setTasks(d.tasks)
      setOrder(d.order)
      setArrows(d.arrows)
      setNotes(d.notes)
      setLanes(d.lanes)
      setRows(d.rows)
      setSelTask(null)
      setSelArrow(null)
      setSelLane(null)
      setMultiSel(new Set())
      setEditing(null)
      undoPrevSnap.current = s
    },
    [setArrows],
  )

  const undo = useCallback((): void => {
    if (historyRef.current.length === 0) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, snap()]
    applySnap(prev)
  }, [snap, applySnap])

  const redo = useCallback((): void => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    historyRef.current = [...historyRef.current, snap()]
    applySnap(next)
  }, [snap, applySnap])

  const T = THEMES[themeId]
  const RH = 84,
    HH = 46,
    TW = 152,
    TH = 56,
    LM = 28,
    TM = 24,
    G = T.laneGap
  const LW = calcLaneWidth(containerSize.width, lanes.length, LM, G)
  const totalW = LM + lanes.length * LW + (lanes.length - 1) * G + 28
  const totalH = TM + HH + rows.length * RH + 40
  const svgW = Math.max(containerSize.width, (totalW + LM) * zoom)
  const svgH = Math.max(containerSize.height, (totalH + 30 + TM) * zoom)
  const ky = (lid: string, rid: string): string => `${lid}_${rid}`
  const liMap: Record<string, number> = {}
  lanes.forEach((l, i) => (liMap[l.id] = i))
  const riMap: Record<string, number> = {}
  rows.forEach((r, i) => (riMap[r.id] = i))
  const laneX = useCallback((li: number): number => LM + li * (LW + G), [LW, G])
  const ct = useCallback(
    (li: number, ri: number): Point => ({ x: laneX(li) + LW / 2, y: TM + HH + ri * RH + RH / 2 }),
    [laneX, LW],
  )
  const isDark = themeId === 'midnight'

  const delTask = useCallback(
    (k: string): void => {
      const bridges = computeBridgeArrows(new Set([k]), arrows)
      setTasks((p) => {
        const n = { ...p }
        delete n[k]
        return n
      })
      setNotes((p) => {
        const n = { ...p }
        delete n[k]
        return n
      })
      setOrder((p) => p.filter((x) => x !== k))
      setArrows((p) => [
        ...p.filter((a) => a.from !== k && a.to !== k),
        ...bridges.map((b) => ({ ...b, id: uid() })),
      ])
      setEditing(null)
      setSelTask(null)
      if (bridges.length > 0) {
        addSuccessToast({ message: `オートリペア: ${bridges.length}本の矢印を修復しました` })
      }
    },
    [arrows, setArrows, addSuccessToast],
  )

  const delMultiSel = useCallback((): void => {
    const bridges = computeBridgeArrows(multiSel, arrows)
    setTasks((p) => {
      const n = { ...p }
      multiSel.forEach((k) => delete n[k])
      return n
    })
    setNotes((p) => {
      const n = { ...p }
      multiSel.forEach((k) => delete n[k])
      return n
    })
    setOrder((p) => p.filter((x) => !multiSel.has(x)))
    setArrows((p) => [
      ...p.filter((a) => !multiSel.has(a.from) && !multiSel.has(a.to)),
      ...bridges.map((b) => ({ ...b, id: uid() })),
    ])
    if (bridges.length > 0) {
      addSuccessToast({ message: `オートリペア: ${bridges.length}本の矢印を修復しました` })
    }
    setMultiSel(new Set())
  }, [multiSel, arrows, setArrows, addSuccessToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z or Cmd+Y / Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          editing ||
          editLane ||
          editTitle ||
          editNote ||
          (document.activeElement as HTMLElement)?.tagName === 'INPUT'
        )
          return
        if (multiSel.size > 0) {
          delMultiSel()
          e.preventDefault()
        } else if (selArrow) {
          setArrows((p) => p.filter((a) => a.id !== selArrow))
          setSelArrow(null)
          e.preventDefault()
        } else if (selTask) {
          delTask(selTask)
          e.preventDefault()
        }
      }
      if (e.key === 'Escape') {
        setConnectFrom(null)
        setConnectDragPt(null)
        setConnectFromPt(null)
        setSelTask(null)
        setSelArrow(null)
        setEditArrowComment(null)
        setSelLane(null)
        setMultiSel(new Set())
        setDragging(null)
        setDragOver(null)
        setActiveTool('select')
        setShowThemePicker(false)
        setGhostCell(null)
        setGhostRowGap(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    selArrow,
    selTask,
    editing,
    editLane,
    editTitle,
    editNote,
    undo,
    redo,
    multiSel,
    delTask,
    delMultiSel,
    setArrows,
  ])

  const moveLane = (id: string, dir: number): void => {
    setLanes((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      const ni = idx + dir
      if (ni < 0 || ni >= prev.length) return prev
      const n = [...prev]
      ;[n[idx], n[ni]] = [n[ni], n[idx]]
      return n
    })
  }
  const insertLaneAt = (i: number): void => {
    setLanes((prev) => {
      const n = [...prev]
      n.splice(i, 0, { id: uid(), name: `レーン${prev.length + 1}`, ci: i % PALETTES.length })
      return n
    })
    setHoveredLaneGap(null)
  }
  const insertRowAt = (i: number): void => {
    if (rowAnim) return
    if (ghostRowGap === i) {
      // 2クリック目 — 確定
      setGhostRowGap(null)
    } else {
      // 1クリック目 — ゴースト表示のみ
      setGhostRowGap(i)
      setGhostCell(null)
      return
    }
    const newRowId = uid()
    setRows((prev) => {
      const n = [...prev]
      n.splice(i, 0, { id: newRowId })
      return n
    })
    setHoveredRowGap(null)
    setRecentInsertedRow({ rowId: newRowId })
    setRowAnim({ type: 'add', index: i })
    rowAnimTimerRef.current = setTimeout(() => setRowAnim(null), 700)
  }
  const rmRowAt = (ri: number): void => {
    if (rows.length <= 1 || rowAnim) return
    const row = rows[ri]
    const hasNodes = Object.values(tasks).some((t) => t.rid === row.id)
    if (hasNodes) return
    setHoveredRowNum(null)
    setRowAnim({ type: 'delete', index: ri })
    rowAnimTimerRef.current = setTimeout(() => {
      setRows((p) => p.filter((_, i) => i !== ri))
      setRowAnim(null)
    }, 450)
  }
  const cellFromPos = (sx: number, sy: number): CellInfo | null => {
    for (let li = 0; li < lanes.length; li++)
      for (let ri = 0; ri < rows.length; ri++) {
        const cx = laneX(li),
          cy = TM + HH + ri * RH
        if (sx >= cx && sx < cx + LW && sy >= cy && sy < cy + RH)
          return { lid: lanes[li].id, rid: rows[ri].id, li, ri, key: ky(lanes[li].id, rows[ri].id) }
      }
    return null
  }
  const svgPt = (cx: number, cy: number): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom }
  }
  const onDragStart = (k: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    if (connectFrom || editing) return
    setDragging({ key: k })
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
    setMultiSel(new Set())
  }
  const startConnectDrag = (k: string, hx: number, hy: number, e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    setConnectFrom(k)
    setConnectFromPt({ x: hx, y: hy })
    setConnectDragPt({ x: hx, y: hy })
    setSelTask(null)
    setActiveTool('connect')
  }
  const onSvgMouseMove = (e: React.MouseEvent): void => {
    const pt = svgPt(e.clientX, e.clientY)
    if (connectFrom) {
      setConnectDragPt(pt)
      return
    }
    if (!dragging) return
    const cell = cellFromPos(pt.x, pt.y)
    if (cell && cell.key !== dragging.key) {
      const tgt = tasks[cell.key]
      const src = tasks[dragging.key]
      // 空セル or 同一レーンのノード → ドロップ許可
      if (!tgt || (tgt && src && tgt.lid === src.lid)) {
        setDragOver(cell.key)
      } else {
        setDragOver(null)
      }
    } else {
      setDragOver(null)
    }
  }
  const onSvgMouseUp = (e: React.MouseEvent): void => {
    if (connectFrom) {
      const pt = svgPt(e.clientX, e.clientY)
      for (const k of Object.keys(tasks)) {
        const t = tasks[k],
          li = liMap[t.lid],
          ri = riMap[t.rid]
        if (li === undefined || ri === undefined) continue
        const c = ct(li, ri)
        const isDia = t.shape === 'diamond'
        const snapX = isDia ? DS + 12 : TW / 2 + 12
        const snapY = isDia ? DS + 12 : TH / 2 + 12
        if (Math.abs(pt.x - c.x) < snapX && Math.abs(pt.y - c.y) < snapY && k !== connectFrom) {
          setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
          break
        }
      }
      setConnectFrom(null)
      setConnectDragPt(null)
      setConnectFromPt(null)
      setActiveTool('select')
      return
    }
    if (!dragging) return
    if (dragOver) {
      if (tasks[dragOver]) {
        swapInsertNodes(dragging.key, dragOver)
      } else {
        for (let li = 0; li < lanes.length; li++)
          for (let ri = 0; ri < rows.length; ri++)
            if (ky(lanes[li].id, rows[ri].id) === dragOver) {
              moveTask(dragging.key, { lid: lanes[li].id, rid: rows[ri].id, key: dragOver, li, ri })
              setDragging(null)
              setDragOver(null)
              return
            }
      }
    }
    setDragging(null)
    setDragOver(null)
  }
  const moveTask = (
    fk: string,
    to: { lid: string; rid: string; key: string; li: number; ri: number },
  ): void => {
    const task = tasks[fk]
    if (!task) return
    const nk = to.key
    setTasks((p) => {
      const n = { ...p }
      delete n[fk]
      n[nk] = { ...task, lid: to.lid, rid: to.rid }
      return n
    })
    if (notes[fk])
      setNotes((p) => {
        const n = { ...p }
        n[nk] = n[fk]
        delete n[fk]
        return n
      })
    setOrder((p) => p.map((k) => (k === fk ? nk : k)))
    setArrows((p) => remapArrows(p, fk, nk))
    setSelTask(nk)
    const ri = rows.findIndex((r) => r.id === to.rid)
    if (ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
    triggerMoveRepairCheck(nk, to.lid)
  }
  const swapInsertNodes = (draggedKey: string, targetKey: string): void => {
    const result = swapKeys(tasks, arrows, order, notes, draggedKey, targetKey)
    if (!result) return
    setTasks(result.tasks)
    setNotes(result.notes)
    setOrder(result.order)
    setArrows(result.arrows)
    setSelTask(result.newKeyA)
    triggerMoveRepairCheck(result.newKeyA, tasks[draggedKey].lid)
  }
  const cellClick = (lid: string, rid: string, _li: number, ri: number): void => {
    if (editArrowComment) {
      setEditArrowComment(null)
      return
    }
    const k = ky(lid, rid)
    if (connectFrom) {
      if (k !== connectFrom && tasks[k])
        setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
      setConnectFrom(null)
      setActiveTool('select')
      return
    }
    setMultiSel(new Set())
    if (tasks[k]) {
      setEditing(k)
      setSelArrow(null)
      setTimeout(() => inputRef.current?.focus(), 40)
      return
    }
    // -- 2クリック確認UX: ゴーストチェック --
    const li = lanes.findIndex((l) => l.id === lid)
    if (ghostCell && ghostCell.li === li && ghostCell.ri === ri) {
      // 2クリック目 — 確定
      setGhostCell(null)
    } else {
      // 1クリック目 — ゴースト表示のみ
      setGhostCell({ li, ri, lid, rid })
      setGhostRowGap(null)
      return
    }
    let label = '作業'
    if (editorSettings.copyLabelOnSameRow) {
      const sameRowNode = Object.entries(tasks).find(([key, t]) => t.rid === rid && key !== k)
      if (sameRowNode) label = sameRowNode[1].label
    }
    setTasks((p) => ({ ...p, [k]: { label, lid, rid, nodeId: uid() } }))
    const no = [...order, k]
    setOrder(no)
    autoConnectOnCreate(k, ri, li)
    detectCrossing(rid, k, label, addConfirmToast)
    setSelArrow(null)
    setBouncingNode(k)
    if (bouncingTimerRef.current) clearTimeout(bouncingTimerRef.current)
    bouncingTimerRef.current = setTimeout(() => setBouncingNode(null), 400)
    if (editorSettings.enterEditOnCreate) {
      setEditing(k)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
    if (editorSettings.autoAddRow && ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
  }
  const taskClick = (k: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    if (connectFrom) {
      if (k !== connectFrom)
        setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
      setConnectFrom(null)
      setActiveTool('select')
      return
    }
    if (e.shiftKey) {
      setMultiSel((prev) => {
        const next = new Set(prev)
        if (selTask && prev.size === 0) next.add(selTask)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        return next
      })
      setSelTask(null)
      setSelArrow(null)
      setSelLane(null)
    } else {
      setMultiSel(new Set())
      setSelTask(selTask === k ? null : k)
      setSelArrow(null)
      setSelLane(null)
    }
  }
  const startConnect = (k: string): void => {
    setConnectFrom(k)
    setSelTask(null)
    setActiveTool('connect')
  }
  const addRow = (): void => setRows((p) => [...p, { id: uid() }])
  const rmRow = (): void => {
    if (rows.length <= 1) return
    const last = rows[rows.length - 1]
    setRows((p) => p.slice(0, -1))
    const rm = Object.keys(tasks).filter((x) => x.includes(last.id))
    if (rm.length) {
      setTasks((p) => {
        const n = { ...p }
        rm.forEach((x) => delete n[x])
        return n
      })
      setOrder((p) => p.filter((x) => !rm.includes(x)))
      setArrows((p) => filterArrowsByDeletedKeys(p, new Set(rm)))
    }
  }
  const rmLane = (id: string): void => {
    if (lanes.length <= 1) return
    setLanes((p) => p.filter((l) => l.id !== id))
    if (selLane === id) setSelLane(null)
    const rm = Object.keys(tasks).filter((x) => x.startsWith(id))
    if (rm.length) {
      setTasks((p) => {
        const n = { ...p }
        rm.forEach((x) => delete n[x])
        return n
      })
      setOrder((p) => p.filter((x) => !rm.includes(x)))
      setArrows((p) => filterArrowsByDeletedKeys(p, new Set(rm)))
    }
  }

  const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
    const ft = tasks[arrow.from],
      tt = tasks[arrow.to]
    if (!ft || !tt) return null
    const fli = liMap[ft.lid],
      fri = riMap[ft.rid],
      tli = liMap[tt.lid],
      tri = riMap[tt.rid]
    if ([fli, fri, tli, tri].some((v) => v === undefined)) return null
    const from = ct(fli, fri)
    const to = ct(tli, tri)
    return calcArrowPath(from, to, {
      hw: TW / 2,
      hh: TH / 2,
      rh: RH,
      fromShape: ft.shape ?? undefined,
      toShape: tt.shape ?? undefined,
    })
  }

  const exportMermaid = (): string => {
    // Collect all task entries with their row index for sorting
    const taskEntries: { key: string; task: TaskData; rowIdx: number }[] = []
    for (const key of order) {
      const t = tasks[key]
      if (!t) continue
      const ri = rows.findIndex((r) => r.id === t.rid)
      taskEntries.push({ key, task: t, rowIdx: ri >= 0 ? ri : Infinity })
    }
    // Also include any tasks not in order
    const includedKeys = new Set(taskEntries.map((e) => e.key))
    Object.keys(tasks).forEach((key) => {
      if (!includedKeys.has(key)) {
        const t = tasks[key]
        const ri = rows.findIndex((r) => r.id === t.rid)
        taskEntries.push({ key, task: t, rowIdx: ri >= 0 ? ri : Infinity })
      }
    })
    // Sort by rowIdx then by lane position
    taskEntries.sort((a, b) => {
      if (a.rowIdx !== b.rowIdx) return a.rowIdx - b.rowIdx
      const aLi = lanes.findIndex((l) => l.id === a.task.lid)
      const bLi = lanes.findIndex((l) => l.id === b.task.lid)
      return aLi - bLi
    })

    // Assign sequential Mermaid-safe node IDs
    const nodeIdMap = new Map<string, string>()
    taskEntries.forEach((e, i) => {
      nodeIdMap.set(e.key, `n${i + 1}`)
    })

    // Lane name lookup
    const laneNameMap = new Map<string, string>()
    lanes.forEach((l) => laneNameMap.set(l.id, l.name))

    // Escape helper for Mermaid labels
    const esc = (s: string): string =>
      s
        .replace(/"/g, '#quot;')
        .replace(/\[/g, '#lsqb;')
        .replace(/\]/g, '#rsqb;')
        .replace(/\|/g, '#vert;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, ' ')

    let m = '%% Flowlineスイムレーンの近似出力です\nflowchart LR\n'

    // Group tasks by row and output subgraphs
    const rowGroups = new Map<number, typeof taskEntries>()
    taskEntries.forEach((e) => {
      const group = rowGroups.get(e.rowIdx) || []
      group.push(e)
      rowGroups.set(e.rowIdx, group)
    })

    const sortedRowIndices = [...rowGroups.keys()].sort((a, b) => a - b)
    sortedRowIndices.forEach((ri, i) => {
      const group = rowGroups.get(ri)!
      m += `    subgraph row${i + 1}[" "]\n`
      group.forEach((e) => {
        const nid = nodeIdMap.get(e.key)!
        const laneName = laneNameMap.get(e.task.lid) || ''
        m += `        ${nid}["${esc(e.task.label)}<br><small>${esc(laneName)}</small>"]\n`
      })
      m += '    end\n'
    })

    // Output connections
    m += '\n'
    arrows.forEach((a) => {
      const fromId = nodeIdMap.get(a.from)
      const toId = nodeIdMap.get(a.to)
      if (!fromId || !toId) return
      if (a.comment) {
        m += `    ${fromId} -->|${esc(a.comment)}| ${toId}\n`
      } else {
        m += `    ${fromId} --> ${toId}\n`
      }
    })

    return m
  }

  const bgClick = (): void => {
    setGhostCell(null)
    setGhostRowGap(null)
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
    setMultiSel(new Set())
    setEditArrowComment(null)
    setShowThemePicker(false)
    if (connectFrom) {
      setConnectFrom(null)
      setConnectDragPt(null)
      setConnectFromPt(null)
      setActiveTool('select')
    }
  }
  const arrowPaths = arrows
    .map((a) => ({ arrow: a, path: aPath(a) }))
    .filter((x): x is { arrow: InternalArrow; path: ArrowPathResult } => x.path !== null)

  // --- Determine right panel content ---
  const selTaskData = selTask ? tasks[selTask] : null
  const selArrowData = selArrow ? arrows.find((a) => a.id === selArrow) : null
  const selLaneData = selLane ? lanes.find((l) => l.id === selLane) : null

  const sideTools: (SideTool | 'sep')[] = [
    { id: 'select', icon: I.cursor, tip: '選択' },
    { id: 'connect', icon: I.connect, tip: '接続' },
    'sep',
    { id: 'addRow', icon: I.addRow, tip: '行追加', action: addRow },
    { id: 'rmRow', icon: I.rmRow, tip: '行削除', action: rmRow },
    'sep',
    {
      id: 'zoomIn',
      icon: I.zoomIn,
      tip: '拡大',
      action: () => setZoom((z) => Math.min(2, z + 0.1)),
    },
    {
      id: 'zoomOut',
      icon: I.zoomOut,
      tip: '縮小',
      action: () => setZoom((z) => Math.max(0.4, z - 0.1)),
    },
    'sep',
    { id: 'export', icon: I.export, tip: 'Export', action: () => setShowExport((v) => !v) },
  ]

  // --- Status bar text ---
  const saveStatusText: Record<SaveStatus, string> = {
    saved: '保存済み',
    saving: '保存中...',
    unsaved: '未保存',
    error: '保存エラー',
  }

  // --- Right Panel ---
  const renderRightPanel = (): ReactNode => {
    // Multiple nodes selected
    if (multiSel.size > 0) {
      return (
        <>
          <PanelSection label="">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={styles.multiSelBadge}>{multiSel.size}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.panelText }}>
                ノード選択中
              </span>
            </div>
            <span style={{ fontSize: 10, color: T.panelLabel }}>
              Shift+クリックで追加/解除 · Delete で一括削除
            </span>
          </PanelSection>
          <PanelSection label="背景色">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(isDark ? NODE_COLORS_DARK : NODE_COLORS).map((nc) => (
                <div
                  key={nc.id}
                  onClick={() =>
                    setTasks((p) => {
                      const n = { ...p }
                      multiSel.forEach((k) => {
                        if (n[k]) n[k] = { ...n[k], bg: nc.fill || undefined }
                      })
                      return n
                    })
                  }
                  title={nc.label}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: nc.fill || T.nodeFill,
                    border: `1.5px solid ${nc.dot}`,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {nc.fill === null && (
                    <span style={{ fontSize: 10, color: T.panelLabel }}>&#x2298;</span>
                  )}
                </div>
              ))}
            </div>
          </PanelSection>
          <PanelSection label="枠の色">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LINE_COLORS.map((lc) => (
                <div
                  key={lc.id}
                  onClick={() =>
                    setTasks((p) => {
                      const n = { ...p }
                      multiSel.forEach((k) => {
                        if (n[k]) n[k] = { ...n[k], strokeColor: lc.color || undefined }
                      })
                      return n
                    })
                  }
                  title={lc.label}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: T.nodeFill,
                    border: `2px solid ${lc.color || T.nodeStroke}`,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {lc.color === null && (
                    <span style={{ fontSize: 10, color: T.panelLabel }}>&#x2298;</span>
                  )}
                </div>
              ))}
            </div>
          </PanelSection>
          <PanelSection label="枠の種類">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {STROKE_STYLES.map((ss) => (
                <div
                  key={ss.id}
                  onClick={() =>
                    setTasks((p) => {
                      const n = { ...p }
                      multiSel.forEach((k) => {
                        if (n[k]) n[k] = { ...n[k], dash: ss.dash === 'none' ? undefined : ss.dash }
                      })
                      return n
                    })
                  }
                  title={ss.label}
                  style={{
                    flex: 1,
                    minWidth: 42,
                    height: 30,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: `1px solid ${T.inputBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                >
                  <svg width="32" height="2" viewBox="0 0 32 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="32"
                      y2="1"
                      stroke={T.panelText}
                      strokeWidth="2"
                      strokeDasharray={ss.dash}
                    />
                  </svg>
                </div>
              ))}
            </div>
          </PanelSection>
          <PanelSection label="操作">
            <button
              className={styles.dangerBtn}
              onClick={() => delMultiSel()}
              data-testid="multi-delete-btn"
            >
              {multiSel.size}件を削除
            </button>
            <button
              className={styles.panelBtn}
              onClick={() => setMultiSel(new Set())}
              style={{ marginTop: 6 }}
              data-testid="multi-deselect-btn"
            >
              選択解除
            </button>
          </PanelSection>
        </>
      )
    }
    // Node selected
    if (selTask && selTaskData) {
      const lane = lanes.find((l) => l.id === selTaskData.lid)
      const oi = order.indexOf(selTask)
      return (
        <>
          <PanelSection label="ノード">
            <PanelRow label="ラベル" />
            <PanelInput
              value={selTaskData.label === '作業' ? '' : selTaskData.label}
              placeholder="作業"
              onChange={(v: string) =>
                setTasks((p2) => ({ ...p2, [selTask]: { ...p2[selTask], label: v || '作業' } }))
              }
            />
          </PanelSection>
          <PanelSection label="形状">
            <div style={{ display: 'flex', gap: 4 }}>
              {(
                [
                  {
                    shape: undefined as 'diamond' | undefined,
                    label: '矩形',
                    icon: (active: boolean) => (
                      <svg width="20" height="14" viewBox="0 0 20 14">
                        <rect
                          x="1"
                          y="1"
                          width="18"
                          height="12"
                          rx="3"
                          fill="none"
                          stroke={active ? T.accent : T.panelLabel}
                          strokeWidth="1.5"
                        />
                      </svg>
                    ),
                  },
                  {
                    shape: 'diamond' as const,
                    label: '分岐',
                    icon: (active: boolean) => (
                      <svg width="20" height="20" viewBox="0 0 20 20">
                        <polygon
                          points="10,1 19,10 10,19 1,10"
                          fill="none"
                          stroke={active ? T.accent : T.panelLabel}
                          strokeWidth="1.5"
                        />
                      </svg>
                    ),
                  },
                ] as const
              ).map((s) => {
                const isActive = (s.shape || undefined) === (selTaskData.shape || undefined)
                return (
                  <div
                    key={s.label}
                    onClick={() =>
                      setTasks((p2) => ({ ...p2, [selTask]: { ...p2[selTask], shape: s.shape } }))
                    }
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      height: 32,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? `${T.accent}15` : 'transparent',
                      border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.icon(isActive)}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? T.accent : T.panelLabel,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="メモ">
            <PanelInput
              value={notes[selTask] || ''}
              placeholder="メモを追加…"
              onChange={(v: string) => setNotes((p2) => ({ ...p2, [selTask]: v }))}
            />
          </PanelSection>
          <PanelSection label="背景色">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(isDark ? NODE_COLORS_DARK : NODE_COLORS).map((nc) => {
                const isActive = nc.fill === null ? !selTaskData.bg : selTaskData.bg === nc.fill
                return (
                  <div
                    key={nc.id}
                    onClick={() =>
                      setTasks((p2) => ({
                        ...p2,
                        [selTask]: { ...p2[selTask], bg: nc.fill || undefined },
                      }))
                    }
                    title={nc.label}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: nc.fill || T.nodeFill,
                      border: isActive ? `2px solid ${T.accent}` : `1.5px solid ${nc.dot}`,
                      transition: 'all 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {nc.fill === null && (
                      <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>
                    )}
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="枠の色">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LINE_COLORS.map((lc) => {
                const isActive =
                  lc.color === null
                    ? !selTaskData.strokeColor
                    : selTaskData.strokeColor === lc.color
                return (
                  <div
                    key={lc.id}
                    onClick={() =>
                      setTasks((p2) => ({
                        ...p2,
                        [selTask]: { ...p2[selTask], strokeColor: lc.color || undefined },
                      }))
                    }
                    title={lc.label}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: T.nodeFill,
                      border: isActive
                        ? `2px solid ${T.accent}`
                        : `2px solid ${lc.color || T.nodeStroke}`,
                      transition: 'all 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {lc.color === null && (
                      <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>
                    )}
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="枠の種類">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {STROKE_STYLES.map((ss) => {
                const isActive =
                  ss.dash === 'none' ? !selTaskData.dash : selTaskData.dash === ss.dash
                return (
                  <div
                    key={ss.id}
                    onClick={() =>
                      setTasks((p2) => ({
                        ...p2,
                        [selTask]: {
                          ...p2[selTask],
                          dash: ss.dash === 'none' ? undefined : ss.dash,
                        },
                      }))
                    }
                    title={ss.label}
                    style={{
                      flex: 1,
                      minWidth: 42,
                      height: 30,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? (isDark ? '#333' : '#F0EBFF') : 'transparent',
                      border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}
                  >
                    <svg width="32" height="2" viewBox="0 0 32 2">
                      <line
                        x1="0"
                        y1="1"
                        x2="32"
                        y2="1"
                        stroke={isActive ? T.accent : T.panelText}
                        strokeWidth="2"
                        strokeDasharray={ss.dash}
                      />
                    </svg>
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="情報">
            <PanelRow label="レーン">
              <span className={styles.panelValueText}>{lane?.name}</span>
            </PanelRow>
            {oi !== -1 && (
              <PanelRow label="順番">
                <span className={styles.panelValueText}>{oi + 1}</span>
              </PanelRow>
            )}
          </PanelSection>
          <PanelSection label="操作">
            <div className={styles.panelActions}>
              <PanelBtn label="→ 接続" color={T.accent} onClick={() => startConnect(selTask)} />
              <PanelBtn label="削除" color="#E06060" onClick={() => delTask(selTask)} />
            </div>
          </PanelSection>
        </>
      )
    }

    // Arrow selected
    if (selArrow && selArrowData) {
      const fromT = tasks[selArrowData.from],
        toT = tasks[selArrowData.to]
      return (
        <>
          <PanelSection label="接続線">
            <PanelRow label="From">
              <span className={styles.panelValueText}>{fromT?.label || '?'}</span>
            </PanelRow>
            <PanelRow label="To">
              <span className={styles.panelValueText}>{toT?.label || '?'}</span>
            </PanelRow>
          </PanelSection>
          <PanelSection label="コメント">
            <PanelInput
              value={selArrowData.comment || ''}
              placeholder="ラベルを追加…"
              onChange={(v: string) =>
                setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, comment: v } : a)))
              }
            />
          </PanelSection>
          <PanelSection label="線の色">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LINE_COLORS.map((lc) => {
                const isActive =
                  lc.color === null ? !selArrowData.color : selArrowData.color === lc.color
                return (
                  <div
                    key={lc.id}
                    onClick={() =>
                      setArrows((p) =>
                        p.map((a) =>
                          a.id === selArrow ? { ...a, color: lc.color || undefined } : a,
                        ),
                      )
                    }
                    title={lc.label}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: T.nodeFill,
                      border: isActive
                        ? `2px solid ${T.accent}`
                        : `2px solid ${lc.color || T.arrowColor}`,
                      transition: 'all 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {lc.color && (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background: lc.color,
                        }}
                      />
                    )}
                    {lc.color === null && (
                      <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>
                    )}
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="線の種類">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {STROKE_STYLES.map((ss) => {
                const isActive =
                  ss.dash === 'none' ? !selArrowData.dash : selArrowData.dash === ss.dash
                return (
                  <div
                    key={ss.id}
                    onClick={() =>
                      setArrows((p) =>
                        p.map((a) =>
                          a.id === selArrow
                            ? { ...a, dash: ss.dash === 'none' ? undefined : ss.dash }
                            : a,
                        ),
                      )
                    }
                    title={ss.label}
                    style={{
                      flex: 1,
                      minWidth: 42,
                      height: 30,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? (isDark ? '#333' : '#F0EBFF') : 'transparent',
                      border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}
                  >
                    <svg width="32" height="2" viewBox="0 0 32 2">
                      <line
                        x1="0"
                        y1="1"
                        x2="32"
                        y2="1"
                        stroke={isActive ? T.accent : T.panelText}
                        strokeWidth="2"
                        strokeDasharray={ss.dash}
                      />
                    </svg>
                  </div>
                )
              })}
            </div>
          </PanelSection>
          <PanelSection label="操作">
            <div className={styles.panelActions}>
              <PanelBtn
                label="⇄ 方向を逆転"
                color={T.accent}
                onClick={() =>
                  setArrows((p) =>
                    p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)),
                  )
                }
              />
              <PanelBtn
                label="削除"
                color="#E06060"
                onClick={() => {
                  setArrows((p) => p.filter((a) => a.id !== selArrow))
                  setSelArrow(null)
                }}
              />
            </div>
          </PanelSection>
        </>
      )
    }

    // Lane selected
    if (selLane && selLaneData) {
      return (
        <>
          <PanelSection label="レーン">
            <PanelRow label="名前" />
            <PanelInput
              value={selLaneData.name}
              onChange={(v: string) =>
                setLanes((p) => p.map((l) => (l.id === selLane ? { ...l, name: v } : l)))
              }
            />
          </PanelSection>
          <PanelSection label="カラー">
            <div className={styles.panelActions}>
              {PALETTES.map((p, ci) => (
                <div
                  key={ci}
                  onClick={() =>
                    setLanes((prev) => prev.map((l) => (l.id === selLane ? { ...l, ci } : l)))
                  }
                  className={styles.colorSwatch}
                  style={{
                    background: p.dot,
                    border:
                      selLaneData.ci === ci ? `2px solid ${T.accent}` : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </PanelSection>
          <PanelSection label="順番">
            <div style={{ display: 'flex', gap: 6 }}>
              <PanelBtn label="← 左へ" color={T.accent} onClick={() => moveLane(selLane, -1)} />
              <PanelBtn label="右へ →" color={T.accent} onClick={() => moveLane(selLane, 1)} />
            </div>
          </PanelSection>
          <PanelSection label="操作">
            <PanelBtn label="レーンを削除" color="#E06060" onClick={() => rmLane(selLane)} full />
          </PanelSection>
        </>
      )
    }

    // Nothing selected -> Theme & Canvas
    return (
      <>
        <PanelSection label="テーマ">
          <div className={styles.themePickerWrapper}>
            <div
              onClick={() => setShowThemePicker((v) => !v)}
              className={styles.themePickerTrigger}
            >
              <span className={styles.themePickerLabel}>
                <span className={styles.themePickerEmoji}>{THEMES[themeId].emoji}</span>
                {THEMES[themeId].name}
              </span>
              <span className={styles.themePickerArrow}>{showThemePicker ? '▲' : '▼'}</span>
            </div>
            {showThemePicker && (
              <div className={styles.themePickerDropdown}>
                {(Object.entries(THEMES) as [ThemeId, Theme][]).map(([id, th]) => (
                  <div
                    key={id}
                    onClick={() => {
                      setThemeId(id)
                      setShowThemePicker(false)
                    }}
                    className={styles.themePickerOption}
                    style={{
                      background: themeId === id ? T.sidebarActiveBg : 'transparent',
                      color: themeId === id ? T.accent : T.panelText,
                    }}
                  >
                    <span className={styles.themePickerEmoji}>{th.emoji}</span>
                    {th.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PanelSection>
        <PanelSection label="キャンバス">
          <PanelRow label="レーン数">
            <span className={styles.panelValueTextLarge}>{lanes.length}</span>
          </PanelRow>
          <PanelRow label="行数">
            <span className={styles.panelValueTextLarge}>{rows.length}</span>
          </PanelRow>
          <PanelRow label="ノード数">
            <span className={styles.panelValueTextLarge}>{Object.keys(tasks).length}</span>
          </PanelRow>
          <PanelRow label="接続数">
            <span className={styles.panelValueTextLarge}>{arrows.length}</span>
          </PanelRow>
        </PanelSection>
        <PanelSection label="エクスポート">
          <PanelBtn
            label={mermaidCopied ? '✓ コピーしました' : 'Mermaid コードをコピー'}
            color={T.accent}
            onClick={async () => {
              try {
                if (!navigator.clipboard) return
                await navigator.clipboard.writeText(exportMermaid())
                if (mermaidTimerRef.current) clearTimeout(mermaidTimerRef.current)
                setMermaidCopied(true)
                mermaidTimerRef.current = setTimeout(() => setMermaidCopied(false), 1500)
              } catch {
                // clipboard write failed — do not show feedback
              }
            }}
            full
          />
        </PanelSection>
        <PanelSection label="挙動">
          {(
            [
              { key: 'copyLabelOnSameRow', label: '同行テキストコピー' },
              { key: 'autoConnect', label: '自動接続' },
              { key: 'autoAddRow', label: '自動行追加' },
              { key: 'enterEditOnCreate', label: '作成後すぐ編集' },
            ] as const
          ).map((s) => (
            <div
              key={s.key}
              role="checkbox"
              aria-checked={editorSettings[s.key]}
              tabIndex={0}
              className={styles.settingCheckbox}
              onClick={() => updateEditorSetting(s.key, !editorSettings[s.key])}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  updateEditorSetting(s.key, !editorSettings[s.key])
                }
              }}
              data-testid={`setting-${s.key}`}
            >
              <div
                className={`${styles.checkboxBox} ${editorSettings[s.key] ? styles.checkboxBoxChecked : ''}`}
              >
                {editorSettings[s.key] && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className={styles.checkboxLabel}>{s.label}</span>
            </div>
          ))}
        </PanelSection>
        <PanelSection label="表示">
          {(
            [
              { key: 'showDotGrid', label: 'ドットグリッド' },
              { key: 'showOrderBadge', label: '順番バッジ' },
            ] as const
          ).map((s) => (
            <div
              key={s.key}
              role="checkbox"
              aria-checked={editorSettings[s.key]}
              tabIndex={0}
              className={styles.settingCheckbox}
              onClick={() => updateEditorSetting(s.key, !editorSettings[s.key])}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  updateEditorSetting(s.key, !editorSettings[s.key])
                }
              }}
              data-testid={`setting-${s.key}`}
            >
              <div
                className={`${styles.checkboxBox} ${editorSettings[s.key] ? styles.checkboxBoxChecked : ''}`}
              >
                {editorSettings[s.key] && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className={styles.checkboxLabel}>{s.label}</span>
            </div>
          ))}
        </PanelSection>
      </>
    )
  }

  return (
    <div
      onClick={bgClick}
      className={styles.root}
      style={
        {
          '--theme-bg': T.bg,
          '--theme-accent': T.accent,
          '--theme-accent-40': `${T.accent}40`,
          '--theme-accent-18': `${T.accent}18`,
          '--theme-accent-10': `${T.accent}10`,
          '--theme-title-color': T.titleColor,
          '--theme-title-bar': T.titleBar,
          '--theme-title-bar-border': T.titleBarBorder,
          '--theme-title-sub': T.titleSub,
          '--theme-canvas-bg': T.canvasBg,
          '--theme-dot-grid': T.dotGrid,
          '--theme-sidebar': T.sidebar,
          '--theme-sidebar-border': T.sidebarBorder,
          '--theme-sidebar-icon': T.sidebarIcon,
          '--theme-sidebar-active': T.sidebarActive,
          '--theme-sidebar-active-bg': T.sidebarActiveBg,
          '--theme-panel-bg': T.panelBg,
          '--theme-panel-border': T.panelBorder,
          '--theme-panel-label': T.panelLabel,
          '--theme-panel-text': T.panelText,
          '--theme-input-bg': T.inputBg,
          '--theme-input-border': T.inputBorder,
          '--theme-status-bg': T.statusBg,
          '--theme-status-border': T.statusBorder,
          '--theme-status-text': T.statusText,
          '--theme-picker-shadow': `0 4px 12px rgba(0,0,0,${isDark ? 0.4 : 0.1})`,
          '--scrollbar-thumb': `rgba(${isDark ? '255,255,255' : '0,0,0'},0.08)`,
          '--tooltip-bg': isDark ? '#555' : '#333',
        } as React.CSSProperties
      }
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
      `}</style>

      {/* Title bar */}
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={styles.titleBar}>
        <Link to="/flows" className={styles.logoLink} data-testid="logo-link">
          <div
            className={styles.logoIcon}
            style={{
              background: `linear-gradient(135deg,${T.accent},${isDark ? '#6E59CF' : '#5B8DEF'})`,
            }}
          >
            {BRAND.logoInitial}
          </div>
          <span className={styles.brandName}>{BRAND.name}</span>
        </Link>
        <div className={styles.divider} />
        {editTitle ? (
          <input
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            onBlur={() => setEditTitle(false)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
              e.key === 'Enter' && !e.nativeEvent.isComposing && setEditTitle(false)
            }
            autoFocus
            className={styles.titleInput}
          />
        ) : (
          <span onClick={() => setEditTitle(true)} className={styles.titleText}>
            {title}
          </span>
        )}
        <button
          data-testid="share-button"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            setShowShareDialog(true)
          }}
          className={`${styles.shareButton} ${shareToken ? styles.shareButtonActive : styles.shareButtonInactive}`}
        >
          {shareToken ? '共有中' : '共有'}
        </button>
        <div className={styles.spacer} />
        {connectFrom && (
          <div className={styles.connectBanner}>
            <span className={styles.connectBannerText}>{'→ 接続先にドロップ'}</span>
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                setConnectFrom(null)
                setActiveTool('select')
              }}
              className={styles.connectBannerClose}
            >
              {'×'}
            </button>
          </div>
        )}
        <span
          data-testid="save-status"
          className={styles.saveStatus}
          style={{
            color:
              saveStatus === 'error'
                ? '#E06060'
                : saveStatus === 'unsaved'
                  ? T.accent
                  : T.statusText,
          }}
        >
          {saveStatusText[saveStatus]}
        </span>
        <span className={styles.zoomPercent}>{Math.round(zoom * 100)}%</span>
        <button
          data-testid="editor-user-avatar"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className={styles.editorAvatar}
        >
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </button>
      </div>

      <div className={styles.mainContent}>
        {/* Left Sidebar */}
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={styles.sidebar}>
          {/* Back to dashboard */}
          <div
            data-testid="file-button"
            className={styles.fileButton}
            onClick={() => navigate('/')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <span className={styles.fileButtonText}>ファイル</span>
            <span className={styles.toolTip}>ダッシュボードに戻る</span>
          </div>
          <div className={styles.sidebarSep} />
          {sideTools.map((t, i) => {
            if (t === 'sep') return <div key={i} className={styles.sidebarSep} />
            const isA = t.id === activeTool || (t.id === 'export' && showExport)
            return (
              <div
                key={t.id}
                className={`${styles.toolButton} ${isA ? styles.toolButtonActive : styles.toolButtonInactive}`}
                onClick={() => {
                  if (t.action) {
                    t.action()
                    return
                  }
                  if (t.id === 'connect') {
                    if (activeTool === 'connect') {
                      setActiveTool('select')
                      setConnectFrom(null)
                    } else setActiveTool('connect')
                  } else setActiveTool(t.id)
                }}
              >
                <Ico>{t.icon}</Ico>
                <span className={styles.toolTip}>{t.tip}</span>
              </div>
            )
          })}
        </div>

        {/* Canvas */}
        <div
          ref={canvasContainerRef}
          className={`${styles.canvas} ${editorSettings.showDotGrid ? '' : styles.canvasNoDots}`}
          style={{
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            cursor: connectFrom ? 'crosshair' : dragging ? 'grabbing' : 'default',
          }}
        >
          <svg
            ref={svgRef}
            data-testid="canvas-svg"
            width={svgW}
            height={svgH}
            viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
            className={styles.svg}
            style={{ minWidth: '100%', minHeight: '100%' }}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={() => {
              if (dragging) {
                setDragging(null)
                setDragOver(null)
              }
              if (connectFrom) {
                setConnectFrom(null)
                setConnectDragPt(null)
                setConnectFromPt(null)
                setActiveTool('select')
              }
            }}
          >
            {/* Lanes */}
            {lanes.map((lane, li) => {
              const p = PALETTES[lane.ci],
                x = laneX(li),
                isSel = selLane === lane.id,
                fullH = HH + rows.length * RH
              return (
                <g key={`lane-${lane.id}`}>
                  <rect
                    x={x}
                    y={TM}
                    width={LW}
                    height={fullH}
                    rx={10}
                    fill={T.laneBg}
                    stroke={T.laneBorder}
                    strokeWidth={0.5}
                  />
                  {isSel && (
                    <rect
                      x={x + 1}
                      y={TM + 1}
                      width={LW - 2}
                      height={fullH - 2}
                      rx={9}
                      fill="none"
                      stroke={T.accent}
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      opacity={0.5}
                    />
                  )}
                  <rect x={x} y={TM} width={LW} height={HH} rx={10} fill={T.laneHeaderBg} />
                  <rect x={x} y={TM + HH - 10} width={LW} height={10} fill={T.laneHeaderBg} />
                  <rect
                    x={x + 16}
                    y={TM + HH - 2.5}
                    width={LW - 32}
                    height={2}
                    rx={1}
                    fill={p.dot}
                    opacity={T.laneAccentOpacity}
                  />
                  <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                  <rect
                    x={x}
                    y={TM}
                    width={LW}
                    height={HH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setSelLane(selLane === lane.id ? null : lane.id)
                      setSelTask(null)
                      setSelArrow(null)
                      setMultiSel(new Set())
                    }}
                    onDoubleClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setEditLane(lane.id)
                      setSelLane(lane.id)
                      setTimeout(() => inputRef.current?.focus(), 40)
                    }}
                  />
                  {editLane === lane.id ? (
                    <foreignObject x={x + 32} y={TM + 9} width={LW - 44} height={28}>
                      <input
                        ref={inputRef}
                        value={lane.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = e.target.value
                          setLanes((p2) =>
                            p2.map((l) => (l.id === lane.id ? { ...l, name: v } : l)),
                          )
                        }}
                        onBlur={() => setEditLane(null)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                          e.key === 'Enter' && !e.nativeEvent.isComposing && setEditLane(null)
                        }
                        className={styles.laneNameInput}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={x + 32}
                      y={TM + HH / 2 + 1}
                      dominantBaseline="central"
                      fill={T.titleColor}
                      fontSize={12.5}
                      fontWeight={600}
                      style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                    >
                      {lane.name}
                    </text>
                  )}
                  {rows.map((_, ri) =>
                    ri === 0 ? null : (
                      <line
                        key={ri}
                        x1={x + 8}
                        y1={TM + HH + ri * RH}
                        x2={x + LW - 8}
                        y2={TM + HH + ri * RH}
                        stroke={T.laneBorder}
                        strokeWidth={0.3}
                      />
                    ),
                  )}
                </g>
              )
            })}

            {/* Lane move controls */}
            {selLane &&
              (() => {
                const li = lanes.findIndex((l) => l.id === selLane)
                if (li === -1) return null
                const x = laneX(li),
                  cx = x + LW / 2,
                  cy = TM - 14
                return (
                  <g>
                    {li > 0 && (
                      <g
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          moveLane(selLane, -1)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={cx - 44}
                          y={cy - 11}
                          width={30}
                          height={22}
                          rx={6}
                          fill={T.sidebar}
                          stroke={T.laneBorder}
                          strokeWidth={0.5}
                        />
                        <text
                          x={cx - 29}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={13}
                          fill={T.sidebarIcon}
                          fontWeight={600}
                        >
                          {'←'}
                        </text>
                      </g>
                    )}
                    {li < lanes.length - 1 && (
                      <g
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          moveLane(selLane, 1)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={cx + 14}
                          y={cy - 11}
                          width={30}
                          height={22}
                          rx={6}
                          fill={T.sidebar}
                          stroke={T.laneBorder}
                          strokeWidth={0.5}
                        />
                        <text
                          x={cx + 29}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={13}
                          fill={T.sidebarIcon}
                          fontWeight={600}
                        >
                          {'→'}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })()}

            {/* Gap "+" */}
            {Array.from({ length: lanes.length + 1 }, (_, gi) => {
              const gx =
                gi === 0
                  ? LM - G / 2
                  : gi === lanes.length
                    ? laneX(gi - 1) + LW + G / 2
                    : laneX(gi) - G / 2
              const gy = TM + HH / 2
              const isHov = hoveredLaneGap === gi
              const hitX =
                gi === 0 ? LM - 14 : gi === lanes.length ? laneX(gi - 1) + LW : laneX(gi) - G
              return (
                <g key={`gap-${gi}`}>
                  <rect
                    data-testid={`lanegap-hit-${gi}`}
                    x={hitX}
                    y={0}
                    width={gi === 0 || gi === lanes.length ? 14 : G}
                    height={TM + HH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredLaneGap(gi)}
                    onMouseLeave={() => setHoveredLaneGap(null)}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      insertLaneAt(gi)
                    }}
                  />
                  {isHov && (
                    <g style={{ pointerEvents: 'none' }}>
                      <line
                        x1={gx}
                        y1={TM + HH}
                        x2={gx}
                        y2={TM + HH + rows.length * RH}
                        stroke={T.accent}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                        opacity={0.3}
                      />
                      <circle cx={gx} cy={gy} r={10} fill={T.accent} />
                      <line
                        x1={gx - 4}
                        y1={gy}
                        x2={gx + 4}
                        y2={gy}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={gx}
                        y1={gy - 4}
                        x2={gx}
                        y2={gy + 4}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    </g>
                  )}
                </g>
              )
            })}

            {rows.map((row, ri) => {
              const ry = TM + HH + ri * RH + RH / 2
              const rx = LM / 2
              const isEmptyRow = !Object.values(tasks).some((t) => t.rid === row.id)
              const isHoveredRow = hoveredRowNum === ri
              const canDelete = isEmptyRow && rows.length > 1 && !rowAnim
              return (
                <g key={`rownum-${ri}`}>
                  <rect
                    data-testid={`rownum-hit-${ri}`}
                    x={0}
                    y={TM + HH + ri * RH}
                    width={LM}
                    height={RH}
                    fill="transparent"
                    style={{ cursor: canDelete ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHoveredRowNum(ri)}
                    onMouseLeave={() => setHoveredRowNum(null)}
                    onClick={() => {
                      if (canDelete) rmRowAt(ri)
                    }}
                  />
                  {isHoveredRow && canDelete ? (
                    <g data-testid={`canvas-row-${ri}`} style={{ pointerEvents: 'none' }}>
                      <line
                        x1={rx - 4}
                        y1={ry - 5}
                        x2={rx + 4}
                        y2={ry - 5}
                        stroke={T.dangerColor}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                      />
                      <rect
                        x={rx - 3}
                        y={ry - 4}
                        width={6}
                        height={8}
                        rx={1}
                        fill="none"
                        stroke={T.dangerColor}
                        strokeWidth={1.2}
                      />
                    </g>
                  ) : (
                    <text
                      data-testid={`canvas-row-${ri}`}
                      x={rx}
                      y={ry}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9}
                      fill={T.statusText}
                      fontWeight={500}
                      style={{ pointerEvents: 'none' }}
                    >
                      {ri + 1}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Empty cells */}
            {lanes.map((lane, li) =>
              rows.map((row, ri) => {
                const k = ky(lane.id, row.id)
                if (tasks[k]) return null
                const c = ct(li, ri),
                  p = PALETTES[lane.ci],
                  isHov = hovered === k,
                  isDT = dragOver === k
                const isGhost = ghostCell?.li === li && ghostCell?.ri === ri
                return (
                  <g key={`ec-${k}`}>
                    <rect
                      x={laneX(li)}
                      y={TM + HH + ri * RH}
                      width={LW}
                      height={RH}
                      fill="transparent"
                      style={{
                        cursor: connectFrom
                          ? 'default'
                          : dragging
                            ? 'default'
                            : isGhost
                              ? 'pointer'
                              : 'crosshair',
                      }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        if (!dragging) cellClick(lane.id, row.id, li, ri)
                      }}
                      onMouseEnter={() => setHovered(k)}
                      onMouseLeave={() => {
                        setHovered(null)
                        if (isGhost) setGhostCell(null)
                      }}
                    />
                    {isDT && (
                      <rect
                        x={laneX(li) + 4}
                        y={TM + HH + ri * RH + 4}
                        width={LW - 8}
                        height={RH - 8}
                        rx={8}
                        fill={`${T.accent}0A`}
                        stroke={T.accent}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                        className={styles.dragPulseAnim}
                      />
                    )}
                    {isHov && !connectFrom && !dragging && !isGhost && (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect
                          x={c.x - TW / 2}
                          y={c.y - TH / 2}
                          width={TW}
                          height={TH}
                          rx={8}
                          fill="none"
                          stroke={p.dot}
                          strokeWidth={1.2}
                          strokeDasharray="6,4"
                          opacity={0.45}
                        />
                        <line
                          x1={c.x - 5}
                          y1={c.y}
                          x2={c.x + 5}
                          y2={c.y}
                          stroke={p.dot}
                          strokeWidth={1}
                          opacity={0.5}
                        />
                        <line
                          x1={c.x}
                          y1={c.y - 5}
                          x2={c.x}
                          y2={c.y + 5}
                          stroke={p.dot}
                          strokeWidth={1}
                          opacity={0.5}
                        />
                      </g>
                    )}
                    {isGhost && (
                      <g style={{ pointerEvents: 'none' }} className={styles.ghostPulseAnim}>
                        <rect
                          x={c.x - TW / 2}
                          y={c.y - TH / 2}
                          width={TW}
                          height={TH}
                          rx={8}
                          fill={`${T.accent}08`}
                          stroke={T.accent}
                          strokeWidth={1.5}
                          strokeDasharray="6,4"
                        />
                        <text
                          x={c.x}
                          y={c.y - 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={12}
                          fontWeight={600}
                          fill={T.accent}
                          opacity={0.6}
                        >
                          作業
                        </text>
                        <text
                          x={c.x}
                          y={c.y + 14}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight={500}
                          fill={T.accent}
                          opacity={0.4}
                        >
                          クリックで確定
                        </text>
                      </g>
                    )}
                  </g>
                )
              }),
            )}

            {/* Nodes */}
            {lanes.map((lane, li) =>
              rows.map((row, ri) => {
                const k = ky(lane.id, row.id),
                  task = tasks[k],
                  note = notes[k]
                if (!task) return null
                const c = ct(li, ri),
                  p = PALETTES[lane.ci]
                const isSel = selTask === k,
                  isMulti = multiSel.has(k),
                  isLast = order.length > 0 && order[order.length - 1] === k
                const oi = order.indexOf(k),
                  isConnSrc = connectFrom === k,
                  isConnTgt = connectFrom !== null && connectFrom !== k
                const isDT = dragging?.key === k,
                  isHov = hovered === k
                const isDiamond = task.shape === 'diamond'
                const isSwapTarget = dragOver === k && dragging != null && dragging.key !== k
                const isRepairTarget = repairPreview?.nodes.includes(k) ?? false
                const tagW = lane.name.length * 7 + 14
                return (
                  <g
                    key={`t-${k}`}
                    opacity={isDT ? 0.3 : 1}
                    style={
                      bouncingNode === k
                        ? {
                            transformOrigin: `${c.x}px ${c.y}px`,
                          }
                        : undefined
                    }
                    className={bouncingNode === k ? styles.ghostBounceAnim : undefined}
                  >
                    <rect
                      x={laneX(li)}
                      y={TM + HH + ri * RH}
                      width={LW}
                      height={RH}
                      fill="transparent"
                      style={{ cursor: connectFrom ? 'pointer' : 'grab' }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        if (!dragging) cellClick(lane.id, row.id, li, ri)
                      }}
                      onMouseEnter={() => setHovered(k)}
                      onMouseLeave={() => setHovered(null)}
                    />
                    {isDiamond ? (
                      <polygon
                        points={`${c.x},${c.y - DS} ${c.x + DS},${c.y} ${c.x},${c.y + DS} ${c.x - DS},${c.y}`}
                        fill={isConnTgt && isHov ? `${T.accent}0A` : task.bg || T.nodeFill}
                        stroke={
                          isRepairTarget
                            ? T.accent
                            : isConnSrc
                              ? T.accent
                              : isSel || isMulti
                                ? T.nodeSelStroke
                                : isConnTgt && isHov
                                  ? T.accent
                                  : task.strokeColor || T.accent
                        }
                        strokeWidth={isRepairTarget ? 2 : isConnSrc || isSel || isMulti ? 2 : 1.2}
                        strokeDasharray={isConnSrc ? '4,3' : task.dash || 'none'}
                        className={isRepairTarget ? styles.repairPulseAnim : undefined}
                        style={{
                          cursor: connectFrom ? 'pointer' : 'grab',
                          filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                        }}
                        onClick={(e: React.MouseEvent) => taskClick(k, e)}
                        onDoubleClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          setEditing(k)
                          setSelTask(k)
                          setMultiSel(new Set())
                          setTimeout(() => inputRef.current?.focus(), 40)
                        }}
                        onMouseDown={(e: React.MouseEvent) => {
                          if (e.shiftKey) return
                          if (!connectFrom && !editing) onDragStart(k, e)
                        }}
                      />
                    ) : (
                      <rect
                        x={c.x - TW / 2}
                        y={c.y - TH / 2}
                        width={TW}
                        height={TH}
                        fill={isConnTgt && isHov ? `${T.accent}0A` : task.bg || T.nodeFill}
                        stroke={
                          isRepairTarget
                            ? T.accent
                            : isConnSrc
                              ? T.accent
                              : isSel || isMulti
                                ? T.nodeSelStroke
                                : isConnTgt && isHov
                                  ? T.accent
                                  : task.strokeColor || T.nodeStroke
                        }
                        strokeWidth={isRepairTarget ? 2 : isConnSrc || isSel || isMulti ? 2 : 1.2}
                        strokeDasharray={isConnSrc ? '4,3' : task.dash || 'none'}
                        className={isRepairTarget ? styles.repairPulseAnim : undefined}
                        rx={10}
                        style={{
                          cursor: connectFrom ? 'pointer' : 'grab',
                          filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                        }}
                        onClick={(e: React.MouseEvent) => taskClick(k, e)}
                        onDoubleClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          setEditing(k)
                          setSelTask(k)
                          setMultiSel(new Set())
                          setTimeout(() => inputRef.current?.focus(), 40)
                        }}
                        onMouseDown={(e: React.MouseEvent) => {
                          if (e.shiftKey) return
                          if (!connectFrom && !editing) onDragStart(k, e)
                        }}
                      />
                    )}
                    {isSwapTarget && (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect
                          x={c.x - TW / 2 - 4}
                          y={c.y - TH / 2 - 4}
                          width={TW + 8}
                          height={TH + 8}
                          rx={12}
                          fill={`${T.accent}0A`}
                          stroke={T.accent}
                          strokeWidth={2}
                          strokeDasharray="6,4"
                          className={styles.dragPulseAnim}
                        />
                        <rect
                          x={c.x + TW / 2 - 8}
                          y={c.y - TH / 2 - 12}
                          width={36}
                          height={18}
                          rx={9}
                          fill={T.accent}
                        />
                        <text
                          x={c.x + TW / 2 + 10}
                          y={c.y - TH / 2 - 3}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight={700}
                          fill="#fff"
                        >
                          ↕ 入替
                        </text>
                      </g>
                    )}
                    {!isDiamond && (
                      <rect
                        x={c.x - TW / 2 + 6}
                        y={c.y - TH / 2 + 5}
                        width={tagW}
                        height={15}
                        rx={3}
                        fill={p.tag}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    {!isDiamond && (
                      <text
                        x={c.x - TW / 2 + 13}
                        y={c.y - TH / 2 + 12.5}
                        dominantBaseline="central"
                        fontSize={8}
                        fill={p.text}
                        fontWeight={600}
                        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                      >
                        {lane.name}
                      </text>
                    )}
                    {!isDiamond && isLast && !isSel && !isMulti && !connectFrom && (
                      <circle cx={c.x - TW / 2 + 10} cy={c.y - TH / 2 + 10} r={3} fill="#66BB6A" />
                    )}
                    {isMulti && !isDiamond && (
                      <g style={{ pointerEvents: 'none' }}>
                        <circle cx={c.x + TW / 2 - 6} cy={c.y - TH / 2 + 6} r={8} fill={T.accent} />
                        <polyline
                          points={`${c.x + TW / 2 - 10},${c.y - TH / 2 + 6} ${c.x + TW / 2 - 7},${c.y - TH / 2 + 9} ${c.x + TW / 2 - 2},${c.y - TH / 2 + 3}`}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}
                    {isMulti && isDiamond && (
                      <g style={{ pointerEvents: 'none' }}>
                        <circle cx={c.x + DS - 4} cy={c.y - DS + 4} r={8} fill={T.accent} />
                        <svg
                          x={c.x + DS - 9}
                          y={c.y - DS - 1}
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </g>
                    )}
                    {!isDiamond &&
                      oi !== -1 &&
                      !connectFrom &&
                      !dragging &&
                      editorSettings.showOrderBadge && (
                        <g>
                          <rect
                            x={c.x + TW / 2 - 18}
                            y={c.y + TH / 2 - 16}
                            width={18}
                            height={16}
                            rx={5}
                            fill={p.tag}
                          />
                          <text
                            x={c.x + TW / 2 - 9}
                            y={c.y + TH / 2 - 7}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={p.text}
                            fontSize={8.5}
                            fontWeight={700}
                          >
                            {oi + 1}
                          </text>
                        </g>
                      )}
                    {editing === k ? (
                      <foreignObject
                        x={isDiamond ? c.x - DS + 4 : c.x - TW / 2 + 8}
                        y={isDiamond ? c.y - 10 : c.y - TH / 2 + 18}
                        width={isDiamond ? DS * 2 - 8 : TW - 16}
                        height={isDiamond ? 24 : TH - 22}
                      >
                        <input
                          ref={inputRef}
                          value={task.label === '作業' ? '' : task.label}
                          placeholder="作業"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = e.target.value
                            setTasks((p2) => ({ ...p2, [k]: { ...p2[k], label: v || '作業' } }))
                          }}
                          onBlur={() => setEditing(null)}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) setEditing(null)
                          }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className={styles.nodeEditInput}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={c.x}
                        y={isDiamond ? c.y + 2 : c.y + 6}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={isDiamond ? 12 : 13.5}
                        fontWeight={isDiamond ? 600 : 500}
                        fill={task.label === '作業' ? T.statusText : T.titleColor}
                        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                      >
                        {task.label.length > (isDiamond ? 8 : 10)
                          ? task.label.slice(0, isDiamond ? 8 : 10) + '…'
                          : task.label}
                      </text>
                    )}
                    {!isDiamond && note && !connectFrom && !dragging && (
                      <g>
                        <rect
                          x={c.x - TW / 2 + 6}
                          y={c.y + TH / 2 + 4}
                          width={TW - 12}
                          height={16}
                          rx={4}
                          fill="#FFFDE7"
                          stroke="#F0E6A0"
                          strokeWidth={0.5}
                        />
                        {editNote === k ? (
                          <foreignObject
                            x={c.x - TW / 2 + 8}
                            y={c.y + TH / 2 + 4}
                            width={TW - 16}
                            height={16}
                          >
                            <input
                              ref={inputRef}
                              value={note}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNotes((p2) => ({ ...p2, [k]: e.target.value }))
                              }
                              onBlur={() => setEditNote(null)}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                                e.key === 'Enter' && !e.nativeEvent.isComposing && setEditNote(null)
                              }
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              className={styles.noteEditInput}
                            />
                          </foreignObject>
                        ) : (
                          <text
                            x={c.x}
                            y={c.y + TH / 2 + 13}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={8}
                            fill="#8D6E63"
                            style={{ cursor: 'pointer' }}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              const nk = k
                              if (!notes[nk]) setNotes((p2) => ({ ...p2, [nk]: 'メモ' }))
                              setEditNote(nk)
                              setTimeout(() => inputRef.current?.focus(), 40)
                            }}
                          >
                            {note.length > 14 ? note.slice(0, 14) + '…' : note}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                )
              }),
            )}

            {/* Arrows */}
            {arrowPaths.map(({ arrow, path }) => {
              const { d, mx, my } = path
              const isSel = selArrow === arrow.id
              const ac = arrow.color || T.arrowColor
              const selC = arrow.color || T.arrowSel
              const dashArr = arrow.dash || 'none'
              return (
                <g key={`av-${arrow.id}`}>
                  <defs>
                    <marker
                      id={`m-${arrow.id}`}
                      markerWidth="9"
                      markerHeight="8"
                      refX="8"
                      refY="4"
                      orient="auto"
                    >
                      <polygon
                        points="0 0.5, 9 4, 0 7.5"
                        fill={isSel ? arrow.color || T.accent : ac}
                      />
                    </marker>
                  </defs>
                  <path
                    d={d}
                    stroke={isSel ? selC : ac}
                    strokeWidth={isSel ? 2.5 : 2}
                    strokeDasharray={dashArr}
                    fill="none"
                    markerEnd={`url(#m-${arrow.id})`}
                    style={{ pointerEvents: 'none' }}
                  />
                  {arrow.comment && (
                    <g
                      style={{ cursor: 'pointer' }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setSelArrow(selArrow === arrow.id ? null : arrow.id)
                        setSelTask(null)
                        setSelLane(null)
                      }}
                    >
                      <rect
                        x={mx - Math.max(arrow.comment.length * 4, 14) - 12}
                        y={my - 22}
                        width={Math.max(arrow.comment.length * 8 + 24, 50)}
                        height={24}
                        rx={12}
                        fill={T.commentPill}
                        stroke={T.commentBorder}
                        strokeWidth={0.5}
                      />
                      <text
                        x={mx}
                        y={my - 9}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={12}
                        fill={T.commentText}
                        fontWeight={600}
                      >
                        {arrow.comment.length > 16
                          ? arrow.comment.slice(0, 16) + '…'
                          : arrow.comment}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {/* Row gap "+" — split into clickable left-margin zone + hover-only body zone so arrows are not blocked */}
            {Array.from({ length: rows.length + 1 }, (_, ri) => {
              const gy = TM + HH + ri * RH
              const gx = LM / 2
              const isHov = hoveredRowGap === ri
              const isGhostHere = ghostRowGap === ri
              return (
                <g key={`rowgap-${ri}`}>
                  {/* Clickable hit zone limited to left margin where "+" icon appears */}
                  <rect
                    data-testid={`rowgap-hit-${ri}`}
                    x={0}
                    y={gy - 10}
                    width={LM}
                    height={20}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredRowGap(ri)}
                    onMouseLeave={() => {
                      setHoveredRowGap(null)
                      if (isGhostHere) setGhostRowGap(null)
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      insertRowAt(ri)
                    }}
                  />
                  {/* Hover-detection zone across body (no click handler — arrows keep priority) */}
                  <rect
                    x={LM}
                    y={gy - 10}
                    width={laneX(lanes.length - 1) + LW - LM}
                    height={20}
                    fill="transparent"
                    style={{ pointerEvents: 'auto' }}
                    onMouseEnter={() => setHoveredRowGap(ri)}
                    onMouseLeave={() => {
                      setHoveredRowGap(null)
                      if (isGhostHere) setGhostRowGap(null)
                    }}
                  />
                  {isHov && (
                    <g data-testid={`rowgap-feedback-${ri}`} style={{ pointerEvents: 'none' }}>
                      <line
                        x1={LM}
                        y1={gy}
                        x2={laneX(lanes.length - 1) + LW}
                        y2={gy}
                        stroke={T.accent}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                        opacity={0.3}
                      />
                      <circle cx={gx} cy={gy} r={10} fill={T.accent} />
                      <line
                        x1={gx - 4}
                        y1={gy}
                        x2={gx + 4}
                        y2={gy}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={gx}
                        y1={gy - 4}
                        x2={gx}
                        y2={gy + 4}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    </g>
                  )}
                  {isGhostHere && (
                    <g style={{ pointerEvents: 'none' }}>
                      <line
                        x1={LM + 6}
                        y1={gy}
                        x2={laneX(lanes.length - 1) + LW - 6}
                        y2={gy}
                        stroke={T.accent}
                        strokeWidth={1.5}
                        strokeDasharray="6,4"
                        opacity={0.5}
                        className={styles.ghostPulseAnim}
                      />
                      <rect
                        x={(LM + laneX(lanes.length - 1) + LW) / 2 - 56}
                        y={gy - 12}
                        width={112}
                        height={24}
                        rx={12}
                        fill={T.accent}
                        opacity={0.92}
                      />
                      <text
                        x={(LM + laneX(lanes.length - 1) + LW) / 2}
                        y={gy + 3.5}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill="#fff"
                        style={{ fontFamily: 'inherit' }}
                      >
                        クリックで確定
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {arrowPaths.map(({ arrow, path }) => (
              <path
                key={`ah-${arrow.id}`}
                d={path.d}
                stroke="rgba(0,0,0,0)"
                strokeWidth={20}
                fill="none"
                pointerEvents="stroke"
                style={{ cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  setSelArrow(selArrow === arrow.id ? null : arrow.id)
                  setSelTask(null)
                  setSelLane(null)
                }}
              />
            ))}

            {/* Repair preview arrows (dashed overlay) */}
            {repairPreview?.proposedArrows.map((pa, i) => {
              const fakePath = aPath({ id: `preview-${i}`, from: pa.from, to: pa.to, comment: '' })
              if (!fakePath) return null
              return (
                <path
                  key={`repair-preview-${i}`}
                  d={fakePath.d}
                  stroke={T.accent}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  fill="none"
                  opacity={0.6}
                  markerEnd={`url(#m-preview-${i})`}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
            {/* Repair preview arrowheads */}
            {repairPreview?.proposedArrows.map((_, i) => (
              <defs key={`repair-preview-def-${i}`}>
                <marker
                  id={`m-preview-${i}`}
                  markerWidth="9"
                  markerHeight="8"
                  refX="8"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 0.5, 9 4, 0 7.5" fill={T.accent} opacity={0.6} />
                </marker>
              </defs>
            ))}

            {/* Floating arrow controls */}
            {selArrow &&
              (() => {
                const ap = arrowPaths.find((x) => x.arrow.id === selArrow)
                if (!ap) return null
                const { mx, my } = ap.path
                const bw = 96,
                  bh = 30,
                  br = bh / 2,
                  by = my + 10
                return (
                  <g data-testid="arrow-floating-controls">
                    <rect
                      x={mx - bw / 2}
                      y={by}
                      width={bw}
                      height={bh}
                      rx={br}
                      fill={T.nodeFill}
                      stroke={T.commentBorder}
                      strokeWidth={0.5}
                      style={{ filter: `drop-shadow(0 2px 8px rgba(0,0,0,${isDark ? 0.3 : 0.1}))` }}
                    />
                    {/* Reverse */}
                    <g
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setArrows((p) =>
                          p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)),
                        )
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={mx - bw / 2} y={by} width={32} height={bh} fill="transparent" />
                      <g transform={`translate(${mx - bw / 2 + 8},${by + 7})`}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={T.accent}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8 3L4 7l4 4" />
                          <path d="M4 7h16" />
                          <path d="M16 21l4-4-4-4" />
                          <path d="M20 17H4" />
                        </svg>
                      </g>
                    </g>
                    {/* Comment */}
                    <g
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setEditArrowComment(selArrow)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={mx - 16} y={by} width={32} height={bh} fill="transparent" />
                      <g transform={`translate(${mx - 8},${by + 7})`}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={T.commentIconColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      </g>
                    </g>
                    {/* Delete */}
                    <g
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setArrows((p) => p.filter((a) => a.id !== selArrow))
                        setSelArrow(null)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect x={mx + bw / 2 - 32} y={by} width={32} height={bh} fill="transparent" />
                      <g transform={`translate(${mx + bw / 2 - 24},${by + 7})`}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={T.dangerColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </g>
                    </g>
                  </g>
                )
              })()}

            {/* Inline arrow comment edit */}
            {editArrowComment &&
              (() => {
                const ap = arrowPaths.find((x) => x.arrow.id === editArrowComment)
                if (!ap) return null
                const { mx, my } = ap.path
                return (
                  <foreignObject x={mx - 100} y={my + 44} width={200} height={30}>
                    <input
                      autoFocus
                      value={arrows.find((a) => a.id === editArrowComment)?.comment || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value
                        setArrows((p) =>
                          p.map((a) => (a.id === editArrowComment ? { ...a, comment: v } : a)),
                        )
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if ((e.key === 'Enter' && !e.nativeEvent.isComposing) || e.key === 'Escape')
                          setEditArrowComment(null)
                      }}
                      onBlur={() => setEditArrowComment(null)}
                      placeholder="コメント…"
                      style={{
                        width: '100%',
                        height: 28,
                        fontSize: 12,
                        padding: '0 10px',
                        border: `1px solid ${T.inputBorder}`,
                        borderRadius: 8,
                        outline: 'none',
                        background: T.nodeFill,
                        color: T.panelText,
                        fontFamily: 'inherit',
                        boxShadow: `0 2px 8px rgba(0,0,0,${isDark ? 0.3 : 0.1})`,
                      }}
                    />
                  </foreignObject>
                )
              })()}

            {/* Connection handles on hovered or selected nodes */}
            {!dragging &&
              !editing &&
              multiSel.size === 0 &&
              (() => {
                const showKey = selTask || hovered
                if (!showKey || !tasks[showKey]) return null
                if (connectFrom && showKey === connectFrom && connectDragPt) return null
                const t = tasks[showKey],
                  li = liMap[t.lid],
                  ri = riMap[t.rid]
                if (li === undefined || ri === undefined) return null
                const c = ct(li, ri)
                const isDia = t.shape === 'diamond'
                const handles = isDia
                  ? [
                      { x: c.x, y: c.y - DS },
                      { x: c.x, y: c.y + DS },
                      { x: c.x - DS, y: c.y },
                      { x: c.x + DS, y: c.y },
                    ]
                  : [
                      { x: c.x, y: c.y - TH / 2 },
                      { x: c.x, y: c.y + TH / 2 },
                      { x: c.x - TW / 2, y: c.y },
                      { x: c.x + TW / 2, y: c.y },
                    ]
                const isSel = selTask === showKey
                return handles.map((h, i) => (
                  <g key={`ch-${i}`}>
                    <circle
                      cx={h.x}
                      cy={h.y}
                      r={isSel ? 6 : 5}
                      data-testid="connection-handle"
                      fill={T.nodeFill}
                      stroke={T.accent}
                      strokeWidth={1.5}
                      style={{ cursor: 'crosshair', transition: 'r 0.1s' }}
                      onMouseDown={(e: React.MouseEvent) => startConnectDrag(showKey, h.x, h.y, e)}
                    />
                    {isSel && (
                      <circle
                        cx={h.x}
                        cy={h.y}
                        r={2.5}
                        fill={T.accent}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </g>
                ))
              })()}

            {/* Highlight target nodes while dragging connection */}
            {connectFrom &&
              connectDragPt &&
              Object.keys(tasks).map((k) => {
                if (k === connectFrom) return null
                const t = tasks[k],
                  li = liMap[t.lid],
                  ri = riMap[t.rid]
                if (li === undefined || ri === undefined) return null
                const c = ct(li, ri)
                const isDia = t.shape === 'diamond'
                const isNear = isDia
                  ? Math.abs(connectDragPt.x - c.x) < DS + 12 &&
                    Math.abs(connectDragPt.y - c.y) < DS + 12
                  : Math.abs(connectDragPt.x - c.x) < TW / 2 + 12 &&
                    Math.abs(connectDragPt.y - c.y) < TH / 2 + 12
                if (!isNear) return null
                return isDia ? (
                  <polygon
                    key={`ct-${k}`}
                    points={`${c.x},${c.y - DS - 2} ${c.x + DS + 2},${c.y} ${c.x},${c.y + DS + 2} ${c.x - DS - 2},${c.y}`}
                    fill={`${T.accent}08`}
                    stroke={T.accent}
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : (
                  <rect
                    key={`ct-${k}`}
                    x={c.x - TW / 2 - 2}
                    y={c.y - TH / 2 - 2}
                    width={TW + 4}
                    height={TH + 4}
                    rx={12}
                    fill={`${T.accent}08`}
                    stroke={T.accent}
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })}

            {/* Temp connection line while dragging */}
            {connectFrom && connectDragPt && connectFromPt && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={connectFromPt.x}
                  y1={connectFromPt.y}
                  x2={connectDragPt.x}
                  y2={connectDragPt.y}
                  stroke={T.accent}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  opacity={0.6}
                />
                <circle
                  cx={connectDragPt.x}
                  cy={connectDragPt.y}
                  r={4}
                  fill={T.accent}
                  opacity={0.5}
                />
              </g>
            )}

            {/* Row add/delete animation overlay */}
            {rowAnim &&
              (() => {
                const fullW = laneX(lanes.length - 1) + LW + 8
                const ay = TM + HH + rowAnim.index * RH
                const ac = T.accent
                if (rowAnim.type === 'add') {
                  return (
                    <g data-testid="row-anim-overlay" style={{ pointerEvents: 'none' }}>
                      <foreignObject
                        x={0}
                        y={ay}
                        width={fullW}
                        height={RH}
                        style={{ overflow: 'visible' }}
                      >
                        <div className={styles.stampIn}>
                          <div
                            style={{
                              width: '100%',
                              height: RH,
                              borderRadius: 6,
                              border: `2px solid ${ac}40`,
                              background: `${ac}08`,
                            }}
                          />
                        </div>
                      </foreignObject>
                      <foreignObject
                        x={LM}
                        y={ay + 2}
                        width={fullW - LM - 4}
                        height={RH - 4}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className={styles.floodIn}
                          style={{
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(90deg, ${ac}CC, ${ac}44)`,
                            borderRadius: 6,
                          }}
                        />
                      </foreignObject>
                    </g>
                  )
                }
                if (rowAnim.type === 'delete') {
                  return (
                    <g data-testid="row-anim-overlay" style={{ pointerEvents: 'none' }}>
                      <foreignObject
                        x={0}
                        y={ay}
                        width={fullW}
                        height={RH}
                        style={{ overflow: 'visible' }}
                      >
                        <div className={styles.stampOut}>
                          <div
                            style={{
                              width: '100%',
                              height: RH,
                              borderRadius: 6,
                              border: '2px solid #E0606040',
                              background: '#E0606008',
                            }}
                          />
                        </div>
                      </foreignObject>
                      <foreignObject
                        x={LM}
                        y={ay + 2}
                        width={fullW - LM - 4}
                        height={RH - 4}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className={styles.floodOut}
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, #E0606099, #E0606044)',
                            borderRadius: 6,
                          }}
                        />
                      </foreignObject>
                    </g>
                  )
                }
                return null
              })()}
          </svg>
        </div>

        {/* Right Panel */}
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={styles.rightPanel}>
          <div className={styles.rightPanelHeader}>
            <span className={styles.rightPanelTitle}>
              {multiSel.size > 0
                ? `${multiSel.size}件選択`
                : selTask
                  ? 'ノード'
                  : selArrow
                    ? '接続線'
                    : selLane
                      ? 'レーン'
                      : 'プロパティ'}
            </span>
          </div>
          {renderRightPanel()}
        </div>
      </div>

      {/* Status */}
      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {Object.keys(tasks).length} tasks {'·'} {arrows.length} connections
        </span>
        <span className={styles.statusTextFaded}>{'⌘Z:戻す · ⌘⇧Z:やり直す'}</span>
        <div style={{ flex: 1 }} />
        <span className={styles.statusTextHint}>
          {multiSel.size > 0
            ? `${multiSel.size}件選択中 · Shift+クリックで追加 · Delete削除`
            : connectFrom
              ? '接続先クリック · Esc解除'
              : dragging
                ? '空きセルにドロップ · ノードに重ねて入替'
                : 'クリック:追加 · ドラッグ:移動 · ○:接続 · Shift+クリック:複数選択'}
        </span>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog
          flowId={flow.id}
          shareToken={shareToken}
          onShareChange={(token) => {
            setShareToken(token)
            onShareChange?.(token)
          }}
          onClose={() => setShowShareDialog(false)}
        />
      )}
      <UserMenuPanel
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={user?.name ?? ''}
        userEmail={user?.email ?? ''}
        onLogout={logout}
      />

      {/* AI Assistant */}
      <AiAssistant
        flowId={flow.id}
        aiEnabled={user?.aiEnabled ?? false}
        onFlowGenerated={(aiFlow) => {
          const hasExistingContent = order.length > 0
          if (
            hasExistingContent &&
            !window.confirm(
              'AIが生成したフローを適用すると、現在のフローが上書きされます。よろしいですか？',
            )
          ) {
            return
          }
          const tempFlow: Flow = {
            id: flow.id,
            title: aiFlow.title,
            themeId: themeId,
            shareToken: shareToken,
            createdAt: flow.createdAt,
            updatedAt: flow.updatedAt,
            lanes: aiFlow.lanes,
            nodes: aiFlow.nodes,
            arrows: aiFlow.arrows,
          }
          const state = flowToInternalState(tempFlow)
          setLanes(state.lanes)
          setRows(state.rows)
          setTasks(state.tasks)
          setOrder(state.order)
          setArrows(state.arrows)
          setNotes(state.notes)
          setTitle(state.title)
          setSelTask(null)
          setSelArrow(null)
          setSelLane(null)
          setEditing(null)
        }}
      />
      <ToastList
        toasts={toasts}
        onDismiss={(id) => {
          dismissToast(id)
          clearRepairPreview()
        }}
        onConfirm={(id, crossingCount) => {
          confirmToast(id, crossingCount)
          clearRepairPreview()
        }}
      />
    </div>
  )
}
