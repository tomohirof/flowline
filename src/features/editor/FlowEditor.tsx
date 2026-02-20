import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { ShareDialog } from './components/ShareDialog'
import type {
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
import { PALETTES, THEMES } from './theme-constants'

const uid = (): string => crypto.randomUUID()

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
      <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  addRow: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="3" y="13" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rmRow: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="3" y="13" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="3,2" />
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

const PanelSection = ({ label, children, T }: { label?: string; children: ReactNode; T: Theme }) => (
  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.panelBorder}` }}>
    {label && (
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: T.panelLabel,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
    )}
    {children}
  </div>
)

const PanelRow = ({ label, children, T }: { label: string; children?: ReactNode; T: Theme }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    }}
  >
    <span style={{ fontSize: 11, color: T.panelLabel, fontWeight: 500 }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
  </div>
)

const PanelInput = ({
  value,
  onChange,
  placeholder,
  T,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  T: Theme
}) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%',
      height: 30,
      fontSize: 12,
      padding: '0 8px',
      border: `1px solid ${T.inputBorder}`,
      borderRadius: 6,
      outline: 'none',
      background: T.inputBg,
      color: T.panelText,
      fontFamily: 'inherit',
    }}
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
  T: Theme
  full?: boolean
}) => (
  <button
    onClick={onClick}
    style={{
      height: 28,
      padding: full ? '0' : '0 10px',
      width: full ? '100%' : 'auto',
      border: `1px solid ${color}30`,
      borderRadius: 6,
      background: bg || `${color}10`,
      color,
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'inherit',
      transition: 'all 0.1s',
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
  const rows: RowData[] = Array.from({ length: maxRow + 1 }, () => ({ id: uid() }))

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
      tasks[key] = { label: n.label, lid: n.laneId, rid: rows[ri].id, nodeId: n.id }
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
      return { id: a.id, from, to, comment: a.comment ?? '' }
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
}

// =============================================
// FlowEditor Component
// =============================================

export default function FlowEditor({ flow, onSave, saveStatus, onShareChange }: FlowEditorProps) {
  // Initialize state from flow data (lazy initialization to avoid recomputing on every render)
  const [initState] = useState(() => flowToInternalState(flow))
  const [lanes, setLanes] = useState<InternalLane[]>(initState.lanes)
  const [rows, setRows] = useState<RowData[]>(initState.rows)
  const [tasks, setTasks] = useState<Record<string, TaskData>>(initState.tasks)
  const [order, setOrder] = useState<string[]>(initState.order)
  const [arrows, setArrows] = useState<InternalArrow[]>(initState.arrows)
  const [notes, setNotes] = useState<Record<string, string>>(initState.notes)

  const [editing, setEditing] = useState<string | null>(null)
  const [editLane, setEditLane] = useState<string | null>(null)
  const [selTask, setSelTask] = useState<string | null>(null)
  const [selArrow, setSelArrow] = useState<string | null>(null)
  const [selLane, setSelLane] = useState<string | null>(null)
  const [editNote, setEditNote] = useState<string | null>(null)
  const [showExport, setShowExport] = useState<boolean>(false)
  const [title, setTitle] = useState<string>(initState.title)
  const [editTitle, setEditTitle] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredLaneGap, setHoveredLaneGap] = useState<number | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId | string>('select')
  const [themeId, setThemeId] = useState<ThemeId>(initState.themeId)
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false)
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false)
  const [shareToken, setShareToken] = useState<string | null>(flow.shareToken)
  const inputRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // --- Notify parent of changes ---
  const prevSnapRef = useRef<string>('')

  const buildPayload = useCallback((): FlowSavePayload => {
    return internalStateToPayload(lanes, rows, tasks, order, arrows, notes, title, themeId)
  }, [lanes, rows, tasks, order, arrows, notes, title, themeId])

  useEffect(() => {
    const snap = JSON.stringify({ tasks, order, arrows, notes, lanes, rows, title, themeId })
    if (prevSnapRef.current && prevSnapRef.current !== snap) {
      onSave(buildPayload())
    }
    prevSnapRef.current = snap
  }, [tasks, order, arrows, notes, lanes, rows, title, themeId, onSave, buildPayload])

  // Re-initialize when flow prop changes (e.g., after reload)
  const flowIdRef = useRef<string>(flow.id)
  useEffect(() => {
    if (flow.id !== flowIdRef.current) {
      flowIdRef.current = flow.id
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
      prevSnapRef.current = ''
    }
  }, [flow])

  // --- Undo / Redo ---
  const historyRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const skipSnap = useRef<boolean>(false)

  const snap = useCallback((): string =>
    JSON.stringify({
      tasks,
      order,
      arrows,
      notes,
      lanes: lanes.map((l) => ({ ...l })),
      rows: rows.map((r) => ({ ...r })),
    }), [tasks, order, arrows, notes, lanes, rows])

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

  const applySnap = (s: string): void => {
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
    setEditing(null)
    undoPrevSnap.current = s
  }

  const undo = useCallback((): void => {
    if (historyRef.current.length === 0) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, snap()]
    applySnap(prev)
  }, [snap])

  const redo = useCallback((): void => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    historyRef.current = [...historyRef.current, snap()]
    applySnap(next)
  }, [snap])

  const T = THEMES[themeId]
  const LW = 178, RH = 84, HH = 46, TW = 144, TH = 52, LM = 28, TM = 24, G = T.laneGap
  const totalW = LM + lanes.length * LW + (lanes.length - 1) * G + 28
  const totalH = TM + HH + rows.length * RH + 40
  const svgW = Math.max(containerSize.width, (totalW + LM) * zoom)
  const svgH = Math.max(containerSize.height, (totalH + 30 + TM) * zoom)
  const ky = (lid: string, rid: string): string => `${lid}_${rid}`
  const liMap: Record<string, number> = {}
  lanes.forEach((l, i) => (liMap[l.id] = i))
  const riMap: Record<string, number> = {}
  rows.forEach((r, i) => (riMap[r.id] = i))
  const laneX = (li: number): number => LM + li * (LW + G)
  const ct = useCallback(
    (li: number, ri: number): Point => ({ x: laneX(li) + LW / 2, y: TM + HH + ri * RH + RH / 2 }),
    [lanes.length, G],
  )
  const isDark = themeId === 'midnight'

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
        if (selArrow) {
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
        setSelTask(null)
        setSelArrow(null)
        setSelLane(null)
        setDragging(null)
        setDragOver(null)
        setActiveTool('select')
        setShowThemePicker(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selArrow, selTask, editing, editLane, editTitle, editNote, undo, redo])

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
  const cellFromPos = (sx: number, sy: number): CellInfo | null => {
    for (let li = 0; li < lanes.length; li++)
      for (let ri = 0; ri < rows.length; ri++) {
        const cx = laneX(li), cy = TM + HH + ri * RH
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
  }
  const onSvgMouseMove = (e: React.MouseEvent): void => {
    if (!dragging) return
    const pt = svgPt(e.clientX, e.clientY)
    const cell = cellFromPos(pt.x, pt.y)
    setDragOver(cell && cell.key !== dragging.key && !tasks[cell.key] ? cell.key : null)
  }
  const onSvgMouseUp = (): void => {
    if (!dragging) return
    if (dragOver) {
      for (let li = 0; li < lanes.length; li++)
        for (let ri = 0; ri < rows.length; ri++)
          if (ky(lanes[li].id, rows[ri].id) === dragOver) {
            moveTask(dragging.key, { lid: lanes[li].id, rid: rows[ri].id, key: dragOver, li, ri })
            setDragging(null)
            setDragOver(null)
            return
          }
    }
    setDragging(null)
    setDragOver(null)
  }
  const moveTask = (fk: string, to: { lid: string; rid: string; key: string; li: number; ri: number }): void => {
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
    setArrows((p) =>
      p.map((a) => ({ ...a, from: a.from === fk ? nk : a.from, to: a.to === fk ? nk : a.to })),
    )
    setSelTask(nk)
    const ri = rows.findIndex((r) => r.id === to.rid)
    if (ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
  }
  const cellClick = (lid: string, rid: string, _li: number, ri: number): void => {
    const k = ky(lid, rid)
    if (connectFrom) {
      if (k !== connectFrom && tasks[k])
        setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
      setConnectFrom(null)
      setActiveTool('select')
      return
    }
    if (tasks[k]) {
      setEditing(k)
      setSelArrow(null)
      setTimeout(() => inputRef.current?.focus(), 40)
      return
    }
    setTasks((p) => ({ ...p, [k]: { label: '作業', lid, rid, nodeId: uid() } }))
    const no = [...order, k]
    setOrder(no)
    if (no.length >= 2 && tasks[no[no.length - 2]])
      setArrows((p) => [...p, { id: uid(), from: no[no.length - 2], to: k, comment: '' }])
    setEditing(k)
    setSelArrow(null)
    setTimeout(() => inputRef.current?.focus(), 40)
    if (ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
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
    setSelTask(selTask === k ? null : k)
    setSelArrow(null)
    setSelLane(null)
  }
  const startConnect = (k: string): void => {
    setConnectFrom(k)
    setSelTask(null)
    setActiveTool('connect')
  }
  const delTask = (k: string): void => {
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
    setArrows((p) => p.filter((a) => a.from !== k && a.to !== k))
    setEditing(null)
    setSelTask(null)
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
      setArrows((p) => p.filter((a) => !rm.includes(a.from) && !rm.includes(a.to)))
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
      setArrows((p) => p.filter((a) => !rm.includes(a.from) && !rm.includes(a.to)))
    }
  }

  const edgePt = (c: Point, o: Point, hw: number, hh: number): Point => {
    const dx = o.x - c.x, dy = o.y - c.y
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y + hh }
    if (Math.abs(dy) / hh > Math.abs(dx) / hw) return { x: c.x, y: c.y + (dy > 0 ? hh : -hh) }
    return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  }
  const aPath = (arrow: InternalArrow): ArrowPathResult | null => {
    const ft = tasks[arrow.from], tt = tasks[arrow.to]
    if (!ft || !tt) return null
    const fli = liMap[ft.lid], fri = riMap[ft.rid], tli = liMap[tt.lid], tri = riMap[tt.rid]
    if ([fli, fri, tli, tri].some((v) => v === undefined)) return null
    const f = ct(fli, fri), t = ct(tli, tri), hw = TW / 2, hh = TH / 2
    const s = edgePt(f, t, hw, hh), e = edgePt(t, f, hw, hh)
    const dx = e.x - s.x, dy = e.y - s.y
    let d: string
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
      d = `M${s.x},${s.y} L${e.x},${e.y}`
    } else {
      const sV = Math.abs(s.y - f.y) > Math.abs(s.x - f.x)
      const eV = Math.abs(e.y - t.y) > Math.abs(e.x - t.x)
      if (sV && eV) {
        const my = (s.y + e.y) / 2
        d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
      } else if (!sV && !eV) {
        const mx = (s.x + e.x) / 2
        d = `M${s.x},${s.y} L${mx},${s.y} L${mx},${e.y} L${e.x},${e.y}`
      } else if (sV) {
        d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
      } else {
        d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
      }
    }
    return { d, mx: (s.x + e.x) / 2, my: (s.y + e.y) / 2 }
  }

  const exportMermaid = (): string => {
    let m = 'sequenceDiagram\n'
    lanes.forEach((l) => {
      m += `    participant ${l.name}\n`
    })
    m += '\n'
    arrows.forEach((a) => {
      const ft = tasks[a.from], tt = tasks[a.to]
      if (!ft || !tt) return
      const fl = lanes.find((l) => l.id === ft.lid), tl = lanes.find((l) => l.id === tt.lid)
      if (!fl || !tl) return
      if (fl.id === tl.id) m += `    Note over ${fl.name}: ${ft.label}\n`
      else m += `    ${fl.name}->>${tl.name}: ${a.comment || ft.label}\n`
    })
    const used = new Set<string>()
    arrows.forEach((a) => { used.add(a.from); used.add(a.to) })
    order.forEach((k) => {
      if (!used.has(k) && tasks[k]) {
        const l = lanes.find((x) => x.id === tasks[k].lid)
        if (l) m += `    Note over ${l.name}: ${tasks[k].label}\n`
      }
    })
    return m
  }

  const bgClick = (): void => {
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
    setShowThemePicker(false)
    if (connectFrom) {
      setConnectFrom(null)
      setActiveTool('select')
    }
  }
  const arrowPaths = arrows.map((a) => ({ arrow: a, path: aPath(a) })).filter((x): x is { arrow: InternalArrow; path: ArrowPathResult } => x.path !== null)

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
    { id: 'zoomIn', icon: I.zoomIn, tip: '拡大', action: () => setZoom((z) => Math.min(2, z + 0.1)) },
    { id: 'zoomOut', icon: I.zoomOut, tip: '縮小', action: () => setZoom((z) => Math.max(0.4, z - 0.1)) },
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
    // Node selected
    if (selTask && selTaskData) {
      const lane = lanes.find((l) => l.id === selTaskData.lid)
      const oi = order.indexOf(selTask)
      return (
        <>
          <PanelSection label="ノード" T={T}>
            <PanelRow label="ラベル" T={T} />
            <PanelInput
              value={selTaskData.label === '作業' ? '' : selTaskData.label}
              placeholder="作業"
              onChange={(v: string) =>
                setTasks((p2) => ({ ...p2, [selTask]: { ...p2[selTask], label: v || '作業' } }))
              }
              T={T}
            />
          </PanelSection>
          <PanelSection label="メモ" T={T}>
            <PanelInput
              value={notes[selTask] || ''}
              placeholder="メモを追加…"
              onChange={(v: string) => setNotes((p2) => ({ ...p2, [selTask]: v }))}
              T={T}
            />
          </PanelSection>
          <PanelSection label="情報" T={T}>
            <PanelRow label="レーン" T={T}>
              <span style={{ fontSize: 11, color: T.panelText, fontWeight: 500 }}>{lane?.name}</span>
            </PanelRow>
            {oi !== -1 && (
              <PanelRow label="順番" T={T}>
                <span style={{ fontSize: 11, color: T.panelText, fontWeight: 500 }}>{oi + 1}</span>
              </PanelRow>
            )}
          </PanelSection>
          <PanelSection label="操作" T={T}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <PanelBtn label="→ 接続" color={T.accent} onClick={() => startConnect(selTask)} T={T} />
              <PanelBtn label="削除" color="#E06060" onClick={() => delTask(selTask)} T={T} />
            </div>
          </PanelSection>
        </>
      )
    }

    // Arrow selected
    if (selArrow && selArrowData) {
      const fromT = tasks[selArrowData.from], toT = tasks[selArrowData.to]
      return (
        <>
          <PanelSection label="接続線" T={T}>
            <PanelRow label="From" T={T}>
              <span style={{ fontSize: 11, color: T.panelText, fontWeight: 500 }}>{fromT?.label || '?'}</span>
            </PanelRow>
            <PanelRow label="To" T={T}>
              <span style={{ fontSize: 11, color: T.panelText, fontWeight: 500 }}>{toT?.label || '?'}</span>
            </PanelRow>
          </PanelSection>
          <PanelSection label="コメント" T={T}>
            <PanelInput
              value={selArrowData.comment || ''}
              placeholder="ラベルを追加…"
              onChange={(v: string) =>
                setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, comment: v } : a)))
              }
              T={T}
            />
          </PanelSection>
          <PanelSection label="操作" T={T}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <PanelBtn
                label="⇄ 方向を逆転"
                color={T.accent}
                onClick={() =>
                  setArrows((p) =>
                    p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)),
                  )
                }
                T={T}
              />
              <PanelBtn
                label="削除"
                color="#E06060"
                onClick={() => {
                  setArrows((p) => p.filter((a) => a.id !== selArrow))
                  setSelArrow(null)
                }}
                T={T}
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
          <PanelSection label="レーン" T={T}>
            <PanelRow label="名前" T={T} />
            <PanelInput
              value={selLaneData.name}
              onChange={(v: string) =>
                setLanes((p) => p.map((l) => (l.id === selLane ? { ...l, name: v } : l)))
              }
              T={T}
            />
          </PanelSection>
          <PanelSection label="カラー" T={T}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PALETTES.map((p, ci) => (
                <div
                  key={ci}
                  onClick={() =>
                    setLanes((prev) => prev.map((l) => (l.id === selLane ? { ...l, ci } : l)))
                  }
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: p.dot,
                    cursor: 'pointer',
                    border: selLaneData.ci === ci ? `2px solid ${T.accent}` : '2px solid transparent',
                    transition: 'all 0.1s',
                  }}
                />
              ))}
            </div>
          </PanelSection>
          <PanelSection label="順番" T={T}>
            <div style={{ display: 'flex', gap: 6 }}>
              <PanelBtn label="← 左へ" color={T.accent} onClick={() => moveLane(selLane, -1)} T={T} />
              <PanelBtn label="右へ →" color={T.accent} onClick={() => moveLane(selLane, 1)} T={T} />
            </div>
          </PanelSection>
          <PanelSection label="操作" T={T}>
            <PanelBtn label="レーンを削除" color="#E06060" onClick={() => rmLane(selLane)} T={T} full />
          </PanelSection>
        </>
      )
    }

    // Nothing selected -> Theme & Canvas
    return (
      <>
        <PanelSection label="テーマ" T={T}>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowThemePicker((v) => !v)}
              style={{
                padding: '7px 10px',
                borderRadius: 7,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: T.inputBg,
                border: `1px solid ${T.inputBorder}`,
                color: T.panelText,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{THEMES[themeId].emoji}</span>
                {THEMES[themeId].name}
              </span>
              <span style={{ fontSize: 10, color: T.panelLabel }}>{showThemePicker ? '▲' : '▼'}</span>
            </div>
            {showThemePicker && (
              <div
                style={{
                  position: 'absolute',
                  top: 38,
                  left: 0,
                  right: 0,
                  background: T.panelBg,
                  border: `1px solid ${T.panelBorder}`,
                  borderRadius: 7,
                  padding: 4,
                  zIndex: 10,
                  boxShadow: `0 4px 12px rgba(0,0,0,${isDark ? 0.4 : 0.1})`,
                }}
              >
                {(Object.entries(THEMES) as [ThemeId, Theme][]).map(([id, th]) => (
                  <div
                    key={id}
                    onClick={() => { setThemeId(id); setShowThemePicker(false) }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: themeId === id ? T.sidebarActiveBg : 'transparent',
                      color: themeId === id ? T.accent : T.panelText,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{th.emoji}</span>
                    {th.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PanelSection>
        <PanelSection label="キャンバス" T={T}>
          <PanelRow label="レーン数" T={T}>
            <span style={{ fontSize: 12, color: T.panelText, fontWeight: 600 }}>{lanes.length}</span>
          </PanelRow>
          <PanelRow label="行数" T={T}>
            <span style={{ fontSize: 12, color: T.panelText, fontWeight: 600 }}>{rows.length}</span>
          </PanelRow>
          <PanelRow label="ノード数" T={T}>
            <span style={{ fontSize: 12, color: T.panelText, fontWeight: 600 }}>{Object.keys(tasks).length}</span>
          </PanelRow>
          <PanelRow label="接続数" T={T}>
            <span style={{ fontSize: 12, color: T.panelText, fontWeight: 600 }}>{arrows.length}</span>
          </PanelRow>
        </PanelSection>
        <PanelSection label="エクスポート" T={T}>
          <PanelBtn
            label="Mermaid コードをコピー"
            color={T.accent}
            onClick={() => navigator.clipboard?.writeText(exportMermaid())}
            T={T}
            full
          />
        </PanelSection>
      </>
    )
  }

  return (
    <div
      onClick={bgClick}
      style={{
        fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
        background: T.bg,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: T.titleColor,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(${isDark ? '255,255,255' : '0,0,0'},0.08);border-radius:3px}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes dragPulse{0%,100%{stroke-opacity:0.3}50%{stroke-opacity:0.7}}
        .stool{position:relative}.stool .stip{display:none;position:absolute;left:46px;top:50%;transform:translateY(-50%);background:${isDark ? '#555' : '#333'};color:#fff;font-size:10px;padding:3px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:10}.stool:hover .stip{display:block}
      `}</style>

      {/* Title bar */}
      <div
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          height: 40,
          background: T.titleBar,
          borderBottom: `1px solid ${T.titleBarBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            marginRight: 8,
            background: `linear-gradient(135deg,${T.accent},${isDark ? '#6E59CF' : '#5B8DEF'})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          F
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.titleColor, letterSpacing: '-0.02em' }}>
          Flowline
        </span>
        <div style={{ width: 1, height: 18, background: T.titleBarBorder, margin: '0 10px' }} />
        {editTitle ? (
          <input
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            onBlur={() => setEditTitle(false)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setEditTitle(false)}
            autoFocus
            style={{
              fontSize: 12,
              fontWeight: 500,
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              borderRadius: 4,
              padding: '2px 8px',
              color: T.titleColor,
              outline: 'none',
              width: 180,
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onClick={() => setEditTitle(true)}
            style={{
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
              color: T.titleSub,
            }}
          >
            {title}
          </span>
        )}
        <button
          data-testid="share-button"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowShareDialog(true) }}
          style={{
            height: 26,
            padding: '0 10px',
            border: shareToken ? `1px solid ${T.accent}40` : `1px solid ${T.titleBarBorder}`,
            borderRadius: 6,
            background: shareToken ? `${T.accent}10` : 'transparent',
            color: shareToken ? T.accent : T.titleSub,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 8,
          }}
        >
          {shareToken ? '共有中' : '共有'}
        </button>
        <div style={{ flex: 1 }} />
        {connectFrom && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 6,
              background: T.sidebarActiveBg,
              border: `1px solid ${T.accent}40`,
              animation: 'pulse 1.5s ease infinite',
            }}
          >
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 500 }}>
              {'→ 接続先をクリック'}
            </span>
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                setConnectFrom(null)
                setActiveTool('select')
              }}
              style={{
                width: 18,
                height: 18,
                border: 'none',
                borderRadius: 3,
                background: `${T.accent}18`,
                color: T.accent,
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'×'}
            </button>
          </div>
        )}
        <span
          data-testid="save-status"
          style={{
            fontSize: 10,
            color: saveStatus === 'error' ? '#E06060' : saveStatus === 'unsaved' ? T.accent : T.statusText,
            marginLeft: 12,
          }}
        >
          {saveStatusText[saveStatus]}
        </span>
        <span style={{ fontSize: 10, color: T.statusText, marginLeft: 12 }}>
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <div
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{
            width: 44,
            background: T.sidebar,
            borderRight: `1px solid ${T.sidebarBorder}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {sideTools.map((t, i) => {
            if (t === 'sep')
              return (
                <div
                  key={i}
                  style={{ width: 24, height: 1, background: T.sidebarBorder, margin: '4px 0' }}
                />
              )
            const isA = t.id === activeTool || (t.id === 'export' && showExport)
            return (
              <div
                key={t.id}
                className="stool"
                onClick={() => {
                  if (t.action) { t.action(); return }
                  if (t.id === 'connect') {
                    if (activeTool === 'connect') { setActiveTool('select'); setConnectFrom(null) }
                    else setActiveTool('connect')
                  } else setActiveTool(t.id)
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: isA ? T.sidebarActiveBg : 'transparent',
                  color: isA ? T.sidebarActive : T.sidebarIcon,
                }}
              >
                <Ico>{t.icon}</Ico>
                <span className="stip">{t.tip}</span>
              </div>
            )
          })}
        </div>

        {/* Canvas */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            background: T.canvasBg,
            backgroundImage: `radial-gradient(circle,${T.dotGrid} 0.5px,transparent 0.5px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            cursor: connectFrom ? 'crosshair' : dragging ? 'grabbing' : 'default',
          }}
        >
          <svg
            ref={svgRef}
            width={svgW}
            height={svgH}
            viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
            style={{ overflow: 'visible' }}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={() => {
              if (dragging) { setDragging(null); setDragOver(null) }
            }}
          >
            {/* Lanes */}
            {lanes.map((lane, li) => {
              const p = PALETTES[lane.ci], x = laneX(li), isSel = selLane === lane.id, fullH = HH + rows.length * RH
              return (
                <g key={`lane-${lane.id}`}>
                  <rect x={x} y={TM} width={LW} height={fullH} rx={10} fill={T.laneBg} stroke={T.laneBorder} strokeWidth={0.5} />
                  {isSel && (
                    <rect x={x + 1} y={TM + 1} width={LW - 2} height={fullH - 2} rx={9} fill="none" stroke={T.accent} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.5} />
                  )}
                  <rect x={x} y={TM} width={LW} height={HH} rx={10} fill={T.laneHeaderBg} />
                  <rect x={x} y={TM + HH - 10} width={LW} height={10} fill={T.laneHeaderBg} />
                  <rect x={x + 16} y={TM + HH - 2.5} width={LW - 32} height={2} rx={1} fill={p.dot} opacity={T.laneAccentOpacity} />
                  <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                  <rect
                    x={x} y={TM} width={LW} height={HH} fill="transparent" style={{ cursor: 'pointer' }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setSelLane(selLane === lane.id ? null : lane.id)
                      setSelTask(null)
                      setSelArrow(null)
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
                          setLanes((p2) => p2.map((l) => (l.id === lane.id ? { ...l, name: v } : l)))
                        }}
                        onBlur={() => setEditLane(null)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setEditLane(null)}
                        style={{
                          width: '100%',
                          background: T.inputBg,
                          border: `1px solid ${T.inputBorder}`,
                          borderRadius: 4,
                          color: T.titleColor,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 6px',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={x + 32} y={TM + HH / 2 + 1} dominantBaseline="central"
                      fill={T.titleColor} fontSize={12.5} fontWeight={600}
                      style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                    >
                      {lane.name}
                    </text>
                  )}
                  {rows.map((_, ri) =>
                    ri === 0 ? null : (
                      <line key={ri} x1={x + 8} y1={TM + HH + ri * RH} x2={x + LW - 8} y2={TM + HH + ri * RH} stroke={T.laneBorder} strokeWidth={0.3} />
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
                const x = laneX(li), cx = x + LW / 2, cy = TM - 14
                return (
                  <g>
                    {li > 0 && (
                      <g onClick={(e: React.MouseEvent) => { e.stopPropagation(); moveLane(selLane, -1) }} style={{ cursor: 'pointer' }}>
                        <rect x={cx - 44} y={cy - 11} width={30} height={22} rx={6} fill={T.sidebar} stroke={T.laneBorder} strokeWidth={0.5} />
                        <text x={cx - 29} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={T.sidebarIcon} fontWeight={600}>{'←'}</text>
                      </g>
                    )}
                    {li < lanes.length - 1 && (
                      <g onClick={(e: React.MouseEvent) => { e.stopPropagation(); moveLane(selLane, 1) }} style={{ cursor: 'pointer' }}>
                        <rect x={cx + 14} y={cy - 11} width={30} height={22} rx={6} fill={T.sidebar} stroke={T.laneBorder} strokeWidth={0.5} />
                        <text x={cx + 29} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={T.sidebarIcon} fontWeight={600}>{'→'}</text>
                      </g>
                    )}
                  </g>
                )
              })()}

            {/* Gap "+" */}
            {Array.from({ length: lanes.length + 1 }, (_, gi) => {
              const gx = gi === 0 ? LM - G / 2 : gi === lanes.length ? laneX(gi - 1) + LW + G / 2 : laneX(gi) - G / 2
              const gy = TM + HH / 2 + (rows.length * RH) / 2
              const isHov = hoveredLaneGap === gi
              const hitX = gi === 0 ? LM - 14 : gi === lanes.length ? laneX(gi - 1) + LW : laneX(gi) - G
              return (
                <g key={`gap-${gi}`}>
                  <rect
                    x={hitX} y={TM} width={gi === 0 || gi === lanes.length ? 14 : G}
                    height={HH + rows.length * RH} fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredLaneGap(gi)}
                    onMouseLeave={() => setHoveredLaneGap(null)}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); insertLaneAt(gi) }}
                  />
                  {isHov && (
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={gx} y1={TM + HH} x2={gx} y2={TM + HH + rows.length * RH} stroke={T.accent} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.3} />
                      <circle cx={gx} cy={gy} r={10} fill={T.accent} />
                      <line x1={gx - 4} y1={gy} x2={gx + 4} y2={gy} stroke="#fff" strokeWidth={1.5} />
                      <line x1={gx} y1={gy - 4} x2={gx} y2={gy + 4} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              )
            })}

            {rows.map((_, ri) => (
              <text key={ri} x={LM - 14} y={TM + HH + ri * RH + RH / 2} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={T.statusText} fontWeight={500}>
                {ri + 1}
              </text>
            ))}

            {/* Empty cells */}
            {lanes.map((lane, li) =>
              rows.map((row, ri) => {
                const k = ky(lane.id, row.id)
                if (tasks[k]) return null
                const c = ct(li, ri), p = PALETTES[lane.ci], isHov = hovered === k, isDT = dragOver === k
                return (
                  <g key={`ec-${k}`}>
                    <rect
                      x={laneX(li)} y={TM + HH + ri * RH} width={LW} height={RH} fill="transparent"
                      style={{ cursor: connectFrom ? 'default' : dragging ? 'default' : 'crosshair' }}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (!dragging) cellClick(lane.id, row.id, li, ri) }}
                      onMouseEnter={() => setHovered(k)}
                      onMouseLeave={() => setHovered(null)}
                    />
                    {isDT && (
                      <rect
                        x={laneX(li) + 4} y={TM + HH + ri * RH + 4} width={LW - 8} height={RH - 8}
                        rx={8} fill={`${T.accent}0A`} stroke={T.accent} strokeWidth={1.5} strokeDasharray="4,3"
                        style={{ animation: 'dragPulse 1s ease infinite', pointerEvents: 'none' }}
                      />
                    )}
                    {isHov && !connectFrom && !dragging && (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect x={c.x - TW / 2} y={c.y - TH / 2} width={TW} height={TH} rx={8} fill="none" stroke={p.dot} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.25} />
                        <line x1={c.x - 5} y1={c.y} x2={c.x + 5} y2={c.y} stroke={p.dot} strokeWidth={1} opacity={0.3} />
                        <line x1={c.x} y1={c.y - 5} x2={c.x} y2={c.y + 5} stroke={p.dot} strokeWidth={1} opacity={0.3} />
                      </g>
                    )}
                  </g>
                )
              }),
            )}

            {/* Nodes */}
            {lanes.map((lane, li) =>
              rows.map((row, ri) => {
                const k = ky(lane.id, row.id), task = tasks[k], note = notes[k]
                if (!task) return null
                const c = ct(li, ri), p = PALETTES[lane.ci]
                const isSel = selTask === k, isLast = order.length > 0 && order[order.length - 1] === k
                const oi = order.indexOf(k), isConnSrc = connectFrom === k, isConnTgt = connectFrom !== null && connectFrom !== k
                const isDT = dragging?.key === k, isHov = hovered === k
                const tagW = lane.name.length * 7 + 14
                return (
                  <g key={`t-${k}`} opacity={isDT ? 0.3 : 1}>
                    <rect
                      x={laneX(li)} y={TM + HH + ri * RH} width={LW} height={RH} fill="transparent"
                      style={{ cursor: connectFrom ? 'pointer' : 'grab' }}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (!dragging) cellClick(lane.id, row.id, li, ri) }}
                      onMouseEnter={() => setHovered(k)}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <rect
                      x={c.x - TW / 2} y={c.y - TH / 2} width={TW} height={TH}
                      fill={isConnTgt && isHov ? `${T.accent}0A` : T.nodeFill}
                      stroke={isConnSrc ? T.accent : isSel ? T.nodeSelStroke : isConnTgt && isHov ? T.accent : T.nodeStroke}
                      strokeWidth={isConnSrc || isSel ? 2 : 0.5}
                      strokeDasharray={isConnSrc ? '4,3' : 'none'}
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
                        setTimeout(() => inputRef.current?.focus(), 40)
                      }}
                      onMouseDown={(e: React.MouseEvent) => {
                        if (!connectFrom && !editing) onDragStart(k, e)
                      }}
                    />
                    <rect x={c.x - TW / 2 + 6} y={c.y - TH / 2 + 5} width={tagW} height={15} rx={3} fill={p.tag} style={{ pointerEvents: 'none' }} />
                    <text
                      x={c.x - TW / 2 + 13} y={c.y - TH / 2 + 12.5} dominantBaseline="central"
                      fontSize={8} fill={p.text} fontWeight={600}
                      style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                    >
                      {lane.name}
                    </text>
                    {isLast && !isSel && !connectFrom && (
                      <circle cx={c.x - TW / 2 + 10} cy={c.y - TH / 2 + 10} r={3} fill="#66BB6A" />
                    )}
                    {oi !== -1 && !connectFrom && !dragging && (
                      <g>
                        <rect x={c.x + TW / 2 - 18} y={c.y + TH / 2 - 16} width={18} height={16} rx={5} fill={p.tag} />
                        <text x={c.x + TW / 2 - 9} y={c.y + TH / 2 - 7} textAnchor="middle" dominantBaseline="central" fill={p.text} fontSize={8.5} fontWeight={700}>
                          {oi + 1}
                        </text>
                      </g>
                    )}
                    {editing === k ? (
                      <foreignObject x={c.x - TW / 2 + 8} y={c.y - TH / 2 + 18} width={TW - 16} height={TH - 22}>
                        <input
                          ref={inputRef}
                          value={task.label === '作業' ? '' : task.label}
                          placeholder="作業"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = e.target.value
                            setTasks((p2) => ({ ...p2, [k]: { ...p2[k], label: v || '作業' } }))
                          }}
                          onBlur={() => setEditing(null)}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') setEditing(null) }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            outline: 'none',
                            textAlign: 'center',
                            fontSize: 11.5,
                            background: 'transparent',
                            color: T.titleColor,
                            fontWeight: 500,
                            fontFamily: 'inherit',
                          }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={c.x} y={c.y + 6} textAnchor="middle" dominantBaseline="central"
                        fontSize={11.5} fontWeight={500}
                        fill={task.label === '作業' ? T.statusText : T.titleColor}
                        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                      >
                        {task.label.length > 10 ? task.label.slice(0, 10) + '…' : task.label}
                      </text>
                    )}
                    {note && !connectFrom && !dragging && (
                      <g>
                        <rect x={c.x - TW / 2 + 6} y={c.y + TH / 2 + 4} width={TW - 12} height={16} rx={4} fill="#FFFDE7" stroke="#F0E6A0" strokeWidth={0.5} />
                        {editNote === k ? (
                          <foreignObject x={c.x - TW / 2 + 8} y={c.y + TH / 2 + 4} width={TW - 16} height={16}>
                            <input
                              ref={inputRef}
                              value={note}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes((p2) => ({ ...p2, [k]: e.target.value }))}
                              onBlur={() => setEditNote(null)}
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setEditNote(null)}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: 8,
                                color: '#8D6E63',
                                textAlign: 'center',
                                fontFamily: 'inherit',
                              }}
                            />
                          </foreignObject>
                        ) : (
                          <text
                            x={c.x} y={c.y + TH / 2 + 13} textAnchor="middle" dominantBaseline="central"
                            fontSize={8} fill="#8D6E63" style={{ cursor: 'pointer' }}
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
              return (
                <g key={`av-${arrow.id}`}>
                  <defs>
                    <marker id={`m-${arrow.id}`} markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
                      <polygon points="0 0.5, 8 3.5, 0 6.5" fill={isSel ? T.accent : T.arrowColor} />
                    </marker>
                  </defs>
                  <path
                    d={d} stroke={isSel ? T.arrowSel : T.arrowColor}
                    strokeWidth={isSel ? 2 : 1.2} fill="none"
                    markerEnd={`url(#m-${arrow.id})`}
                    style={{ pointerEvents: 'none' }}
                  />
                  {arrow.comment && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect
                        x={mx - Math.max(arrow.comment.length * 3.2, 12) - 10}
                        y={my - 19}
                        width={Math.max(arrow.comment.length * 6.4 + 20, 44)}
                        height={20} rx={10}
                        fill={T.commentPill} stroke={T.commentBorder} strokeWidth={0.5}
                      />
                      <text x={mx} y={my - 8} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={T.commentText} fontWeight={500}>
                        {arrow.comment.length > 18 ? arrow.comment.slice(0, 18) + '…' : arrow.comment}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {arrowPaths.map(({ arrow, path }) => (
              <path
                key={`ah-${arrow.id}`} d={path.d}
                stroke="rgba(0,0,0,0)" strokeWidth={20} fill="none"
                pointerEvents="stroke" style={{ cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  setSelArrow(selArrow === arrow.id ? null : arrow.id)
                  setSelTask(null)
                  setSelLane(null)
                }}
              />
            ))}

            {/* Selection handles */}
            {selTask && tasks[selTask] && !connectFrom && !dragging &&
              (() => {
                const t = tasks[selTask], li = liMap[t.lid], ri = riMap[t.rid]
                if (li === undefined || ri === undefined) return null
                const c = ct(li, ri)
                return (
                  [[c.x - TW / 2, c.y], [c.x + TW / 2, c.y], [c.x, c.y - TH / 2], [c.x, c.y + TH / 2]] as [number, number][]
                ).map(([hx, hy], i) => (
                  <rect key={i} x={hx - 3} y={hy - 3} width={6} height={6} fill={T.nodeFill} stroke={T.accent} strokeWidth={1.2} rx={1.5} />
                ))
              })()}
          </svg>
        </div>

        {/* Right Panel */}
        <div
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{
            width: 220,
            background: T.panelBg,
            borderLeft: `1px solid ${T.panelBorder}`,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.panelBorder}` }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.panelLabel,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {selTask ? 'ノード' : selArrow ? '接続線' : selLane ? 'レーン' : 'プロパティ'}
            </span>
          </div>
          {renderRightPanel()}
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          height: 24,
          background: T.statusBg,
          borderTop: `1px solid ${T.statusBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: T.statusText }}>
          {Object.keys(tasks).length} tasks {'·'} {arrows.length} connections
        </span>
        <span style={{ fontSize: 10, color: T.statusText, opacity: 0.5 }}>
          {'⌘Z:戻す · ⌘⇧Z:やり直す'}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.statusText, opacity: 0.6 }}>
          {connectFrom
            ? '接続先クリック · Esc解除'
            : dragging
              ? '空きセルにドロップ'
              : 'クリック:追加 · ドラッグ:移動 · ヘッダ:レーン選択'}
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
    </div>
  )
}
