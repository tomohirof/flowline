// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SharedFlowViewer } from './SharedFlowViewer'
import { readFileSync } from 'fs'
import { resolve } from 'path'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
})

const mockFlow = {
  id: 'flow-1',
  title: 'テストフロー',
  themeId: 'cloud',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  shareToken: null,
  lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task 1', note: null, orderIndex: 0 },
  ],
  arrows: [],
}

const flowWithArrow = (arrowProps: { dash?: string; color?: string }) => ({
  ...mockFlow,
  lanes: [
    { id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 },
    { id: 'lane-2', name: 'Lane 2', colorIndex: 1, position: 1 },
  ],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'From', note: null, orderIndex: 0 },
    { id: 'node-2', laneId: 'lane-2', rowIndex: 1, label: 'To', note: null, orderIndex: 1 },
  ],
  arrows: [
    {
      id: 'arrow-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      comment: null,
      ...arrowProps,
    },
  ],
})

describe('SharedFlowViewer', () => {
  it('should have position relative on .root for overlay stacking', () => {
    const css = readFileSync(resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const rootMatch = css.match(/\.root\s*\{[^}]*\}/s)
    expect(rootMatch).not.toBeNull()
    expect(rootMatch![0]).toMatch(/position:\s*relative/)
  })

  it('should not render viewModeBadge', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    expect(screen.queryByText('viewBadge')).toBeNull()
  })

  it('should not render flow title in titleBar', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const titleBar = document.querySelector('[class*="titleBar"]')
    expect(titleBar).not.toBeNull()
    const flowTitleInBar = titleBar!.querySelector('[class*="flowTitle"]')
    expect(flowTitleInBar).toBeNull()
  })

  it('should render flow title in hero section', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero).not.toBeNull()
    expect(hero.textContent).toContain('テストフロー')
  })

  it('should render zoom controls in footer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    expect(footer.querySelector('button')).not.toBeNull()
    expect(footer.textContent).toContain('100%')
  })

  it('should render hero section with empty title', () => {
    const emptyTitleFlow = { ...mockFlow, title: '' }
    render(<SharedFlowViewer flow={emptyTitleFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero).not.toBeNull()
  })

  it('should display full title in hero section without truncation', () => {
    const longTitle = 'あ'.repeat(50)
    const longTitleFlow = { ...mockFlow, title: longTitle }
    render(<SharedFlowViewer flow={longTitleFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).toContain(longTitle)
  })

  it('should render author info when authorName is provided', () => {
    const flowWithAuthor = { ...mockFlow, authorName: 'Test Author' }
    render(<SharedFlowViewer flow={flowWithAuthor} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).toContain('Test Author')
    expect(hero.textContent).toContain('createdWith')
  })

  it('should not render author row when authorName is not provided', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).not.toContain('createdWith')
  })

  it('should display meta info with lane and node counts', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).toContain('1 lanes')
    expect(hero.textContent).toContain('1 nodes')
  })

  it('should render brand logo in footer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    expect(footer.textContent).toContain('footer')
  })

  it('should render logo in titleBar as a link to Flowline', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const titleBar = document.querySelector('[class*="titleBar"]')
    const link = titleBar!.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('https://flowline.six1.jp/flows')
  })

  it('should render footer logo as a link to Flowline', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    const link = footer.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('https://flowline.six1.jp/flows')
  })

  it('should render titleHero inside canvas for gradient overlay on dot grid', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const canvas = screen.getByTestId('shared-flow-canvas')
    const heroInCanvas = canvas.querySelector('[data-testid="shared-title-hero"]')
    expect(heroInCanvas).not.toBeNull()
  })

  it('should have titleHero with gradient background in CSS', () => {
    const css = readFileSync(resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const heroMatch = css.match(/\.titleHero\s*\{[^}]*\}/s)
    expect(heroMatch).not.toBeNull()
    expect(heroMatch![0]).toMatch(/linear-gradient/)
  })

  it('should use white gradient for light theme (not canvas-bg)', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const root = screen.getByTestId('shared-flow-view')
    const style = root.getAttribute('style') || ''
    expect(style).toContain('--theme-hero-gradient')
    expect(style).toContain('#fff')
  })

  it('should use dark gradient for midnight theme', () => {
    const darkFlow = { ...mockFlow, themeId: 'midnight' }
    render(<SharedFlowViewer flow={darkFlow} />)
    const root = screen.getByTestId('shared-flow-view')
    const style = root.getAttribute('style') || ''
    expect(style).toContain('--theme-hero-gradient')
    expect(style).not.toContain('#fff')
  })

  it('should have position sticky and left 0 on titleHero for scroll-proof gradient', () => {
    const css = readFileSync(resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const heroMatch = css.match(/\.titleHero\s*\{[^}]*\}/s)
    expect(heroMatch).not.toBeNull()
    expect(heroMatch![0]).toMatch(/position:\s*sticky/)
    expect(heroMatch![0]).toMatch(/left:\s*0/)
  })

  it('should render diamond node with polygon element', () => {
    const diamondFlow = {
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'Diamond',
          note: null,
          orderIndex: 0,
          shape: 'diamond' as const,
        },
      ],
    }
    render(<SharedFlowViewer flow={diamondFlow} />)
    const canvas = screen.getByTestId('shared-flow-canvas')
    const polygon = canvas.querySelector('polygon')
    expect(polygon).not.toBeNull()
  })

  it('should not render lane tag for diamond node', () => {
    const diamondFlow = {
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'Diamond',
          note: null,
          orderIndex: 0,
          shape: 'diamond' as const,
        },
      ],
    }
    render(<SharedFlowViewer flow={diamondFlow} />)
    const canvas = screen.getByTestId('shared-flow-canvas')
    const svg = canvas.querySelector('svg')!
    const texts = svg.querySelectorAll('text')
    const laneTagTexts = Array.from(texts).filter(
      (t) => t.getAttribute('font-size') === '8' && t.textContent === 'Lane 1',
    )
    expect(laneTagTexts).toHaveLength(0)
  })

  it('should not truncate diamond node label', () => {
    const diamondFlow = {
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: '1234567890',
          note: null,
          orderIndex: 0,
          shape: 'diamond' as const,
        },
      ],
    }
    render(<SharedFlowViewer flow={diamondFlow} />)
    const svg = screen.getByTestId('shared-canvas-svg')
    const texts = Array.from(svg.querySelectorAll('text'))
    const labelText = texts.find((t) => t.textContent === '1234567890')
    expect(labelText).not.toBeUndefined()
    expect(labelText!.textContent).not.toContain('…')
  })

  it('should render newline label as multiple tspans', () => {
    const multilineFlow = {
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'line1\nline2\nline3',
          note: null,
          orderIndex: 0,
        },
      ],
    }
    render(<SharedFlowViewer flow={multilineFlow} />)
    const svg = screen.getByTestId('shared-canvas-svg')
    const texts = Array.from(svg.querySelectorAll('text'))
    const labelText = texts.find((t) => t.textContent === 'line1line2line3')
    expect(labelText).not.toBeUndefined()
    const tspans = labelText!.querySelectorAll('tspan')
    expect(tspans).toHaveLength(3)
    expect(tspans[0].textContent).toBe('line1')
    expect(tspans[1].textContent).toBe('line2')
    expect(tspans[2].textContent).toBe('line3')
  })

  it('should render rect node without polygon when shape is undefined', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const canvas = screen.getByTestId('shared-flow-canvas')
    const svg = canvas.querySelector('svg')!
    const nodeRects = svg.querySelectorAll('rect')
    expect(nodeRects.length).toBeGreaterThan(0)
    const polygons = svg.querySelectorAll('polygon')
    expect(polygons).toHaveLength(0)
  })

  it('should not render note for diamond node', () => {
    const diamondFlow = {
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'Diamond',
          note: 'Some note',
          orderIndex: 0,
          shape: 'diamond' as const,
        },
      ],
    }
    render(<SharedFlowViewer flow={diamondFlow} />)
    const canvas = screen.getByTestId('shared-flow-canvas')
    const svg = canvas.querySelector('svg')!
    const texts = Array.from(svg.querySelectorAll('text'))
    const noteText = texts.find((t) => t.textContent?.includes('Some note'))
    expect(noteText).toBeUndefined()
  })

  describe('arrow custom styles', () => {
    it('should apply arrow.dash to <path> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ dash: '8,4' })} />)
      const path = document.querySelector('path[stroke-dasharray="8,4"]')
      expect(path).not.toBeNull()
    })

    it('should apply arrow.color to <path> stroke', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ color: '#ff0000' })} />)
      const path = document.querySelector('path[stroke="#ff0000"]')
      expect(path).not.toBeNull()
    })

    it('should apply arrow.color to <marker> polygon fill', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ color: '#ff0000' })} />)
      const polygon = document.querySelector('polygon[fill="#ff0000"]')
      expect(polygon).not.toBeNull()
    })

    it('should render arrow marker with shrunk size 7x6', () => {
      render(<SharedFlowViewer flow={flowWithArrow({})} />)
      const marker = document.querySelector('marker#sm-arrow-1')
      expect(marker?.getAttribute('markerWidth')).toBe('7')
      expect(marker?.getAttribute('markerHeight')).toBe('6')
      expect(marker?.getAttribute('refX')).toBe('6')
      expect(marker?.getAttribute('refY')).toBe('3')
      const polygon = marker?.querySelector('polygon')
      expect(polygon?.getAttribute('points')).toBe('0 0.5, 7 3, 0 5.5')
    })

    it('should render bidirectional marker-start with shrunk size 7x6', () => {
      const flow = {
        ...flowWithArrow({}),
        arrows: [
          {
            id: 'arrow-1',
            fromNodeId: 'node-1',
            toNodeId: 'node-2',
            comment: null,
            bidirectional: true,
          },
        ],
      }
      render(<SharedFlowViewer flow={flow} />)
      const startMarker = document.querySelector('marker#sm-start-arrow-1')
      expect(startMarker?.getAttribute('markerWidth')).toBe('7')
      expect(startMarker?.getAttribute('markerHeight')).toBe('6')
      expect(startMarker?.getAttribute('refX')).toBe('6')
      expect(startMarker?.getAttribute('refY')).toBe('3')
      expect(startMarker?.getAttribute('orient')).toBe('auto-start-reverse')
      const polygon = startMarker?.querySelector('polygon')
      expect(polygon?.getAttribute('points')).toBe('0 0.5, 7 3, 0 5.5')
    })
  })

  describe('rect node custom styles', () => {
    const flowWithNode = (nodeProps: { bg?: string; strokeColor?: string; dash?: string }) => ({
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'Task',
          note: null,
          orderIndex: 0,
          ...nodeProps,
        },
      ],
    })

    it('should apply node.dash to <rect> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={flowWithNode({ dash: '6,3' })} />)
      const rect = document.querySelector('rect[stroke-dasharray="6,3"]')
      expect(rect).not.toBeNull()
    })

    it('should apply node.bg to <rect> fill', () => {
      render(<SharedFlowViewer flow={flowWithNode({ bg: '#abcdef' })} />)
      const rect = document.querySelector('rect[fill="#abcdef"]')
      expect(rect).not.toBeNull()
    })

    it('should apply node.strokeColor to <rect> stroke', () => {
      render(<SharedFlowViewer flow={flowWithNode({ strokeColor: '#123456' })} />)
      const rect = document.querySelector('rect[stroke="#123456"]')
      expect(rect).not.toBeNull()
    })
  })

  describe('diamond node custom styles', () => {
    const diamondFlow = (nodeProps: { bg?: string; strokeColor?: string; dash?: string }) => ({
      ...mockFlow,
      nodes: [
        {
          id: 'node-1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'Decision',
          note: null,
          orderIndex: 0,
          shape: 'diamond' as const,
          ...nodeProps,
        },
      ],
    })

    it('should apply node.dash to diamond <polygon> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={diamondFlow({ dash: '5,2' })} />)
      const polygon = document.querySelector('polygon[stroke-dasharray="5,2"]')
      expect(polygon).not.toBeNull()
    })

    it('should apply node.bg to diamond <polygon> fill', () => {
      render(<SharedFlowViewer flow={diamondFlow({ bg: '#fedcba' })} />)
      const polygon = document.querySelector('polygon[fill="#fedcba"]')
      expect(polygon).not.toBeNull()
    })

    it('should apply node.strokeColor to diamond <polygon> stroke', () => {
      render(<SharedFlowViewer flow={diamondFlow({ strokeColor: '#654321' })} />)
      const polygon = document.querySelector('polygon[stroke="#654321"]')
      expect(polygon).not.toBeNull()
    })
  })

  describe('default theme fallback (regression)', () => {
    it('should render <rect> with stroke-dasharray none and non-null fill/stroke when no custom styles', () => {
      render(<SharedFlowViewer flow={mockFlow} />)
      const svg = screen.getByTestId('shared-canvas-svg')
      const nodeRect = Array.from(svg.querySelectorAll('rect')).find(
        (r) => r.getAttribute('rx') === '10' && r.getAttribute('width') === '152',
      )
      expect(nodeRect).not.toBeUndefined()
      expect(nodeRect!.getAttribute('stroke-dasharray')).toBe('none')
      expect(nodeRect!.getAttribute('fill')).not.toBeNull()
      expect(nodeRect!.getAttribute('stroke')).not.toBeNull()
    })

    it('should render arrow <path> with stroke-dasharray none when no custom styles', () => {
      render(<SharedFlowViewer flow={flowWithArrow({})} />)
      const arrowPath = Array.from(document.querySelectorAll('path')).find((p) =>
        p.getAttribute('marker-end')?.startsWith('url(#sm-'),
      )
      expect(arrowPath).not.toBeUndefined()
      expect(arrowPath!.getAttribute('stroke-dasharray')).toBe('none')
    })
  })

  it('同一行で経路上にノードがある矢印は迂回パスを生成する（A→C, 間にB）', () => {
    const detourFlow = {
      ...mockFlow,
      lanes: [
        { id: 'lane-1', name: 'A', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'B', colorIndex: 1, position: 1 },
        { id: 'lane-3', name: 'C', colorIndex: 2, position: 2 },
      ],
      nodes: [
        { id: 'node-a', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'node-b', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
        { id: 'node-c', laneId: 'lane-3', rowIndex: 0, label: 'C', note: null, orderIndex: 2 },
      ],
      arrows: [{ id: 'arrow-1', fromNodeId: 'node-a', toNodeId: 'node-c', comment: null }],
    }
    render(<SharedFlowViewer flow={detourFlow} />)
    // 矢印 svg path（marker-end 付き）を取得
    const paths = Array.from(document.querySelectorAll('path')).filter((p) =>
      p.getAttribute('marker-end')?.startsWith('url(#sm-'),
    )
    expect(paths.length).toBeGreaterThanOrEqual(1)
    const d = paths[0].getAttribute('d')!
    // 迂回パスは 5 セグメント（M L L L L）。直線パスは M L のみなので区別可能。
    // 5 セグメント目は target 側面への水平進入。
    const segmentCount = d.match(/[ML]/g)?.length ?? 0
    expect(segmentCount).toBe(5)
  })

  it('同一行で隣接レーン（間にノードなし）の矢印は直線パス', () => {
    const straightFlow = {
      ...mockFlow,
      lanes: [
        { id: 'lane-1', name: 'A', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'B', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'node-a', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'node-b', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'arrow-1', fromNodeId: 'node-a', toNodeId: 'node-b', comment: null }],
    }
    render(<SharedFlowViewer flow={straightFlow} />)
    const paths = Array.from(document.querySelectorAll('path')).filter((p) =>
      p.getAttribute('marker-end')?.startsWith('url(#sm-'),
    )
    expect(paths.length).toBeGreaterThanOrEqual(1)
    const d = paths[0].getAttribute('d')!
    // 直線パスは M L の 2 セグメント
    const segmentCount = d.match(/[ML]/g)?.length ?? 0
    expect(segmentCount).toBe(2)
  })

  it('should render marker-start on bidirectional arrow', () => {
    const flow = {
      ...mockFlow,
      lanes: [
        { id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'Lane 2', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'node-a', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'node-b', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [
        {
          id: 'arrow-1',
          fromNodeId: 'node-a',
          toNodeId: 'node-b',
          comment: null,
          bidirectional: true,
        },
      ],
    }
    render(<SharedFlowViewer flow={flow} />)
    const path = Array.from(document.querySelectorAll('path')).find((p) =>
      p.getAttribute('marker-end')?.startsWith('url(#sm-'),
    )
    expect(path).toBeTruthy()
    expect(path?.getAttribute('marker-start')).toBe('url(#sm-start-arrow-1)')
    expect(document.querySelector('marker#sm-start-arrow-1')).toBeTruthy()
  })

  it('should not render marker-start on regular (one-way) arrow', () => {
    const flow = {
      ...mockFlow,
      lanes: [
        { id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'Lane 2', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'node-a', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'node-b', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'arrow-1', fromNodeId: 'node-a', toNodeId: 'node-b', comment: null }],
    }
    render(<SharedFlowViewer flow={flow} />)
    const path = Array.from(document.querySelectorAll('path')).find((p) =>
      p.getAttribute('marker-end')?.startsWith('url(#sm-'),
    )
    expect(path?.getAttribute('marker-start')).toBeNull()
    expect(document.querySelector('marker#sm-start-arrow-1')).toBeNull()
  })

  it('should render canvas as two stacked SVGs (header + body) in shared viewer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    expect(screen.getByTestId('shared-canvas-header-svg')).toBeInTheDocument()
    expect(screen.getByTestId('shared-canvas-svg')).toBeInTheDocument()
  })

  it('should render lane name labels inside shared header svg', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const headerSvg = screen.getByTestId('shared-canvas-header-svg')
    const texts = headerSvg.querySelectorAll('text')
    expect(texts.length).toBeGreaterThan(0)
  })
})
