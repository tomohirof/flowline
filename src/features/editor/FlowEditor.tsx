import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../constants/brand'
import { ARROW_MARKER } from '../../constants/arrowMarker'
import { useNavigate, Link } from 'react-router-dom'
import { ShareDialog } from './components/ShareDialog'
import { AiAssistant } from './components/AiAssistant'
import { useAuth } from '../../hooks/useAuth'
import { UserMenuPanel } from '../../components/UserMenuPanel'
import { apiFetch } from '../../lib/api'
import { Toolbar } from './components/Toolbar'
import styles from './FlowEditor.module.css'
import type {
  ThemeId,
  TaskData,
  MemoData,
  RowData,
  InternalLane,
  InternalArrow,
  DragState,
  ArrowPathResult,
  ArrowSide,
  CellInfo,
  Point,
  ToolId,
  SideTool,
  EditorSnapshot,
  EditorSettings,
  Flow,
  FlowSavePayload,
  SaveStatus,
} from './types'
import { parseNote, serializeMemo, MEMO_W, measureMemoHeight } from './memo-utils'
import { PALETTES, THEMES } from './theme-constants'
import { toBlob } from 'html-to-image'
import { pickPixelRatio, buildExportSvg } from './png-export'
import { calcLaneWidth } from './calcLaneWidth'
import { NodeLabelText } from '../shared/NodeLabelText'
import {
  DS,
  buildObstacles,
  deriveFromSide,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
import { useToast } from './hooks/useToast'
import { ToastList } from './components/Toast'
import { I, Ico } from './components/EditorIcons'
import { MemoText } from './components/MemoText'
import { RightPanel } from './components/RightPanel'
import { useArrows } from './hooks/useArrows'
import { useMoveAutoRepair } from './hooks/useMoveAutoRepair'
import { uid } from '../../lib/uid'
import { computeBridgeArrows } from './auto-connect'
import {
  remapArrows,
  swapKeys,
  remapArrowsBatch,
  filterArrowsByDeletedKeys,
  calcArrowPath,
  calcMultiDropTargets,
  cellFromPos as cellFromPosLib,
} from '../../lib/flow-engine'
import { isGroupParent, isGroupSub, getGroupWidth } from '../../lib/lane-group-utils'

// =============================================
// Helpers: convert API data <-> internal state
// =============================================

function flowToInternalState(flow: Flow): {
  lanes: InternalLane[]
  rows: RowData[]
  tasks: Record<string, TaskData>
  order: string[]
  arrows: InternalArrow[]
  memos: Record<string, MemoData>
  title: string
  themeId: ThemeId
} {
  // Build lanes
  const sortedLanes = [...flow.lanes].sort((a, b) => a.position - b.position)
  const lanes: InternalLane[] = sortedLanes.map((l) => ({
    id: l.id,
    name: l.name,
    ci: l.colorIndex,
    groupId: l.groupId,
    groupRole: l.groupRole,
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
  const memos: Record<string, MemoData> = {}
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
        const li = lanes.findIndex((l) => l.id === n.laneId)
        const memo = parseNote(n.note, li, lanes.length)
        if (memo) memos[key] = memo
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
      if (a.bidirectional) arr.bidirectional = true
      return arr
    })
    .filter((a): a is InternalArrow => a !== null)

  const themeId = (Object.keys(THEMES).includes(flow.themeId) ? flow.themeId : 'cloud') as ThemeId

  return { lanes, rows, tasks, order, arrows, memos, title: flow.title, themeId }
}

function internalStateToPayload(
  lanes: InternalLane[],
  rows: RowData[],
  tasks: Record<string, TaskData>,
  order: string[],
  arrows: InternalArrow[],
  memos: Record<string, MemoData>,
  title: string,
  themeId: ThemeId,
): FlowSavePayload {
  // Build API lanes
  const apiLanes = lanes.map((l, i) => ({
    id: l.id,
    name: l.name,
    colorIndex: l.ci,
    position: i,
    groupId: l.groupId,
    groupRole: l.groupRole,
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
        note: memos[k] ? serializeMemo(memos[k]) : null,
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
        bidirectional: a.bidirectional ?? false,
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
  saveCtaLabel?: string
  onSaveCtaClick?: () => void
  hideShare?: boolean
}

// =============================================
// Node Toolbar Icons
// =============================================

const IconConnect = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)

const IconMemo = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const IconTrash = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const IconReverse = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3L4 7l4 4" />
    <path d="M4 7h16" />
    <path d="M16 21l4-4-4-4" />
    <path d="M20 17H4" />
  </svg>
)

// =============================================
// FlowEditor Component
// =============================================

export default function FlowEditor({
  flow,
  onSave,
  saveStatus,
  onShareChange,
  onRetrySave,
  saveCtaLabel,
  onSaveCtaClick,
  hideShare,
}: FlowEditorProps) {
  const { t } = useTranslation('editor')
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isDemo = !!saveCtaLabel
  const [menuOpen, setMenuOpen] = useState(false)
  // Initialize state from flow data (lazy initialization to avoid recomputing on every render)
  const [initState] = useState(() => flowToInternalState(flow))
  const [lanes, setLanes] = useState<InternalLane[]>(initState.lanes)
  const [rows, setRows] = useState<RowData[]>(initState.rows)
  const [tasks, setTasks] = useState<Record<string, TaskData>>(initState.tasks)
  const [order, setOrder] = useState<string[]>(initState.order)
  const [memos, setMemos] = useState<Record<string, MemoData>>(initState.memos)

  const [editing, setEditing] = useState<string | null>(null)
  const [editLane, setEditLane] = useState<string | null>(null)
  const [selTask, setSelTask] = useState<string | null>(null)
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [selArrow, setSelArrow] = useState<string | null>(null)
  const [editArrowComment, setEditArrowComment] = useState<string | null>(null)
  const [selLane, setSelLane] = useState<string | null>(null)
  const [editingMemo, setEditingMemo] = useState<string | null>(null)
  const [draggingMemo, setDraggingMemo] = useState<{
    key: string
    startX: number
    startY: number
    origDx: number
    origDy: number
  } | null>(null)
  const [hoveredMemo, setHoveredMemo] = useState<string | null>(null)
  const [showExport, setShowExport] = useState<boolean>(false)
  const [title, setTitle] = useState<string>(initState.title)
  const [editTitle, setEditTitle] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredLaneGap, setHoveredLaneGap] = useState<number | null>(null)
  const [laneDropdown, setLaneDropdown] = useState<{
    gapIndex: number
    x: number
    y: number
  } | null>(null)
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
  const rowAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bouncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slidingLaneId, setSlidingLaneId] = useState<string | null>(null)
  const slidingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestedLanesRef = useRef<Set<string>>(new Set())
  const [pngState, setPngState] = useState<'idle' | 'generating' | 'done'>('idle')
  const pngTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    toasts,
    addConfirmToast,
    addSuccessToast,
    addInfoToast,
    addErrorToast,
    dismissToast,
    dismissToastByType,
    confirmToast,
  } = useToast()

  const triggerLaneSlideIn = (laneId: string): void => {
    setSlidingLaneId(laneId)
    if (slidingTimerRef.current) clearTimeout(slidingTimerRef.current)
    slidingTimerRef.current = setTimeout(() => setSlidingLaneId(null), 350)
  }

  // Show/dismiss error toast based on saveStatus
  useEffect(() => {
    if (saveStatus === 'error') {
      addErrorToast({
        message: t('save.failedTitle'),
        detail: t('save.failedDetail'),
        onRetry: onRetrySave,
      })
    } else {
      dismissToastByType('error')
    }
  }, [saveStatus, addErrorToast, dismissToastByType, onRetrySave, t])
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [connectDragPt, setConnectDragPt] = useState<Point | null>(null)
  const [connectFromPt, setConnectFromPt] = useState<Point | null>(null)
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragOverMulti, setDragOverMulti] = useState<Set<string> | null>(null)
  const [multiDragAnchorCell, setMultiDragAnchorCell] = useState<{
    li: number
    ri: number
  } | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId | string>('select')
  const [themeId, setThemeId] = useState<ThemeId>(initState.themeId)
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false)
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false)
  const [shareToken, setShareToken] = useState<string | null>(flow.shareToken)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    copyLabelOnSameRow: false,
    autoConnect: true,
    autoAddRow: true,
    enterEditOnCreate: true,
    autoRepair: true,
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
    if (isDemo) return
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
            ...(typeof data.settings.autoRepair === 'boolean' && {
              autoRepair: data.settings.autoRepair,
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
  }, [isDemo])

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

  useEffect(() => {
    return () => {
      if (slidingTimerRef.current) clearTimeout(slidingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pngTimerRef.current) clearTimeout(pngTimerRef.current)
    }
  }, [])

  const updateEditorSetting = useCallback(
    (key: string, value: boolean) => {
      setEditorSettings((prev) => ({ ...prev, [key]: value }))
      if (isDemo) return
      if (!settingsLoadedRef.current) return
      const merged = { ...fullSettingsRef.current, [key]: value }
      fullSettingsRef.current = merged
      apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(merged),
      }).catch(() => {
        // 保存失敗は無視（UIは即時反映）
      })
    },
    [isDemo],
  )

  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const laneInputRef = useRef<HTMLInputElement | null>(null)
  const preEditLabelRef = useRef<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const headerSvgRef = useRef<SVGSVGElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // --- Notify parent of changes ---
  const prevStructSnapRef = useRef<string>('')
  const prevMetaSnapRef = useRef<string>('')

  const buildPayload = useCallback((): FlowSavePayload => {
    return internalStateToPayload(lanes, rows, tasks, order, arrows, memos, title, themeId)
  }, [lanes, rows, tasks, order, arrows, memos, title, themeId])

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
    setMemos(state.memos)
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
    const structSnap = JSON.stringify({ tasks, order, arrows, memos, lanes, rows })
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
  }, [tasks, order, arrows, memos, lanes, rows, title, themeId, onSave, buildPayload])

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
        memos,
        lanes: lanes.map((l) => ({ ...l })),
        rows: rows.map((r) => ({ ...r })),
      }),
    [tasks, order, arrows, memos, lanes, rows],
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
      setMemos(d.memos)
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
      setMemos((p) => {
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
        addSuccessToast({ message: t('toast.autoRepair', { count: bridges.length }) })
      }
    },
    [arrows, setArrows, addSuccessToast, t],
  )

  const delMultiSel = useCallback((): void => {
    const bridges = computeBridgeArrows(multiSel, arrows)
    setTasks((p) => {
      const n = { ...p }
      multiSel.forEach((k) => delete n[k])
      return n
    })
    setMemos((p) => {
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
      addSuccessToast({ message: t('toast.autoRepair', { count: bridges.length }) })
    }
    setMultiSel(new Set())
  }, [multiSel, arrows, setArrows, addSuccessToast, t])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ae = document.activeElement as HTMLElement | null
      const isTextField = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')
      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (isTextField) return
        e.preventDefault()
        undo()
        return
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z or Cmd+Y / Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) {
        if (isTextField) return
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editing || editLane || editTitle || editingMemo || isTextField) return
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
      // Select All: Cmd+A / Ctrl+A
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (editing || editLane || editTitle || editingMemo || isTextField) return
        e.preventDefault()
        const allKeys = Object.keys(tasks)
        if (allKeys.length === 0) return
        setMultiSel(new Set(allKeys))
        setSelTask(null)
        setSelArrow(null)
        return
      }
      if (e.key === 'Escape') {
        if (isTextField) return
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
    editingMemo,
    undo,
    redo,
    multiSel,
    delTask,
    delMultiSel,
    setArrows,
    tasks,
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
      n.splice(i, 0, {
        id: uid(),
        name: t('newLaneName', { number: prev.length + 1 }),
        ci: i % PALETTES.length,
      })
      return n
    })
    setHoveredLaneGap(null)
  }

  const mergeLaneAt = (gapIndex: number, targetLaneId: string): void => {
    const newLaneId = uid()
    setLanes((prev) => {
      const targetIdx = prev.findIndex((l) => l.id === targetLaneId)
      if (targetIdx < 0) return prev

      const target = prev[targetIdx]
      const groupId = target.groupId || uid()
      const n = [...prev]

      if (!target.groupId) {
        n[targetIdx] = { ...target, groupId, groupRole: 'parent' }
      }

      // gapIndex がグループ範囲内ならそこに挿入、範囲外ならグループ末尾
      const groupStart = n.findIndex((l) => l.groupId === groupId)
      const groupEnd = n.reduce((last, l, i) => (l.groupId === groupId ? i : last), groupStart)
      const insertAt = gapIndex > groupStart && gapIndex <= groupEnd + 1 ? gapIndex : groupEnd + 1

      const subCount = n.filter((l) => l.groupId === groupId).length
      n.splice(insertAt, 0, {
        id: newLaneId,
        name: `${target.name} (${subCount + 1})`,
        ci: target.ci,
        groupId,
        groupRole: 'sub',
      })

      return n
    })
    triggerLaneSlideIn(newLaneId)
    setLaneDropdown(null)
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
  const cellFromPos = (sx: number, sy: number): CellInfo | null =>
    cellFromPosLib(sx, sy, lanes, rows, { TM, HH, RH, LM, LW, G })
  const svgPt = (cx: number, cy: number): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom }
  }
  const onMemoMouseDown = (k: string, e: React.MouseEvent): void => {
    if (editingMemo === k) return
    e.stopPropagation()
    e.preventDefault()
    const m = memos[k]
    if (!m) return
    const pt = svgPt(e.clientX, e.clientY)
    setDraggingMemo({ key: k, startX: pt.x, startY: pt.y, origDx: m.dx, origDy: m.dy })
  }
  const onDragStart = (k: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    if (connectFrom || editing) return
    if (multiSel.size > 0 && multiSel.has(k)) {
      setDragging({ key: k, multi: true })
    } else {
      setDragging({ key: k })
      setMultiSel(new Set())
    }
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
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
    if (draggingMemo) {
      const pt = svgPt(e.clientX, e.clientY)
      setMemos((p) => ({
        ...p,
        [draggingMemo.key]: {
          ...p[draggingMemo.key],
          dx: draggingMemo.origDx + pt.x - draggingMemo.startX,
          dy: draggingMemo.origDy + pt.y - draggingMemo.startY,
        },
      }))
      return
    }
    const pt = svgPt(e.clientX, e.clientY)
    if (connectFrom) {
      setConnectDragPt(pt)
      return
    }
    if (!dragging) return
    const cell = cellFromPos(pt.x, pt.y)
    if (dragging.multi) {
      if (!cell || cell.key === dragging.key) {
        setDragOverMulti(null)
        setMultiDragAnchorCell(null)
        return
      }
      const targets = calcMultiDropTargets(
        cell,
        dragging.key,
        multiSel,
        tasks,
        liMap,
        riMap,
        lanes,
        rows,
      )
      setDragOverMulti(targets)
      setMultiDragAnchorCell(targets ? { li: cell.li, ri: cell.ri } : null)
      setDragOver(null)
    } else {
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
      setDragOverMulti(null)
    }
  }
  const onSvgMouseUp = (e: React.MouseEvent): void => {
    if (draggingMemo) {
      const m = memos[draggingMemo.key]
      if (
        m &&
        Math.abs(m.dx - draggingMemo.origDx) < 3 &&
        Math.abs(m.dy - draggingMemo.origDy) < 3
      ) {
        setEditingMemo(draggingMemo.key)
      }
      setDraggingMemo(null)
      return
    }
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
          const srcTask = tasks[connectFrom]
          let fromSide: ArrowSide | undefined
          if (srcTask?.shape === 'diamond' && connectFromPt) {
            const srcLi = liMap[srcTask.lid]
            const srcRi = riMap[srcTask.rid]
            if (srcLi !== undefined && srcRi !== undefined) {
              const sc = ct(srcLi, srcRi)
              fromSide = deriveFromSide(connectFromPt, sc)
            }
          }
          setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '', fromSide }])
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
    if (dragging.multi && dragOverMulti && multiDragAnchorCell) {
      moveMultiTasks(dragging.key, multiSel, multiDragAnchorCell.li, multiDragAnchorCell.ri)
      setDragging(null)
      setDragOver(null)
      setDragOverMulti(null)
      setMultiDragAnchorCell(null)
      setMultiSel(new Set())
      return
    }
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
    setDragOverMulti(null)
    setMultiDragAnchorCell(null)
  }
  const moveTask = (
    fk: string,
    to: { lid: string; rid: string; key: string; li: number; ri: number },
  ): void => {
    const task = tasks[fk]
    if (!task) return
    const nk = to.key
    // Compute post-move state synchronously for triggerMoveRepairCheck
    const newTasks = { ...tasks }
    delete newTasks[fk]
    newTasks[nk] = { ...task, lid: to.lid, rid: to.rid }
    const newArrows = remapArrows(arrows, fk, nk)
    setTasks(newTasks)
    if (memos[fk])
      setMemos((p) => {
        const n = { ...p }
        n[nk] = n[fk]
        delete n[fk]
        return n
      })
    setOrder((p) => p.map((k) => (k === fk ? nk : k)))
    setArrows(newArrows)
    setSelTask(nk)
    const ri = rows.findIndex((r) => r.id === to.rid)
    if (ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
    if (editorSettings.autoRepair) triggerMoveRepairCheck(nk, to.lid, newArrows, newTasks)
  }
  const swapInsertNodes = (draggedKey: string, targetKey: string): void => {
    const result = swapKeys(tasks, arrows, order, memos, draggedKey, targetKey)
    if (!result) return
    setTasks(result.tasks)
    setMemos(result.memos)
    setOrder(result.order)
    setArrows(result.arrows)
    setSelTask(result.newKeyA)
    if (editorSettings.autoRepair)
      triggerMoveRepairCheck(result.newKeyA, tasks[draggedKey].lid, result.arrows, result.tasks)
  }
  const moveMultiTasks = (
    anchorKey: string,
    selected: Set<string>,
    anchorTargetLi: number,
    anchorTargetRi: number,
  ): void => {
    const anchorTask = tasks[anchorKey]
    if (!anchorTask) return
    const anchorLi = liMap[anchorTask.lid]
    const anchorRi = riMap[anchorTask.rid]
    const dLi = anchorTargetLi - anchorLi
    const dRi = anchorTargetRi - anchorRi

    const keyMap = new Map<string, string>()
    const posMap = new Map<string, { lid: string; rid: string }>()

    for (const k of selected) {
      const t = tasks[k]
      if (!t) continue
      const newLi = liMap[t.lid] + dLi
      const newRi = riMap[t.rid] + dRi
      const newKey = ky(lanes[newLi].id, rows[newRi].id)
      keyMap.set(k, newKey)
      posMap.set(newKey, { lid: lanes[newLi].id, rid: rows[newRi].id })
    }

    const newTasks = { ...tasks }
    for (const oldK of keyMap.keys()) delete newTasks[oldK]
    for (const [oldK, newK] of keyMap) {
      const pos = posMap.get(newK)!
      newTasks[newK] = { ...tasks[oldK], lid: pos.lid, rid: pos.rid }
    }
    setTasks(newTasks)

    setMemos((p) => {
      const n = { ...p }
      const moved: [string, MemoData][] = []
      for (const [oldK] of keyMap) {
        if (n[oldK]) moved.push([oldK, n[oldK]])
      }
      for (const [oldK] of moved) delete n[oldK]
      for (const [oldK, val] of moved) n[keyMap.get(oldK)!] = val
      return n
    })

    setOrder((p) => p.map((k) => keyMap.get(k) ?? k))
    const newArrows = remapArrowsBatch(arrows, keyMap)
    setArrows(newArrows)

    let maxRi = 0
    for (const [, newK] of keyMap) {
      const pos = posMap.get(newK)!
      const ri = riMap[pos.rid]
      if (ri > maxRi) maxRi = ri
    }
    if (maxRi === rows.length - 1) setRows((p) => [...p, { id: uid() }])

    for (const [, newK] of keyMap) {
      const pos = posMap.get(newK)!
      if (editorSettings.autoRepair) triggerMoveRepairCheck(newK, pos.lid, newArrows, newTasks)
    }
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
      preEditLabelRef.current = tasks[k].label
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
      setSelTask(null)
      setSelArrow(null)
      return
    }
    let label = t('defaultNodeLabel')
    if (editorSettings.copyLabelOnSameRow) {
      let bestKey: string | null = null
      let bestDist = Infinity
      let bestLi = Infinity
      for (const [key, task] of Object.entries(tasks)) {
        if (task.rid !== rid || key === k) continue
        const tLi = lanes.findIndex((l) => l.id === task.lid)
        if (tLi < 0) continue
        const dist = Math.abs(tLi - li)
        if (dist < bestDist || (dist === bestDist && tLi < bestLi)) {
          bestKey = key
          bestDist = dist
          bestLi = tLi
        }
      }
      if (bestKey) label = tasks[bestKey].label
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
      preEditLabelRef.current = label
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
    // 親レーン削除時: 同一グループのサブレーンをグループ解除
    const deleting = lanes.find((l) => l.id === id)
    if (deleting && isGroupParent(deleting) && deleting.groupId) {
      const gid = deleting.groupId
      setLanes((p) =>
        p
          .filter((l) => l.id !== id)
          .map((l) => (l.groupId === gid ? { ...l, groupId: undefined, groupRole: undefined } : l)),
      )
    } else {
      setLanes((p) => p.filter((l) => l.id !== id))
    }
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

  const ungroupLane = (laneId: string): void => {
    const lane = lanes.find((l) => l.id === laneId)
    if (!lane?.groupId) return
    const gid = lane.groupId
    // Reset suggestion tracking so re-grouping the same lane is possible
    const groupLaneIds = lanes.filter((l) => l.groupId === gid).map((l) => l.id)
    for (const id of groupLaneIds) suggestedLanesRef.current.delete(id)
    setLanes((prev) =>
      prev.map((l) => (l.groupId === gid ? { ...l, groupId: undefined, groupRole: undefined } : l)),
    )
    addSuccessToast({ message: t('toast.ungrouped') })
  }

  const suggestLaneSplit = (laneId: string): void => {
    if (suggestedLanesRef.current.has(laneId)) return
    const lane = lanes.find((l) => l.id === laneId)
    if (!lane || lane.groupId) return
    suggestedLanesRef.current.add(laneId)
    const laneName = lane.name
    setTimeout(() => {
      addConfirmToast({
        message: t('confirm.splitLaneTitle'),
        detail: t('confirm.splitLaneMessage', { laneName }),
        confirmLabel: t('confirm.splitLaneConfirm'),
        successMessage: t('confirm.splitLaneSuccess'),
        onConfirm: () => {
          const groupId = uid()
          const newSubId = uid()
          setLanes((prev) => {
            const idx = prev.findIndex((l) => l.id === laneId)
            if (idx < 0) return prev
            if (prev[idx].groupId) return prev // Already grouped — avoid orphaning sub-lanes
            const n = [...prev]
            n[idx] = { ...n[idx], groupId, groupRole: 'parent' }
            n.splice(idx + 1, 0, {
              id: newSubId,
              name: `${n[idx].name} (2)`,
              ci: n[idx].ci,
              groupId,
              groupRole: 'sub',
            })
            return n
          })
          triggerLaneSlideIn(newSubId)
        },
      })
    }, 500)
  }

  // 全タスクの中心座標を1度だけ収集（同一行 obstacles 判定で aPath 経由で再利用）
  const obstacleNodes: ObstacleNode[] = []
  for (const [k, t] of Object.entries(tasks)) {
    const li = liMap[t.lid]
    const ri = riMap[t.rid]
    if (li === undefined || ri === undefined) continue
    const c = ct(li, ri)
    obstacleNodes.push({ key: k, cx: c.x, cy: c.y })
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

    // 同一行/同一レーン/斜め配置に応じて obstacles を組み立てる（迂回判定用）
    const obstacles: Bbox[] = buildObstacles({
      nodes: obstacleNodes,
      fromKey: arrow.from,
      toKey: arrow.to,
      fromCx: from.x,
      fromCy: from.y,
      toCx: to.x,
      toCy: to.y,
      sameRow: fri === tri,
      sameLane: fli === tli,
      rowH: RH,
      colW: LW + G,
      bboxW: TW,
      bboxH: TH,
    })

    return calcArrowPath(
      from,
      to,
      {
        hw: TW / 2,
        hh: TH / 2,
        rh: RH,
        fromShape: ft.shape ?? undefined,
        toShape: tt.shape ?? undefined,
        fromSide: arrow.fromSide,
      },
      obstacles,
    )
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

    let m = `%% ${t('mermaidComment')}\nflowchart LR\n`

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
      const arrowOp = a.bidirectional ? '<-->' : '-->'
      if (a.comment) {
        m += `    ${fromId} ${arrowOp}|${esc(a.comment)}| ${toId}\n`
      } else {
        m += `    ${fromId} ${arrowOp} ${toId}\n`
      }
    })

    return m
  }

  const exportJSON = (): string => {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        appVersion: __APP_VERSION__,
        gitHash: __GIT_HASH__,
        url: window.location.href,
      },
      flow: {
        title,
        themeId,
        lanes,
        rows,
        tasks,
        arrows,
        memos,
        order,
      },
      recentActions: historyRef.current.slice(-3).map((s, i) => ({
        index: i,
        snapshot: JSON.parse(s),
      })),
    }
    return JSON.stringify(payload, null, 2)
  }

  const downloadJSON = (): void => {
    const json = exportJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const sanitized = title.replace(/[^a-zA-Z0-9\u3040-\u9FFF_-]/g, '_').slice(0, 50)
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    a.href = url
    a.download = `flowline-${sanitized}-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const downloadPng = async (): Promise<void> => {
    if (!svgRef.current) return
    // svgW/svgH are zoom-scaled screen dimensions; the viewBox uses logical units (svgW/zoom).
    // PNG export must ignore current zoom, so we work in logical space.
    const logicalW = svgW / zoom
    const logicalH = svgH / zoom
    const decision = pickPixelRatio(logicalW, logicalH)
    if (decision.abort) {
      addErrorToast({ message: t('rightPanel.imagePngTooLarge') })
      return
    }
    setPngState('generating')
    const T = THEMES[themeId]
    const { node, cleanup } = buildExportSvg(
      svgRef.current,
      T.canvasBg,
      T.dotGrid,
      logicalW,
      logicalH,
      editorSettings.showDotGrid,
      headerSvgRef.current,
    )
    try {
      // html-to-image's toBlob is typed for HTMLElement but supports SVG at runtime
      const blob = await toBlob(node as unknown as HTMLElement, {
        pixelRatio: decision.pixelRatio,
      })
      if (!blob) throw new Error('toBlob returned null')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const sanitized = title.replace(/[^a-zA-Z0-9぀-鿿_-]/g, '_').slice(0, 50)
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      a.href = url
      a.download = `flowline-${sanitized}-${ts}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 100)
      if (decision.downgraded) {
        addInfoToast({ message: t('rightPanel.imagePngLowRes') })
      }
      setPngState('done')
      if (pngTimerRef.current) clearTimeout(pngTimerRef.current)
      pngTimerRef.current = setTimeout(() => setPngState('idle'), 1500)
    } catch {
      addErrorToast({ message: t('rightPanel.imagePngFailed') })
      setPngState('idle')
    } finally {
      cleanup()
    }
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
    setLaneDropdown(null)
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

  const sideTools: (SideTool | 'sep')[] = [
    { id: 'select', icon: I.cursor, tip: t('toolbar.select') },
    { id: 'connect', icon: I.connect, tip: t('toolbar.connect') },
    'sep',
    { id: 'addRow', icon: I.addRow, tip: t('toolbar.addRow'), action: addRow },
    { id: 'rmRow', icon: I.rmRow, tip: t('toolbar.removeRow'), action: rmRow },
    'sep',
    {
      id: 'zoomIn',
      icon: I.zoomIn,
      tip: t('toolbar.zoomIn'),
      action: () => setZoom((z) => Math.min(2, z + 0.1)),
    },
    {
      id: 'zoomOut',
      icon: I.zoomOut,
      tip: t('toolbar.zoomOut'),
      action: () => setZoom((z) => Math.max(0.4, z - 0.1)),
    },
    'sep',
    { id: 'export', icon: I.export, tip: 'Export', action: () => setShowExport((v) => !v) },
  ]

  // --- Status bar text ---
  const saveStatusText: Record<SaveStatus, string> = {
    saved: t('save.saved'),
    saving: t('save.saving'),
    unsaved: t('save.unsaved'),
    error: t('save.error'),
  }

  const bodyPhysicalH = Math.max(
    containerSize.height - (TM + HH + 30) * zoom,
    (rows.length * RH + 60) * zoom,
  )

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
        {!hideShare && (
          <button
            data-testid="share-button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              setShowShareDialog(true)
            }}
            className={`${styles.shareButton} ${shareToken ? styles.shareButtonActive : styles.shareButtonInactive}`}
          >
            {shareToken ? t('share.sharing') : t('share.shareBtn')}
          </button>
        )}
        <div className={styles.spacer} />
        {connectFrom && (
          <div className={styles.connectBanner}>
            <span className={styles.connectBannerText}>{t('connectBanner')}</span>
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
        {saveCtaLabel ? (
          <button
            data-testid="save-cta-button"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onSaveCtaClick?.()
            }}
            className={styles.saveCtaButton}
          >
            {saveCtaLabel}
          </button>
        ) : (
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
        )}
        <span className={styles.zoomPercent}>{Math.round(zoom * 100)}%</span>
        <button
          data-testid="editor-user-avatar"
          onClick={(e) => {
            e.stopPropagation()
            if (!isDemo) setMenuOpen((v) => !v)
          }}
          className={styles.editorAvatar}
        >
          {user?.name ? user.name.charAt(0).toUpperCase() : 'G'}
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
            <span className={styles.fileButtonText}>{t('fileButton')}</span>
            <span className={styles.toolTip}>{t('fileButtonTip')}</span>
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
            ref={headerSvgRef}
            data-testid="canvas-header-svg"
            width={svgW}
            height={(TM + HH + 30) * zoom}
            viewBox={`0 -30 ${svgW / zoom} ${TM + HH + 30}`}
            className={styles.headerSvg}
          >
            {/* Lane headers (sticky) */}
            {lanes.map((lane, li) => {
              const p = PALETTES[lane.ci]
              const x = laneX(li)
              const isSub = isGroupSub(lane)
              const isParent = isGroupParent(lane)
              const headerW = isParent ? getGroupWidth(lane, lanes, LW, G) : LW
              if (isSub) return null
              return (
                <g
                  key={`lane-header-${lane.id}`}
                  className={lane.id === slidingLaneId ? styles.laneSlideInAnim : undefined}
                >
                  <rect x={x} y={TM} width={headerW} height={HH} rx={10} fill={T.laneHeaderBg} />
                  <rect x={x} y={TM + HH - 10} width={headerW} height={10} fill={T.laneHeaderBg} />
                  {selLane === lane.id && (
                    <rect
                      x={x + 1}
                      y={TM + 1}
                      width={headerW - 2}
                      height={HH - 2}
                      rx={9}
                      fill="none"
                      stroke={T.accent}
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      opacity={0.5}
                    />
                  )}
                  <rect
                    x={x + 16}
                    y={TM + HH - 2.5}
                    width={headerW - 32}
                    height={2}
                    rx={1}
                    fill={p.dot}
                    opacity={T.laneAccentOpacity}
                  />
                  <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                  <rect
                    x={x}
                    y={TM}
                    width={headerW}
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
                      setTimeout(() => laneInputRef.current?.focus(), 40)
                    }}
                  />
                  {editLane === lane.id ? (
                    <foreignObject x={x + 32} y={TM + 9} width={headerW - 44} height={28}>
                      <input
                        ref={laneInputRef}
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
                </g>
              )
            })}
            {/* Gap "+" hit + button (header side) */}
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
                <g key={`gap-h-${gi}`}>
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
                      if (lanes.length === 0) {
                        insertLaneAt(gi)
                      } else {
                        setLaneDropdown({ gapIndex: gi, x: gx, y: gy + 16 })
                      }
                    }}
                  />
                  {isHov && (
                    <g style={{ pointerEvents: 'none' }}>
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
          </svg>
          <svg
            ref={svgRef}
            data-testid="canvas-svg"
            width={svgW}
            height={bodyPhysicalH}
            viewBox={`0 ${TM + HH} ${svgW / zoom} ${bodyPhysicalH / zoom}`}
            className={styles.bodySvg}
            style={{
              minWidth: '100%',
              cursor: draggingMemo ? 'grabbing' : undefined,
            }}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={() => {
              if (dragging) {
                setDragging(null)
                setDragOver(null)
                setDragOverMulti(null)
                setMultiDragAnchorCell(null)
              }
              if (connectFrom) {
                setConnectFrom(null)
                setConnectDragPt(null)
                setConnectFromPt(null)
                setActiveTool('select')
              }
              if (draggingMemo) setDraggingMemo(null)
            }}
          >
            {/* Lanes */}
            {lanes.map((lane, li) => {
              const x = laneX(li),
                isSel = selLane === lane.id,
                fullH = HH + rows.length * RH
              const isSub = isGroupSub(lane)
              return (
                <g
                  key={`lane-${lane.id}`}
                  className={lane.id === slidingLaneId ? styles.laneSlideInAnim : undefined}
                >
                  <rect
                    x={x}
                    y={isSub ? TM + HH : TM}
                    width={LW}
                    height={isSub ? fullH - HH : fullH}
                    rx={isSub ? 0 : 10}
                    fill={T.laneBg}
                    stroke={T.laneBorder}
                    strokeWidth={0.5}
                  />
                  {isSel && (
                    <rect
                      x={x + 1}
                      y={TM + HH + 1}
                      width={LW - 2}
                      height={fullH - HH - 2}
                      rx={0}
                      fill="none"
                      stroke={T.accent}
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      opacity={0.5}
                    />
                  )}
                  {isSub && (
                    <line
                      x1={x}
                      y1={TM + 6}
                      x2={x}
                      y2={TM + HH + rows.length * RH}
                      stroke={T.laneBorder}
                      strokeWidth={1.5}
                      strokeDasharray="4,3"
                      opacity={0.4}
                    />
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

            {/* Gap "+" hover dashed line (body side) */}
            {Array.from({ length: lanes.length + 1 }, (_, gi) => {
              if (hoveredLaneGap !== gi) return null
              const gx =
                gi === 0
                  ? LM - G / 2
                  : gi === lanes.length
                    ? laneX(gi - 1) + LW + G / 2
                    : laneX(gi) - G / 2
              return (
                <line
                  key={`gap-line-${gi}`}
                  x1={gx}
                  y1={TM + HH}
                  x2={gx}
                  y2={TM + HH + rows.length * RH}
                  stroke={T.accent}
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                  opacity={0.3}
                  style={{ pointerEvents: 'none' }}
                />
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
                  isDT = dragOver === k || (dragOverMulti?.has(k) ?? false)
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
                          {t('defaultNodeLabel')}
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
                          {t('ghostClickConfirm')}
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
                  task = tasks[k]
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
                    opacity={isDT || (dragging?.multi && multiSel.has(k)) ? 0.3 : 1}
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
                        fill={
                          isRepairTarget
                            ? `${T.accent}1F`
                            : isConnTgt && isHov
                              ? `${T.accent}0A`
                              : task.bg || T.nodeFill
                        }
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
                          preEditLabelRef.current = tasks[k].label
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
                        fill={
                          isRepairTarget
                            ? `${T.accent}1F`
                            : isConnTgt && isHov
                              ? `${T.accent}0A`
                              : task.bg || T.nodeFill
                        }
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
                          preEditLabelRef.current = tasks[k].label
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
                          {t('swapBadge')}
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
                      (() => {
                        const editingValue = task.label === t('defaultNodeLabel') ? '' : task.label
                        const editingLines = Math.max(1, editingValue.split('\n').length)
                        const lineHeightPx = 18
                        const baseH = isDiamond ? 24 : TH - 22
                        const expandedH = baseH + (editingLines - 1) * lineHeightPx
                        return (
                          <foreignObject
                            x={isDiamond ? c.x - DS + 4 : c.x - TW / 2 + 8}
                            y={isDiamond ? c.y - 10 : c.y - TH / 2 + 18}
                            width={isDiamond ? DS * 2 - 8 : TW - 16}
                            height={expandedH}
                          >
                            <textarea
                              ref={inputRef}
                              value={editingValue}
                              placeholder={t('defaultNodeLabel')}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                const v = e.target.value
                                setTasks((p2) => ({
                                  ...p2,
                                  [k]: { ...p2[k], label: v || t('defaultNodeLabel') },
                                }))
                              }}
                              onBlur={() => {
                                preEditLabelRef.current = null
                                setEditing(null)
                              }}
                              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                e.stopPropagation()
                                if (e.nativeEvent.isComposing) return
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  preEditLabelRef.current = null
                                  setEditing(null)
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  const original = preEditLabelRef.current
                                  if (original !== null) {
                                    setTasks((p2) => ({
                                      ...p2,
                                      [k]: { ...p2[k], label: original },
                                    }))
                                  }
                                  preEditLabelRef.current = null
                                  setEditing(null)
                                }
                              }}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              className={styles.nodeEditTextarea}
                            />
                          </foreignObject>
                        )
                      })()
                    ) : (
                      <NodeLabelText
                        label={task.label}
                        cx={c.x}
                        cy={c.y}
                        isDiamond={isDiamond}
                        defaultLabel={t('defaultNodeLabel')}
                        fillDefault={T.statusText}
                        fillTitle={T.titleColor}
                      />
                    )}
                    {/* Memo rendering is now handled by the dedicated MemoOverlay component */}
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
                      markerWidth={ARROW_MARKER.width}
                      markerHeight={ARROW_MARKER.height}
                      refX={ARROW_MARKER.refX}
                      refY={ARROW_MARKER.refY}
                      orient="auto"
                    >
                      <polygon
                        points={ARROW_MARKER.points}
                        fill={isSel ? arrow.color || T.accent : ac}
                      />
                    </marker>
                    {arrow.bidirectional && (
                      <marker
                        id={`m-start-${arrow.id}`}
                        markerWidth={ARROW_MARKER.width}
                        markerHeight={ARROW_MARKER.height}
                        refX={ARROW_MARKER.refX}
                        refY={ARROW_MARKER.refY}
                        orient="auto-start-reverse"
                      >
                        <polygon
                          points={ARROW_MARKER.points}
                          fill={isSel ? arrow.color || T.accent : ac}
                        />
                      </marker>
                    )}
                  </defs>
                  <path
                    d={d}
                    stroke={isSel ? selC : ac}
                    strokeWidth={isSel ? 2.5 : 2}
                    strokeDasharray={dashArr}
                    fill="none"
                    markerStart={arrow.bidirectional ? `url(#m-start-${arrow.id})` : undefined}
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
                        {t('ghostClickConfirm')}
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
                  markerWidth={ARROW_MARKER.width}
                  markerHeight={ARROW_MARKER.height}
                  refX={ARROW_MARKER.refX}
                  refY={ARROW_MARKER.refY}
                  orient="auto"
                >
                  <polygon points={ARROW_MARKER.points} fill={T.accent} opacity={0.6} />
                </marker>
              </defs>
            ))}

            {/* Arrow Toolbar */}
            {selArrow &&
              (() => {
                const ap = arrowPaths.find((x) => x.arrow.id === selArrow)
                if (!ap) return null
                const { mx, my } = ap.path
                const arrow = ap.arrow
                return (
                  <Toolbar
                    x={mx}
                    y={my + 10}
                    items={[
                      {
                        icon: <IconReverse />,
                        action: 'reverse',
                        color: T.accent,
                        hoverBg: `${T.accent}10`,
                      },
                      {
                        icon: <IconMemo />,
                        action: 'comment',
                        color: arrow.comment ? '#E8A817' : T.commentIconColor,
                        hoverBg: '#FFFDE7',
                      },
                      {
                        icon: <IconTrash />,
                        action: 'delete',
                        color: T.dangerColor,
                        hoverBg: '#FEE',
                      },
                    ]}
                    onAction={(action) => {
                      if (action === 'reverse') {
                        setArrows((p) =>
                          p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)),
                        )
                      } else if (action === 'comment') {
                        setEditArrowComment(selArrow)
                        setSelArrow(null)
                      } else if (action === 'delete') {
                        setArrows((p) => p.filter((a) => a.id !== selArrow))
                        setSelArrow(null)
                      }
                    }}
                    theme={T}
                  />
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
                      placeholder={t('arrowCommentPlaceholder')}
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

            {/* Lane dropdown menu — rendered last for z-order */}
            {laneDropdown &&
              (() => {
                const gi = laneDropdown.gapIndex
                const leftLane = gi > 0 ? lanes[gi - 1] : null
                const rightLane = gi < lanes.length ? lanes[gi] : null
                const isInsideGroup =
                  leftLane &&
                  rightLane &&
                  !!leftLane.groupId &&
                  leftLane.groupId === rightLane.groupId
                const dropdownX = Math.max(10, Math.min(laneDropdown.x - 100, totalW - 230))
                return (
                  <foreignObject
                    x={dropdownX}
                    y={laneDropdown.y}
                    width={220}
                    height={300}
                    style={{ overflow: 'visible' }}
                  >
                    <div className={styles.laneDropdown} onClick={(e) => e.stopPropagation()}>
                      {!isInsideGroup && (
                        <button
                          className={styles.laneDropdownItem}
                          onClick={() => {
                            insertLaneAt(laneDropdown.gapIndex)
                            setLaneDropdown(null)
                          }}
                        >
                          {t('addNewLane')}
                        </button>
                      )}
                      {(() => {
                        // グループ内のギャップでは結合候補を非表示
                        if (isInsideGroup) return null
                        const candidates = [leftLane, rightLane].filter(
                          (l): l is InternalLane => l !== null,
                        )
                        if (candidates.length === 0) return null
                        // 重複排除: 同じ結合先（親レーン）を指す候補を1つにまとめる
                        const seen = new Set<string>()
                        const uniqueCandidates = candidates.filter((l) => {
                          const resolvedId =
                            l.groupRole === 'sub'
                              ? lanes.find(
                                  (p) => p.groupId === l.groupId && p.groupRole === 'parent',
                                )?.id || l.id
                              : l.id
                          if (seen.has(resolvedId)) return false
                          seen.add(resolvedId)
                          return true
                        })
                        if (uniqueCandidates.length === 0) return null
                        return (
                          <>
                            <div className={styles.laneDropdownSeparator} />
                            <div className={styles.laneDropdownLabel}>{t('mergeToExisting')}</div>
                            {uniqueCandidates.map((l) => {
                              const displayName =
                                l.groupRole === 'sub'
                                  ? lanes.find(
                                      (p) => p.groupId === l.groupId && p.groupRole === 'parent',
                                    )?.name || l.name
                                  : l.name
                              return (
                                <button
                                  key={l.id}
                                  className={styles.laneDropdownItem}
                                  onClick={() =>
                                    mergeLaneAt(
                                      laneDropdown.gapIndex,
                                      l.groupRole === 'sub'
                                        ? lanes.find(
                                            (p) =>
                                              p.groupId === l.groupId && p.groupRole === 'parent',
                                          )?.id || l.id
                                        : l.id,
                                    )
                                  }
                                >
                                  {t('mergeTo', { name: displayName })}
                                </button>
                              )
                            })}
                          </>
                        )
                      })()}
                    </div>
                  </foreignObject>
                )
              })()}

            {/* Memo Layer (sticky notes) */}
            {Object.entries(memos).map(([k, m]) => {
              const task = tasks[k]
              if (!task) return null
              const li = liMap[task.lid],
                ri = riMap[task.rid]
              if (li === undefined || ri === undefined) return null
              const c = ct(li, ri)
              const mh = measureMemoHeight(m.text || '', MEMO_W)
              const mx = c.x + m.dx - MEMO_W / 2
              const my = c.y + m.dy
              const isDragging = draggingMemo?.key === k
              const isEditing = editingMemo === k
              const isHov = hoveredMemo === k

              return (
                <g key={`memo-${k}`} data-testid="memo-note">
                  {/* Dashed connector */}
                  <line
                    x1={c.x}
                    y1={c.y + TH / 2}
                    x2={mx + MEMO_W / 2}
                    y2={my}
                    stroke={T.memoConnector}
                    strokeWidth={1.2}
                    opacity={0.5}
                    strokeDasharray="4,3"
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={c.x}
                    cy={c.y + TH / 2}
                    r={2.5}
                    fill={T.memoConnector}
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={mx + MEMO_W / 2}
                    cy={my}
                    r={2.5}
                    fill={T.memoConnector}
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
                  />

                  {!isEditing ? (
                    <g
                      onMouseDown={(e: React.MouseEvent) => onMemoMouseDown(k, e)}
                      onMouseEnter={() => setHoveredMemo(k)}
                      onMouseLeave={() => setHoveredMemo(null)}
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                      <rect
                        x={mx}
                        y={my}
                        width={MEMO_W}
                        height={mh}
                        rx={7}
                        fill={T.memoBg}
                        stroke={isHov || isDragging ? T.memoBorderHover : T.memoBorder}
                        strokeWidth={isHov || isDragging ? 1.2 : 0.7}
                        opacity={0.96}
                        style={{
                          filter: isDragging
                            ? 'drop-shadow(0 4px 12px rgba(180,160,0,0.2))'
                            : 'drop-shadow(0 1px 3px rgba(180,160,0,0.08))',
                        }}
                      />
                      {/* Grip dots on hover */}
                      {isHov && !isDragging && (
                        <g opacity={0.35}>
                          {[0, 4, 8].map((dy) => (
                            <g key={dy}>
                              <circle
                                cx={mx + MEMO_W - 10}
                                cy={my + 10 + dy}
                                r={1}
                                fill={T.memoText}
                              />
                              <circle
                                cx={mx + MEMO_W - 14}
                                cy={my + 10 + dy}
                                r={1}
                                fill={T.memoText}
                              />
                            </g>
                          ))}
                        </g>
                      )}
                      {m.text ? (
                        <foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
                          <MemoText text={m.text} color={T.memoText} />
                        </foreignObject>
                      ) : (
                        <text
                          x={mx + MEMO_W / 2}
                          y={my + mh / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={10}
                          fill={T.memoConnector}
                          style={{ fontFamily: 'inherit', pointerEvents: 'none' }}
                        >
                          {t('memoClickToEdit')}
                        </text>
                      )}
                    </g>
                  ) : (
                    <foreignObject x={mx - 1} y={my - 1} width={MEMO_W + 2} height={160}>
                      <div
                        style={{
                          background: T.memoBg,
                          border: `1.5px solid ${T.memoBorderHover}`,
                          borderRadius: 7,
                          padding: '2px',
                          boxShadow: '0 4px 16px rgba(200,180,0,0.18)',
                        }}
                      >
                        <textarea
                          autoFocus
                          value={m.text || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setMemos((p) => ({ ...p, [k]: { ...p[k], text: e.target.value } }))
                          }
                          onBlur={() => {
                            if (!memos[k]?.text) {
                              setMemos((p) => {
                                const n = { ...p }
                                delete n[k]
                                return n
                              })
                            }
                            setEditingMemo(null)
                          }}
                          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
                          }}
                          placeholder={t('memoPlaceholder')}
                          style={{
                            width: MEMO_W - 16,
                            minHeight: 24,
                            maxHeight: 160,
                            resize: 'none' as const,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 11,
                            lineHeight: '1.55',
                            color: T.memoText,
                            fontFamily: 'inherit',
                            padding: '4px 6px',
                          }}
                          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                            const t = e.target as HTMLTextAreaElement
                            t.style.height = 'auto'
                            t.style.height = t.scrollHeight + 'px'
                          }}
                        />
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}

            {/* Node Toolbar */}
            {selTask &&
              !connectFrom &&
              !dragging &&
              !editing &&
              multiSel.size === 0 &&
              tasks[selTask] &&
              (() => {
                const t = tasks[selTask]
                const li = liMap[t.lid],
                  ri = riMap[t.rid]
                if (li === undefined || ri === undefined) return null
                const c = ct(li, ri)
                const hasMemo = !!memos[selTask]
                return (
                  <Toolbar
                    x={c.x}
                    y={c.y + (t.shape === 'diamond' ? DS : TH / 2) + 8}
                    items={[
                      {
                        icon: <IconConnect />,
                        action: 'connect',
                        color: T.accent,
                        hoverBg: `${T.accent}10`,
                      },
                      {
                        icon: <IconMemo />,
                        action: 'memo',
                        color: hasMemo ? '#E8A817' : T.commentIconColor,
                        hoverBg: '#FFFDE7',
                      },
                      {
                        icon: <IconTrash />,
                        action: 'delete',
                        color: T.dangerColor,
                        hoverBg: '#FEE',
                      },
                    ]}
                    onAction={(action) => {
                      if (action === 'connect') {
                        setConnectFrom(selTask)
                        setSelTask(null)
                      } else if (action === 'memo') {
                        const key = selTask!
                        if (!memos[key]) {
                          const t = tasks[key]
                          const li = liMap[t.lid]
                          const dx = li < lanes.length / 2 ? 50 : -50
                          setMemos((p) => ({ ...p, [key]: { text: '', dx, dy: 46 } }))
                        }
                        setEditingMemo(key)
                        setSelTask(null)
                      } else if (action === 'delete') {
                        delTask(selTask!)
                      }
                    }}
                    theme={T}
                  />
                )
              })()}
          </svg>
        </div>

        {/* Right Panel */}
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={styles.rightPanel}>
          <div className={styles.rightPanelHeader}>
            <span className={styles.rightPanelTitle}>
              {multiSel.size > 0
                ? t('selectedCount', { count: multiSel.size })
                : selTask
                  ? t('propertyNode')
                  : selArrow
                    ? t('propertyArrow')
                    : selLane
                      ? t('propertyLane')
                      : t('propertyTitle')}
            </span>
          </div>
          <RightPanel
            multiSel={multiSel}
            setMultiSel={setMultiSel}
            selTask={selTask}
            selArrow={selArrow}
            setSelArrow={setSelArrow}
            selLane={selLane}
            tasks={tasks}
            setTasks={setTasks}
            memos={memos}
            setMemos={setMemos}
            arrows={arrows}
            setArrows={setArrows}
            lanes={lanes}
            setLanes={setLanes}
            rows={rows}
            order={order}
            themeId={themeId}
            setThemeId={setThemeId}
            showThemePicker={showThemePicker}
            setShowThemePicker={setShowThemePicker}
            editorSettings={editorSettings}
            updateEditorSetting={updateEditorSetting}
            delTask={delTask}
            delMultiSel={delMultiSel}
            startConnect={startConnect}
            moveLane={moveLane}
            rmLane={rmLane}
            ungroupLane={ungroupLane}
            onShapeChange={(taskKey: string, shape?: 'diamond') => {
              if (shape === 'diamond') {
                const lid = taskKey.split('_')[0]
                suggestLaneSplit(lid)
              }
            }}
            exportMermaid={exportMermaid}
            downloadJSON={downloadJSON}
            downloadPng={downloadPng}
            pngState={pngState}
          />
        </div>
      </div>

      {/* Status */}
      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {Object.keys(tasks).length} tasks {'·'} {arrows.length} connections
        </span>
        <span className={styles.statusTextFaded}>{t('hint.default')}</span>
        <div style={{ flex: 1 }} />
        <span className={styles.statusTextHint}>
          {multiSel.size > 0
            ? t('hint.multiSelect', { count: multiSel.size })
            : connectFrom
              ? t('hint.connecting')
              : dragging
                ? t('hint.dragging')
                : t('hint.normal')}
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
          if (hasExistingContent && !window.confirm(t('confirm.aiOverwrite'))) {
            return
          }
          const tempFlow: Flow = {
            id: flow.id,
            title: aiFlow.title,
            themeId: themeId,
            shareToken: shareToken,
            projectId: flow.projectId ?? null,
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
          setMemos(state.memos)
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
