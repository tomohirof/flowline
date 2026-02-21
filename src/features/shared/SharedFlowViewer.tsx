import { useState, useRef, useEffect } from 'react'
import type { Flow, ThemeId, Node as FlowNode, Arrow } from '../editor/types'
import { PALETTES, THEMES } from '../editor/theme-constants'
import styles from './SharedFlowViewer.module.css'
import { calcLaneWidth } from '../editor/calcLaneWidth'

interface Point {
  x: number
  y: number
}

interface SharedFlowViewerProps {
  flow: Flow
}

export function SharedFlowViewer({ flow }: SharedFlowViewerProps) {
  const themeId = (Object.keys(THEMES).includes(flow.themeId) ? flow.themeId : 'cloud') as ThemeId
  const T = THEMES[themeId]
  const isDark = themeId === 'midnight'

  const [zoom, setZoom] = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width
      setContainerWidth((prev) => (prev === w ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build internal representation
  const sortedLanes = [...flow.lanes].sort((a, b) => a.position - b.position)
  const sortedNodes = [...flow.nodes].sort((a, b) => a.orderIndex - b.orderIndex)

  // Calculate max row index
  const maxRowIndex = Math.max(6, ...flow.nodes.map((n) => n.rowIndex))
  const rowCount = maxRowIndex + 1

  const RH = 84,
    HH = 46,
    TW = 144,
    TH = 52,
    LM = 28,
    TM = 24,
    G = T.laneGap
  const LW = calcLaneWidth(containerWidth, sortedLanes.length, LM, G)
  const totalW = LM + sortedLanes.length * LW + (sortedLanes.length - 1) * G + 28
  const totalH = TM + HH + rowCount * RH + 40

  const laneX = (li: number) => LM + li * (LW + G)
  const ct = (li: number, ri: number): Point => ({
    x: laneX(li) + LW / 2,
    y: TM + HH + ri * RH + RH / 2,
  })

  // Build lane index map
  const laneIdToIndex: Record<string, number> = {}
  sortedLanes.forEach((l, i) => {
    laneIdToIndex[l.id] = i
  })

  // Build node lookup
  const nodeById: Record<string, FlowNode> = {}
  flow.nodes.forEach((n) => {
    nodeById[n.id] = n
  })

  // Arrow path calculation
  const edgePt = (c: Point, o: Point, hw: number, hh: number): Point => {
    const dx = o.x - c.x,
      dy = o.y - c.y
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
    const hw = TW / 2,
      hh = TH / 2
    const s = edgePt(f, t, hw, hh)
    const e = edgePt(t, f, hw, hh)
    const dx = e.x - s.x,
      dy = e.y - s.y
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
    .filter(
      (x): x is { arrow: Arrow; path: { d: string; mx: number; my: number } } => x.path !== null,
    )

  const logoGradient = `linear-gradient(135deg,${T.accent},${isDark ? '#6E59CF' : '#5B8DEF'})`

  return (
    <div
      className={styles.root}
      data-testid="shared-flow-view"
      style={
        {
          '--theme-bg': T.bg,
          '--theme-accent': T.accent,
          '--theme-accent-alpha': `${T.accent}15`,
          '--theme-title-color': T.titleColor,
          '--theme-title-bar': T.titleBar,
          '--theme-title-bar-border': T.titleBarBorder,
          '--theme-title-sub': T.titleSub,
          '--theme-canvas-bg': T.canvasBg,
          '--theme-dot-grid': T.dotGrid,
          '--theme-status-bg': T.statusBg,
          '--theme-status-border': T.statusBorder,
          '--theme-status-text': T.statusText,
        } as React.CSSProperties
      }
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(${isDark ? '255,255,255' : '0,0,0'},0.08);border-radius:3px}
      `}</style>

      {/* Title bar */}
      <div className={styles.titleBar}>
        <div className={styles.logoIcon} style={{ background: logoGradient }}>
          F
        </div>
        <span className={styles.brandName}>Flowline</span>
        <div className={styles.divider} />
        <span className={styles.flowTitle}>{flow.title}</span>
        <div className={styles.spacer} />
        <span className={styles.viewModeBadge}>閲覧モード</span>
        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
            +
          </button>
          <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>
          <button className={styles.zoomBtn} onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
            -
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={styles.canvas}
        style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
      >
        <svg
          className={styles.svg}
          width={totalW * zoom}
          height={(totalH + 30) * zoom}
          viewBox={`0 -30 ${totalW} ${totalH + 30}`}
        >
          {/* Lanes */}
          {sortedLanes.map((lane, li) => {
            const p = PALETTES[lane.colorIndex % PALETTES.length]
            const x = laneX(li)
            const fullH = HH + rowCount * RH
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
                {Array.from({ length: rowCount }, (_, ri) =>
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

          {/* Row numbers */}
          {Array.from({ length: rowCount }, (_, ri) => (
            <text
              key={ri}
              x={LM - 14}
              y={TM + HH + ri * RH + RH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fill={T.statusText}
              fontWeight={500}
            >
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
                  x={c.x - TW / 2}
                  y={c.y - TH / 2}
                  width={TW}
                  height={TH}
                  fill={T.nodeFill}
                  stroke={T.nodeStroke}
                  strokeWidth={0.5}
                  rx={10}
                  style={{
                    filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                  }}
                />
                <rect
                  x={c.x - TW / 2 + 6}
                  y={c.y - TH / 2 + 5}
                  width={tagW}
                  height={15}
                  rx={3}
                  fill={p.tag}
                  style={{ pointerEvents: 'none' }}
                />
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
                <text
                  x={c.x}
                  y={c.y + 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11.5}
                  fontWeight={500}
                  fill={node.label === '作業' ? T.statusText : T.titleColor}
                  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                >
                  {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                </text>
                {node.note && (
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
                    <text
                      x={c.x}
                      y={c.y + TH / 2 + 13}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={8}
                      fill="#8D6E63"
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
                  <marker
                    id={`sm-${arrow.id}`}
                    markerWidth="8"
                    markerHeight="7"
                    refX="7"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0.5, 8 3.5, 0 6.5" fill={T.arrowColor} />
                  </marker>
                </defs>
                <path
                  d={d}
                  stroke={T.arrowColor}
                  strokeWidth={1.2}
                  fill="none"
                  markerEnd={`url(#sm-${arrow.id})`}
                />
                {arrow.comment && (
                  <g>
                    <rect
                      x={mx - Math.max((arrow.comment?.length ?? 0) * 3.2, 12) - 10}
                      y={my - 19}
                      width={Math.max((arrow.comment?.length ?? 0) * 6.4 + 20, 44)}
                      height={20}
                      rx={10}
                      fill={T.commentPill}
                      stroke={T.commentBorder}
                      strokeWidth={0.5}
                    />
                    <text
                      x={mx}
                      y={my - 8}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9}
                      fill={T.commentText}
                      fontWeight={500}
                    >
                      {arrow.comment.length > 18
                        ? arrow.comment.slice(0, 18) + '...'
                        : arrow.comment}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Footer */}
      <div className={styles.footer} data-testid="shared-flow-footer">
        <div className={styles.footerIcon} style={{ background: logoGradient }}>
          F
        </div>
        <span className={styles.footerText}>Flowlineで作成</span>
      </div>
    </div>
  )
}
