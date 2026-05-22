import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Flow, ThemeId, Node as FlowNode, Arrow } from '../editor/types'
import { BRAND } from '../../constants/brand'
import { ARROW_MARKER } from '../../constants/arrowMarker'
import { PALETTES, THEMES } from '../editor/theme-constants'
import styles from './SharedFlowViewer.module.css'
import { NodeLabelText } from './NodeLabelText'
import { calcLaneWidth } from '../editor/calcLaneWidth'
import {
  exitPt,
  entryPt,
  buildArrowPath,
  buildObstacles,
  DS,
  type Point,
  type Bbox,
  type ObstacleNode,
} from '../../lib/arrow-routing'
import { formatRelativeTime } from '../../lib/relative-time'
import { isGroupSub, isGroupParent, getGroupWidth } from '../../lib/lane-group-utils'
import { parseNote, measureMemoHeight, MEMO_W } from '../editor/memo-utils'
import { MemoText } from '../editor/components/MemoText'
import { TeaserModal } from './TeaserModal'
import { BottomCTABar } from './BottomCTABar'

interface SharedFlowViewerProps {
  flow: Flow
}

export function SharedFlowViewer({ flow }: SharedFlowViewerProps) {
  const { t, i18n } = useTranslation('shared')
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

  // 全ノードの中心座標を1度だけ収集（同一行/同一レーン obstacles 判定で再利用）
  // FlowEditor 側は riMap[t.rid] で行インデックスを取得するが、本ビューアでは
  // flow.nodes に直接 rowIndex があるためそのまま ct() に渡せる（両者は等価）。
  const obstacleNodes: ObstacleNode[] = []
  for (const n of flow.nodes) {
    const li = laneIdToIndex[n.laneId]
    if (li === undefined) continue
    const c = ct(li, n.rowIndex)
    obstacleNodes.push({ key: n.id, cx: c.x, cy: c.y })
  }

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
    const s = exitPt(
      f,
      t,
      hw,
      hh,
      RH,
      fromNode.shape as 'diamond' | undefined,
      arrow.fromSide ?? undefined,
    )
    const e = entryPt(t, f, hw, hh, RH, toNode.shape as 'diamond' | undefined)

    // 同一行/同一レーン/斜め配置に応じて obstacles を組み立てる（迂回判定用）
    const obstacles: Bbox[] = buildObstacles({
      nodes: obstacleNodes,
      fromKey: fromNode.id,
      toKey: toNode.id,
      fromCx: f.x,
      fromCy: f.y,
      toCx: t.x,
      toCy: t.y,
      sameRow: fromNode.rowIndex === toNode.rowIndex,
      sameLane: fromNode.laneId === toNode.laneId,
      rowH: RH,
      colW: LW + G,
      bboxW: TW,
      bboxH: TH,
    })

    return buildArrowPath(s, e, f, t, obstacles)
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
                <span className={styles.authorSub}>
                  {t('createdWith', { appName: BRAND.name })}
                </span>
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
              {sortedLanes.length} {t('lanes')} · {flow.nodes.length} {t('nodes')} · {t('updated')}{' '}
              {formatRelativeTime(flow.updatedAt, i18n.language)}
            </span>
          </div>
        </div>
        <svg
          data-testid="shared-canvas-header-svg"
          className={styles.headerSvg}
          width={totalW * zoom}
          height={(TM + HH + 30) * zoom}
          viewBox={`0 -30 ${totalW} ${TM + HH + 30}`}
        >
          {/* Lane headers (sticky) */}
          {sortedLanes.map((lane, li) => {
            const p = PALETTES[lane.colorIndex % PALETTES.length]
            const x = laneX(li)
            const isSub = isGroupSub(lane)
            const isParent = isGroupParent(lane)
            const headerW = isParent ? getGroupWidth(lane, sortedLanes, LW, G) : LW
            if (isSub) return null
            return (
              <g key={`lane-header-${lane.id}`}>
                <rect x={x} y={TM} width={headerW} height={HH} rx={10} fill={T.laneHeaderBg} />
                <rect x={x} y={TM + HH - 10} width={headerW} height={10} fill={T.laneHeaderBg} />
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
              </g>
            )
          })}
        </svg>
        <svg
          data-testid="shared-canvas-svg"
          className={styles.bodySvg}
          width={totalW * zoom}
          height={(totalH - HH) * zoom}
          viewBox={`0 ${TM + HH} ${totalW} ${totalH - HH}`}
        >
          {/* Lane bodies (background + sub-lane line + row lines) — header parts removed */}
          {sortedLanes.map((lane, li) => {
            const x = laneX(li)
            const fullH = HH + rowCount * RH
            const isSub = isGroupSub(lane)
            return (
              <g key={`lane-body-${lane.id}`}>
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
                {isSub && (
                  <line
                    x1={x}
                    y1={TM + 6}
                    x2={x}
                    y2={TM + HH + rowCount * RH}
                    stroke={T.laneBorder}
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                    opacity={0.4}
                  />
                )}
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
            const isDiamond = node.shape === 'diamond'
            const nodeFillColor = node.bg || T.nodeFill
            const nodeDash = node.dash || 'none'
            return (
              <g key={`node-${node.id}`}>
                {isDiamond ? (
                  <polygon
                    points={`${c.x},${c.y - DS} ${c.x + DS},${c.y} ${c.x},${c.y + DS} ${c.x - DS},${c.y}`}
                    fill={nodeFillColor}
                    stroke={node.strokeColor || T.accent}
                    strokeWidth={1.2}
                    strokeDasharray={nodeDash}
                    style={{
                      filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                    }}
                  />
                ) : (
                  <rect
                    x={c.x - TW / 2}
                    y={c.y - TH / 2}
                    width={TW}
                    height={TH}
                    fill={nodeFillColor}
                    stroke={node.strokeColor || T.nodeStroke}
                    strokeWidth={1.2}
                    strokeDasharray={nodeDash}
                    rx={10}
                    style={{
                      filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                    }}
                  />
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
                <NodeLabelText
                  label={node.label}
                  cx={c.x}
                  cy={c.y}
                  isDiamond={isDiamond}
                  defaultLabel="作業"
                  fillDefault={T.statusText}
                  fillTitle={T.titleColor}
                />

                {node.note &&
                  (() => {
                    const memo = parseNote(node.note, li, sortedLanes.length)
                    if (!memo) return null
                    const mh = measureMemoHeight(memo.text, MEMO_W)
                    const mx = c.x + memo.dx - MEMO_W / 2
                    const my = c.y + memo.dy
                    return (
                      <g>
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
                        />
                        <circle
                          cx={mx + MEMO_W / 2}
                          cy={my}
                          r={2.5}
                          fill={T.memoConnector}
                          opacity={0.6}
                        />
                        <rect
                          x={mx}
                          y={my}
                          width={MEMO_W}
                          height={mh}
                          rx={7}
                          fill={T.memoBg}
                          stroke={T.memoBorder}
                          strokeWidth={0.7}
                          opacity={0.96}
                          style={{ filter: 'drop-shadow(0 1px 3px rgba(180,160,0,0.08))' }}
                        />
                        <foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
                          <MemoText text={memo.text} color={T.memoText} />
                        </foreignObject>
                      </g>
                    )
                  })()}
              </g>
            )
          })}

          {/* Arrows */}
          {arrowPaths.map(({ arrow, path }) => {
            const { d, mx, my } = path
            const ac = arrow.color || T.arrowColor
            const dashArr = arrow.dash || 'none'
            return (
              <g key={`arrow-${arrow.id}`}>
                <defs>
                  <marker
                    id={`sm-${arrow.id}`}
                    markerWidth={ARROW_MARKER.width}
                    markerHeight={ARROW_MARKER.height}
                    refX={ARROW_MARKER.refX}
                    refY={ARROW_MARKER.refY}
                    orient="auto"
                  >
                    <polygon points={ARROW_MARKER.points} fill={ac} />
                  </marker>
                  {arrow.bidirectional && (
                    <marker
                      id={`sm-start-${arrow.id}`}
                      markerWidth={ARROW_MARKER.width}
                      markerHeight={ARROW_MARKER.height}
                      refX={ARROW_MARKER.refX}
                      refY={ARROW_MARKER.refY}
                      orient="auto-start-reverse"
                    >
                      <polygon points={ARROW_MARKER.points} fill={ac} />
                    </marker>
                  )}
                </defs>
                <path
                  d={d}
                  stroke={ac}
                  strokeWidth={2}
                  strokeDasharray={dashArr}
                  fill="none"
                  markerStart={arrow.bidirectional ? `url(#sm-start-${arrow.id})` : undefined}
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
          <span className={styles.footerText}>{t('footer')}</span>
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
