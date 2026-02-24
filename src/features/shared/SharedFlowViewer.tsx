import { useState, useRef, useEffect } from 'react'
import type { Flow, ThemeId, Node as FlowNode, Arrow } from '../editor/types'
import { BRAND } from '../../constants/brand'
import { PALETTES, THEMES } from '../editor/theme-constants'
import styles from './SharedFlowViewer.module.css'
import { calcLaneWidth } from '../editor/calcLaneWidth'
import { exitPt, entryPt, buildArrowPath, type Point } from '../../lib/arrow-routing'
import { formatRelativeTime } from '../../lib/relative-time'
import { TeaserModal } from './TeaserModal'
import { BottomCTABar } from './BottomCTABar'

interface SharedFlowViewerProps {
  flow: Flow
}

export function SharedFlowViewer({ flow }: SharedFlowViewerProps) {
  const themeId = (Object.keys(THEMES).includes(flow.themeId) ? flow.themeId : 'cloud') as ThemeId
  const T = THEMES[themeId]
  const isDark = themeId === 'midnight'

  const [zoom, setZoom] = useState(1)
  const [showModal, setShowModal] = useState(true)
  const [showBottomBar, setShowBottomBar] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const closeModal = () => {
    setShowModal(false)
    timerRef.current = setTimeout(() => setShowBottomBar(true), 3000)
  }

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
    TW = 152,
    TH = 56,
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
    const s = exitPt(f, t, hw, hh, RH)
    const e = entryPt(t, f, hw, hh, RH)
    return buildArrowPath(s, e, f, t)
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
          '--theme-hero-gradient': isDark ? T.canvasBg : '#fff',
        } as React.CSSProperties
      }
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(${isDark ? '255,255,255' : '0,0,0'},0.08);border-radius:3px}
      `}</style>

      {/* Title bar */}
      <div className={styles.titleBar}>
        <a href={BRAND.flowsUrl} className={styles.logoLink}>
          <div className={styles.logoIcon} style={{ background: logoGradient }}>
            {BRAND.logoInitial}
          </div>
          <span className={styles.brandName}>{BRAND.name}</span>
        </a>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`${styles.canvas}${showModal ? ` ${styles.canvasBlurred}` : ''}`}
        data-testid="shared-flow-canvas"
        style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
      >
        {/* Hero title area */}
        <div className={styles.titleHero} data-testid="shared-title-hero">
          {flow.authorName && (
            <div className={styles.authorRow}>
              <div className={styles.authorAvatar} style={{ background: logoGradient }}>
                {flow.authorName.charAt(0).toUpperCase()}
              </div>
              <div className={styles.authorText}>
                <span className={styles.authorName}>{flow.authorName}</span>
                <span className={styles.authorSub}>が {BRAND.name} で作成</span>
              </div>
            </div>
          )}
          <div className={styles.heroTitle}>{flow.title}</div>
          <div className={styles.metaRow}>
            <div className={styles.laneDots}>
              {sortedLanes.slice(0, 6).map((lane) => {
                const p = PALETTES[lane.colorIndex % PALETTES.length]
                return (
                  <div
                    key={lane.id}
                    className={styles.laneDot}
                    style={{ backgroundColor: p.dot }}
                  />
                )
              })}
            </div>
            <span>
              {sortedLanes.length} レーン · {flow.nodes.length} ノード · 更新{' '}
              {formatRelativeTime(flow.updatedAt)}
            </span>
          </div>
        </div>
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
                  strokeWidth={1.2}
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
                  fontSize={13.5}
                  fontWeight={500}
                  fill={node.label === '作業' ? T.statusText : T.titleColor}
                  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                >
                  {node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label}
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
                      {node.note.length > 14 ? node.note.slice(0, 14) + '…' : node.note}
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
                    markerWidth="9"
                    markerHeight="8"
                    refX="8"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0.5, 9 4, 0 7.5" fill={T.arrowColor} />
                  </marker>
                </defs>
                <path
                  d={d}
                  stroke={T.arrowColor}
                  strokeWidth={2}
                  fill="none"
                  markerEnd={`url(#sm-${arrow.id})`}
                />
                {arrow.comment && (
                  <g>
                    <rect
                      x={mx - Math.max((arrow.comment?.length ?? 0) * 4, 14) - 12}
                      y={my - 22}
                      width={Math.max((arrow.comment?.length ?? 0) * 8 + 24, 50)}
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
                      {arrow.comment.length > 16 ? arrow.comment.slice(0, 16) + '…' : arrow.comment}
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
        <a href={BRAND.flowsUrl} className={styles.footerLink}>
          <div className={styles.footerIcon} style={{ background: logoGradient }}>
            {BRAND.logoInitial}
          </div>
          <span className={styles.footerText}>{BRAND.sharedFooter}</span>
        </a>
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
      {showModal && (
        <TeaserModal
          flowTitle={flow.title}
          laneCount={sortedLanes.length}
          nodeCount={flow.nodes.length}
          laneColors={sortedLanes.map((l) => l.colorIndex)}
          isDark={isDark}
          onClose={closeModal}
        />
      )}
      <BottomCTABar visible={showBottomBar} onClose={() => setShowBottomBar(false)} />
    </div>
  )
}
