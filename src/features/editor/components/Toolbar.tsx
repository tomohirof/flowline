import type { ReactNode } from 'react'

export interface ToolbarItem {
  icon: ReactNode
  action: string
  color: string
  hoverBg: string
}

interface ToolbarTheme {
  toolbarBg: string
  toolbarBorder: string
  toolbarShadow: string
}

export interface ToolbarProps {
  x: number
  y: number
  items: ToolbarItem[]
  onAction: (action: string) => void
  theme: ToolbarTheme
}

const BTN_W = 32
const BTN_H = 30
const PAD = 8
const ICON_SIZE = 16

export function Toolbar({ x, y, items, onAction, theme }: ToolbarProps) {
  if (items.length === 0) return null
  const pillW = items.length * BTN_W + PAD * 2
  const pillH = BTN_H + 4
  const pillX = x - pillW / 2
  const pillY = y

  return (
    <g data-testid="toolbar-pill" className="toolbar-enter">
      <rect
        x={pillX}
        y={pillY}
        width={pillW}
        height={pillH}
        rx={pillH / 2}
        fill={theme.toolbarBg}
        stroke={theme.toolbarBorder}
        strokeWidth={0.5}
        style={{ filter: `drop-shadow(${theme.toolbarShadow})` }}
      />
      {items.map((item, i) => {
        const bx = pillX + PAD + i * BTN_W
        return (
          <g
            key={i}
            data-testid="toolbar-btn"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onAction(item.action)
            }}
          >
            <rect
              x={bx}
              y={pillY + 2}
              width={BTN_W}
              height={BTN_H}
              rx={8}
              fill="transparent"
              onMouseEnter={(e) => (e.target as SVGRectElement).setAttribute('fill', item.hoverBg)}
              onMouseLeave={(e) => (e.target as SVGRectElement).setAttribute('fill', 'transparent')}
            />
            <foreignObject
              x={bx + (BTN_W - ICON_SIZE) / 2}
              y={pillY + 2 + (BTN_H - ICON_SIZE) / 2}
              width={ICON_SIZE}
              height={ICON_SIZE}
            >
              <div
                style={{
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {item.icon}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </g>
  )
}
