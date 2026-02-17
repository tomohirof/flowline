import { useState, useRef, useCallback } from 'react'
import type { Flow, Node as FlowNode, Arrow } from '../editor/types'

// =============================================
// Constants (shared with FlowEditor - read-only subset)
// =============================================

interface Palette {
  dot: string
  tag: string
  text: string
  name: string
}

interface Theme {
  name: string
  bg: string
  canvasBg: string
  dotGrid: string
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
  arrowColor: string
  commentPill: string
  commentBorder: string
  commentText: string
  statusBg: string
  statusBorder: string
  statusText: string
  accent: string
  laneGap: number
}

type ThemeId = 'cloud' | 'midnight' | 'blueprint'

const PALETTES: Palette[] = [
  { dot: '#E8985A', tag: '#FFF4EB', text: '#B06828', name: 'Orange' },
  { dot: '#5B8EC9', tag: '#EBF3FF', text: '#2D6AB0', name: 'Blue' },
  { dot: '#9B6BC9', tag: '#F3EBFF', text: '#6B3BA0', name: 'Purple' },
  { dot: '#5AC98A', tag: '#EBFFEF', text: '#2A7A4A', name: 'Green' },
  { dot: '#C95A7B', tag: '#FFEBF0', text: '#A03050', name: 'Pink' },
  { dot: '#5AB5C9', tag: '#EBFAFF', text: '#1A7A90', name: 'Cyan' },
  { dot: '#C9A85A', tag: '#FFF8EB', text: '#8A6A20', name: 'Gold' },
  { dot: '#7B5AC9', tag: '#EFEBFF', text: '#5030A0', name: 'Violet' },
]

const THEMES: Record<ThemeId, Theme> = {
  cloud: {
    name: 'Cloud',
    bg: '#EAEAF2',
    canvasBg: '#EAEAF2',
    dotGrid: '#D6D6E0',
    titleBar: '#fff',
    titleBarBorder: '#E5E4E9',
    titleColor: '#444',
    titleSub: '#999',
    laneBg: '#F5F5F8',
    laneHeaderBg: '#FAFAFD',
    laneBorder: '#E8E8EE',
    laneAccentOpacity: 0.5,
    nodeStroke: '#E8E7EE',
    nodeFill: '#fff',
    nodeShadow: '0 2px 8px rgba(80,80,120,0.10), 0 1px 3px rgba(80,80,120,0.06)',
    arrowColor: '#C0BEC8',
    commentPill: '#fff',
    commentBorder: '#E8E7EE',
    commentText: '#888',
    statusBg: '#fff',
    statusBorder: '#E5E4E9',
    statusText: '#BBB',
    accent: '#7C5CFC',
    laneGap: 6,
  },
  midnight: {
    name: 'Midnight',
    bg: '#1A1A24',
    canvasBg: '#1A1A24',
    dotGrid: '#2A2A38',
    titleBar: '#222230',
    titleBarBorder: '#333344',
    titleColor: '#D0D0E0',
    titleSub: '#666680',
    laneBg: '#22222E',
    laneHeaderBg: '#2A2A38',
    laneBorder: '#333344',
    laneAccentOpacity: 0.6,
    nodeStroke: '#3A3A4C',
    nodeFill: '#2A2A38',
    nodeShadow: '0 3px 12px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
    arrowColor: '#555568',
    commentPill: '#2A2A38',
    commentBorder: '#3A3A4C',
    commentText: '#888898',
    statusBg: '#222230',
    statusBorder: '#333344',
    statusText: '#555568',
    accent: '#A78BFA',
    laneGap: 6,
  },
  blueprint: {
    name: 'Blueprint',
    bg: '#E8EDF4',
    canvasBg: '#E8EDF4',
    dotGrid: '#CDD4E0',
    titleBar: '#fff',
    titleBarBorder: '#D8DDE6',
    titleColor: '#334155',
    titleSub: '#8899AA',
    laneBg: '#F0F3F8',
    laneHeaderBg: '#F6F8FB',
    laneBorder: '#D8DDE6',
    laneAccentOpacity: 0.5,
    nodeStroke: '#D0D8E4',
    nodeFill: '#fff',
    nodeShadow: '0 2px 10px rgba(50,70,100,0.10), 0 1px 3px rgba(50,70,100,0.06)',
    arrowColor: '#AAB8CC',
    commentPill: '#fff',
    commentBorder: '#D0D8E4',
    commentText: '#7788AA',
    statusBg: '#fff',
    statusBorder: '#D8DDE6',
    statusText: '#99AABB',
    accent: '#3B82F6',
    laneGap: 6,
  },
}

interface Point { x: number; y: number }

interface SharedFlowViewerProps {
  flow: Flow
}

export function SharedFlowViewer({ flow }: SharedFlowViewerProps) {
  const themeId = (Object.keys(THEMES).includes(flow.themeId) ? flow.themeId : 'cloud') as ThemeId
  const T = THEMES[themeId]
  const isDark = themeId === 'midnight'

  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)

  // Build internal representation
  const sortedLanes = [...flow.lanes].sort((a, b) => a.position - b.position)
  const sortedNodes = [...flow.nodes].sort((a, b) => a.orderIndex - b.orderIndex)

  // Calculate max row index
  const maxRowIndex = Math.max(6, ...flow.nodes.map((n) => n.rowIndex))
  const rowCount = maxRowIndex + 1

  const LW = 178, RH = 84, HH = 46, TW = 144, TH = 52, LM = 28, TM = 24, G = T.laneGap
  const totalW = LM + sortedLanes.length * LW + (sortedLanes.length - 1) * G + 28
  const totalH = TM + HH + rowCount * RH + 40

  const laneX = (li: number) => LM + li * (LW + G)
  const ct = useCallback(
    (li: number, ri: number): Point => ({ x: laneX(li) + LW / 2, y: TM + HH + ri * RH + RH / 2 }),
    [sortedLanes.length],
  )

  // Build lane index map
  const laneIdToIndex: Record<string, number> = {}
  sortedLanes.forEach((l, i) => { laneIdToIndex[l.id] = i })

  // Build node lookup
  const nodeById: Record<string, FlowNode> = {}
  flow.nodes.forEach((n) => { nodeById[n.id] = n })

  // Arrow path calculation
  const edgePt = (c: Point, o: Point, hw: number, hh: number): Point => {
    const dx = o.x - c.x, dy = o.y - c.y
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y + hh }
    if (Math.abs(dy) / hh > Math.abs(dx) / hw) return { x: c.x, y: c.y + (dy > 0 ? hh : -hh) }
    return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  }

  const computeArrowPath = (arrow: Arrow): { d: string; mx: number; my: number } | null => {
    const fromNode = nodeById[arrow.fromNodeId]
    const toNode = nodeById[arrow.toNodeId]
    if (!fromNode || !toNode) return null

    const fli = laneIdToIndex[fromNode.laneId]
    const tli = laneIdToIndex[toNode.laneId]
    if (fli === undefined || tli === undefined) return null

    const f = ct(fli, fromNode.rowIndex)
    const t = ct(tli, toNode.rowIndex)
    const hw = TW / 2, hh = TH / 2
    const s = edgePt(f, t, hw, hh)
    const e = edgePt(t, f, hw, hh)
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

  const arrowPaths = flow.arrows
    .map((a) => ({ arrow: a, path: computeArrowPath(a) }))
    .filter((x): x is { arrow: Arrow; path: { d: string; mx: number; my: number } } => x.path !== null)

  return (
    <div
      data-testid="shared-flow-view"
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
      `}</style>

      {/* Title bar */}
      <div
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
        <span style={{ fontSize: 12, fontWeight: 500, color: T.titleSub, padding: '2px 8px' }}>
          {flow.title}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            color: T.accent,
            background: `${T.accent}15`,
            padding: '3px 10px',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          閲覧モード
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            style={{
              width: 24, height: 24, border: `1px solid ${T.titleBarBorder}`, borderRadius: 4,
              background: 'transparent', cursor: 'pointer', fontSize: 14, color: T.titleSub,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            +
          </button>
          <span style={{ fontSize: 10, color: T.statusText, minWidth: 32, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            style={{
              width: 24, height: 24, border: `1px solid ${T.titleBarBorder}`, borderRadius: 4,
              background: 'transparent', cursor: 'pointer', fontSize: 14, color: T.titleSub,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            -
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: T.canvasBg,
          backgroundImage: `radial-gradient(circle,${T.dotGrid} 0.5px,transparent 0.5px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          padding: 40,
        }}
      >
        <svg
          ref={svgRef}
          width={totalW * zoom}
          height={(totalH + 30) * zoom}
          viewBox={`0 -30 ${totalW} ${totalH + 30}`}
          style={{ overflow: 'visible' }}
        >
          {/* Lanes */}
          {sortedLanes.map((lane, li) => {
            const p = PALETTES[lane.colorIndex % PALETTES.length]
            const x = laneX(li)
            const fullH = HH + rowCount * RH
            return (
              <g key={`lane-${lane.id}`}>
                <rect x={x} y={TM} width={LW} height={fullH} rx={10} fill={T.laneBg} stroke={T.laneBorder} strokeWidth={0.5} />
                <rect x={x} y={TM} width={LW} height={HH} rx={10} fill={T.laneHeaderBg} />
                <rect x={x} y={TM + HH - 10} width={LW} height={10} fill={T.laneHeaderBg} />
                <rect x={x + 16} y={TM + HH - 2.5} width={LW - 32} height={2} rx={1} fill={p.dot} opacity={T.laneAccentOpacity} />
                <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                <text
                  x={x + 32} y={TM + HH / 2 + 1} dominantBaseline="central"
                  fill={T.titleColor} fontSize={12.5} fontWeight={600}
                  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                >
                  {lane.name}
                </text>
                {Array.from({ length: rowCount }, (_, ri) =>
                  ri === 0 ? null : (
                    <line key={ri} x1={x + 8} y1={TM + HH + ri * RH} x2={x + LW - 8} y2={TM + HH + ri * RH} stroke={T.laneBorder} strokeWidth={0.3} />
                  ),
                )}
              </g>
            )
          })}

          {/* Row numbers */}
          {Array.from({ length: rowCount }, (_, ri) => (
            <text key={ri} x={LM - 14} y={TM + HH + ri * RH + RH / 2} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={T.statusText} fontWeight={500}>
              {ri + 1}
            </text>
          ))}

          {/* Nodes */}
          {sortedNodes.map((node) => {
            const li = laneIdToIndex[node.laneId]
            if (li === undefined) return null
            const lane = sortedLanes[li]
            const p = PALETTES[lane.colorIndex % PALETTES.length]
            const c = ct(li, node.rowIndex)
            const tagW = lane.name.length * 7 + 14
            return (
              <g key={`node-${node.id}`}>
                <rect
                  x={c.x - TW / 2} y={c.y - TH / 2} width={TW} height={TH}
                  fill={T.nodeFill} stroke={T.nodeStroke} strokeWidth={0.5} rx={10}
                  style={{
                    filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
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
                <text
                  x={c.x} y={c.y + 6} textAnchor="middle" dominantBaseline="central"
                  fontSize={11.5} fontWeight={500}
                  fill={node.label === '作業' ? T.statusText : T.titleColor}
                  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                >
                  {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                </text>
                {node.note && (
                  <g>
                    <rect x={c.x - TW / 2 + 6} y={c.y + TH / 2 + 4} width={TW - 12} height={16} rx={4} fill="#FFFDE7" stroke="#F0E6A0" strokeWidth={0.5} />
                    <text
                      x={c.x} y={c.y + TH / 2 + 13} textAnchor="middle" dominantBaseline="central"
                      fontSize={8} fill="#8D6E63"
                    >
                      {node.note.length > 14 ? node.note.slice(0, 14) + '...' : node.note}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Arrows */}
          {arrowPaths.map(({ arrow, path }) => {
            const { d, mx, my } = path
            return (
              <g key={`arrow-${arrow.id}`}>
                <defs>
                  <marker id={`sm-${arrow.id}`} markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
                    <polygon points="0 0.5, 8 3.5, 0 6.5" fill={T.arrowColor} />
                  </marker>
                </defs>
                <path
                  d={d} stroke={T.arrowColor}
                  strokeWidth={1.2} fill="none"
                  markerEnd={`url(#sm-${arrow.id})`}
                />
                {arrow.comment && (
                  <g>
                    <rect
                      x={mx - Math.max((arrow.comment?.length ?? 0) * 3.2, 12) - 10}
                      y={my - 19}
                      width={Math.max((arrow.comment?.length ?? 0) * 6.4 + 20, 44)}
                      height={20} rx={10}
                      fill={T.commentPill} stroke={T.commentBorder} strokeWidth={0.5}
                    />
                    <text x={mx} y={my - 8} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={T.commentText} fontWeight={500}>
                      {arrow.comment.length > 18 ? arrow.comment.slice(0, 18) + '...' : arrow.comment}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Footer */}
      <div
        data-testid="shared-flow-footer"
        style={{
          height: 32,
          background: T.statusBg,
          borderTop: `1px solid ${T.statusBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: `linear-gradient(135deg,${T.accent},${isDark ? '#6E59CF' : '#5B8DEF'})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 7,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          F
        </div>
        <span style={{ fontSize: 11, color: T.statusText, fontWeight: 500 }}>
          Flowlineで作成
        </span>
      </div>
    </div>
  )
}
