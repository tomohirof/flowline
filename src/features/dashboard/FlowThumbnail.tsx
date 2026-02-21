import { PALETTES } from '../editor/theme-constants'

interface FlowThumbnailProps {
  themeId: string
  laneCount: number
  nodeCount: number
}

const THEME_BG: Record<string, string> = {
  cloud: '#EAEAF2',
  midnight: '#1A1A24',
  blueprint: '#E8EDF4',
}
const LANE_BG: Record<string, string> = {
  cloud: '#F5F5F8',
  midnight: '#22222E',
  blueprint: '#F0F3F8',
}
const NODE_BG: Record<string, string> = {
  cloud: '#fff',
  midnight: '#2A2A38',
  blueprint: '#fff',
}

export function FlowThumbnail({ themeId, laneCount, nodeCount }: FlowThumbnailProps) {
  const bg = THEME_BG[themeId] || THEME_BG.cloud
  const lbg = LANE_BG[themeId] || LANE_BG.cloud
  const nbg = NODE_BG[themeId] || NODE_BG.cloud
  const isDark = themeId === 'midnight'
  const cappedLanes = Math.min(Math.max(laneCount, 0), 5)
  const lw = cappedLanes > 0 ? (140 - (cappedLanes + 1) * 4) / cappedLanes : 0
  const rows = cappedLanes > 0 ? Math.min(Math.ceil(nodeCount / cappedLanes), 4) : 0
  const colors = PALETTES.map((p) => p.dot)

  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="100" fill={bg} />
      {Array.from({ length: cappedLanes }, (_, li) => {
        const x = 10 + li * (lw + 4)
        const c = colors[li % colors.length]
        return (
          <g key={li}>
            <rect
              x={x}
              y={10}
              width={lw}
              height={80}
              rx={3}
              fill={lbg}
              stroke={isDark ? '#333' : '#ddd'}
              strokeWidth={0.3}
            />
            <circle cx={x + 6} cy={15} r={2} fill={c} />
            <rect x={x + 2} y={21} width={lw - 4} height={0.8} rx={0.4} fill={c} opacity={0.4} />
            {Array.from({ length: rows }, (_, ri) => {
              const ny = 26 + ri * 16
              return (
                <g key={ri}>
                  <rect
                    x={x + 3}
                    y={ny}
                    width={lw - 6}
                    height={12}
                    rx={2.5}
                    fill={nbg}
                    stroke={isDark ? '#444' : '#e0e0e0'}
                    strokeWidth={0.3}
                  />
                  <rect
                    x={x + 5}
                    y={ny + 2.5}
                    width={8}
                    height={2}
                    rx={1}
                    fill={c}
                    opacity={0.25}
                  />
                  <rect
                    x={x + 5}
                    y={ny + 6}
                    width={10}
                    height={1.5}
                    rx={0.75}
                    fill="#999"
                    opacity={0.2}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
      {cappedLanes > 1 && (
        <g opacity={0.2} stroke={isDark ? '#888' : '#999'} strokeWidth={0.5} fill="none">
          <path d={`M${10 + lw} 35 L${10 + lw + 4} 35 L${10 + lw + 4} 50 L${10 + lw + 8} 50`} />
        </g>
      )}
    </svg>
  )
}
