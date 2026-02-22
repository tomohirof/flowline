// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlowEditor from './FlowEditor'
import type { Flow } from './types'
import { NODE_COLORS, NODE_COLORS_DARK, LINE_COLORS, STROKE_STYLES } from './theme-constants'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

beforeEach(() => {
  global.ResizeObserver = class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof ResizeObserver
})

const createMinimalFlow = (): Flow => ({
  id: 'test-flow-1',
  title: 'Test Flow',
  themeId: 'cloud',
  shareToken: null,
  lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
  nodes: [],
  arrows: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('FlowEditor', () => {
  describe('canvas SVG sizing', () => {
    it('should render SVG with min-width and min-height 100% to fill container', () => {
      const flow = createMinimalFlow()
      render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const svg = screen.getByTestId('canvas-svg')
      expect(svg).toBeTruthy()
      expect(svg.style.minWidth).toBe('100%')
      expect(svg.style.minHeight).toBe('100%')
    })
  })
})

describe('visual constants (#44, #45)', () => {
  it('should render node card with updated dimensions (152x56)', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ]
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const nodeRects = document.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find(
      (r) => r.getAttribute('width') === '152' && r.getAttribute('height') === '56',
    )
    expect(nodeRect).toBeTruthy()
  })

  it('should render node label with fontSize 13.5', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ]
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const texts = document.querySelectorAll('text')
    const nodeLabel = Array.from(texts).find(
      (t) => t.textContent === 'テスト' && t.getAttribute('font-size') === '13.5',
    )
    expect(nodeLabel).toBeTruthy()
  })

  it('should render arrow with strokeWidth 2 and updated marker', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const arrowPath = document.querySelector('path[marker-end]')
    expect(arrowPath?.getAttribute('stroke-width')).toBe('2')
    const marker = document.querySelector('marker')
    expect(marker?.getAttribute('markerWidth')).toBe('9')
  })

  it('should render comment label with fontSize 12 and height 24', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: 'テストコメント' }]
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const commentTexts = document.querySelectorAll('text')
    const commentLabel = Array.from(commentTexts).find(
      (t) => t.textContent === 'テストコメント' && t.getAttribute('font-size') === '12',
    )
    expect(commentLabel).toBeTruthy()
  })
})

describe('floating arrow controls (#46)', () => {
  const createFlowWithArrow = (): Flow => ({
    ...createMinimalFlow(),
    nodes: [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ],
    arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
  })

  it('should not show floating controls when no arrow is selected', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeNull()
  })

  it('should show floating controls when arrow is clicked', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeTruthy()
  })

  it('should hide floating controls when arrow is clicked again (toggle)', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeTruthy()
    // Click same arrow again to deselect
    const arrowHit2 = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    fireEvent.click(arrowHit2!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeNull()
  })

  it('should delete arrow when delete button is clicked', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)
    const controls = container.querySelector('[data-testid="arrow-floating-controls"]')
    expect(controls).toBeTruthy()
    // Find clickable groups (reverse, comment, delete)
    const clickableGroups = Array.from(controls!.querySelectorAll(':scope > g')).filter(
      (g) => (g as HTMLElement).style.cursor === 'pointer',
    )
    expect(clickableGroups.length).toBe(3)
    // Click delete (3rd button)
    fireEvent.click(clickableGroups[2])
    // Arrow should be removed
    expect(container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')).toBeNull()
    // Floating controls should be gone
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeNull()
  })

  it('should hide floating controls when Escape is pressed', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    fireEvent.click(arrowHit!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeNull()
  })

  it('should hide floating controls when background is clicked', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    fireEvent.click(arrowHit!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeTruthy()
    // Click the SVG background
    const svg = container.querySelector('[data-testid="canvas-svg"]')
    expect(svg).toBeTruthy()
    fireEvent.click(svg!)
    expect(container.querySelector('[data-testid="arrow-floating-controls"]')).toBeNull()
  })
})

describe('connection drag handles (#47)', () => {
  it('should render circle handles on selected node', async () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ]
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // Click on node to select it
    const nodeRects = document.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    expect(nodeRect).toBeTruthy()
    if (nodeRect) await userEvent.click(nodeRect)
    // Should show 4 circle handles
    const handles = document.querySelectorAll('[data-testid="connection-handle"]')
    expect(handles.length).toBe(4)
  })

  it('should update status bar hint text', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const statusHints = document.querySelectorAll('[class*="statusTextHint"]')
    const hintText = Array.from(statusHints).find((el) =>
      el.textContent?.includes('○をドラッグ:接続'),
    )
    expect(hintText).toBeTruthy()
  })
})

describe('file button (#48)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('should render file button in sidebar', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const fileBtn = screen.getAllByTestId('file-button')[0]
    expect(fileBtn).toBeTruthy()
    expect(fileBtn.textContent).toContain('ファイル')
  })

  it('should navigate to dashboard on click', async () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const fileBtn = screen.getAllByTestId('file-button')[0]
    await userEvent.click(fileBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})

describe('arrow routing exitPt/entryPt (#50)', () => {
  it('should route downward arrow from bottom-center to top-center', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const arrowPath = container.querySelector('path[marker-end]')
    expect(arrowPath).toBeTruthy()
    const d = arrowPath!.getAttribute('d')!
    // Downward arrow: should be a straight vertical line (same X for start and end)
    const match = d.match(/^M([\d.]+),([\d.]+)\s+L([\d.]+),([\d.]+)$/)
    expect(match).toBeTruthy()
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number)
      expect(x1).toBe(x2)
      expect(y2).toBeGreaterThan(y1)
    }
  })

  it('should route same-row arrow horizontally', () => {
    const flow = createMinimalFlow()
    flow.lanes = [
      { id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 },
      { id: 'lane-2', name: 'レーン2', colorIndex: 1, position: 1 },
    ]
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const arrowPath = container.querySelector('path[marker-end]')
    expect(arrowPath).toBeTruthy()
    const d = arrowPath!.getAttribute('d')!
    const match = d.match(/^M([\d.]+),([\d.]+)\s+L([\d.]+),([\d.]+)$/)
    expect(match).toBeTruthy()
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number)
      expect(y1).toBe(y2)
      expect(x2).toBeGreaterThan(x1)
    }
  })
})

describe('color constants (#51, #52)', () => {
  it('should have 10 NODE_COLORS for light theme', () => {
    expect(NODE_COLORS).toHaveLength(10)
    expect(NODE_COLORS[0].id).toBe('default')
    expect(NODE_COLORS[0].fill).toBeNull()
  })

  it('should have 9 NODE_COLORS_DARK for dark theme', () => {
    expect(NODE_COLORS_DARK).toHaveLength(9)
    expect(NODE_COLORS_DARK[0].id).toBe('default')
    expect(NODE_COLORS_DARK[0].fill).toBeNull()
  })

  it('should have 10 LINE_COLORS', () => {
    expect(LINE_COLORS).toHaveLength(10)
    expect(LINE_COLORS[0].id).toBe('default')
    expect(LINE_COLORS[0].color).toBeNull()
  })

  it('should have 4 STROKE_STYLES', () => {
    expect(STROKE_STYLES).toHaveLength(4)
    expect(STROKE_STYLES[0].id).toBe('solid')
    expect(STROKE_STYLES[0].dash).toBe('none')
    expect(STROKE_STYLES[1].dash).toBe('8,4')
    expect(STROKE_STYLES[2].dash).toBe('3,3')
    expect(STROKE_STYLES[3].dash).toBe('8,3,2,3')
  })
})

describe('arrow color and style rendering (#52)', () => {
  it('should render arrow with default arrowColor when no custom color', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const arrowPath = container.querySelector('path[marker-end]')
    expect(arrowPath).toBeTruthy()
    expect(arrowPath?.getAttribute('stroke')).toBe('#8A889A')
    expect(arrowPath?.getAttribute('stroke-dasharray')).toBe('none')
  })
})

describe('right panel - arrow styling sections (#52)', () => {
  const createFlowWithArrowForPanel = (): Flow => ({
    ...createMinimalFlow(),
    nodes: [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ],
    arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
  })

  it('should show line color section when arrow is selected', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrowForPanel()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)
    expect(screen.getAllByText('線の色').length).toBeGreaterThanOrEqual(1)
  })

  it('should show line style section when arrow is selected', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrowForPanel()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)
    expect(screen.getAllByText('線の種類').length).toBeGreaterThanOrEqual(1)
  })

  it('should render 10 line color swatches', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrowForPanel()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    fireEvent.click(arrowHit!)
    const colorLabel = screen.getAllByText('線の色')[0]
    const colorSection = colorLabel.closest('div')?.parentElement
    const swatches = colorSection?.querySelectorAll('[title]')
    expect(swatches?.length).toBe(10)
  })

  it('should render 4 stroke style buttons with SVG previews', () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithArrowForPanel()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    fireEvent.click(arrowHit!)
    const styleLabel = screen.getAllByText('線の種類')[0]
    const styleSection = styleLabel.closest('div')?.parentElement
    const svgPreviews = styleSection?.querySelectorAll('svg')
    expect(svgPreviews?.length).toBe(4)
  })
})

describe('right panel - node styling sections (#51, #52)', () => {
  const createFlowWithNode = (): Flow => ({
    ...createMinimalFlow(),
    nodes: [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ],
  })

  it('should show background color section when node is selected', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithNode()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    if (nodeRect) await userEvent.click(nodeRect)
    expect(screen.getAllByText('背景色').length).toBeGreaterThanOrEqual(1)
  })

  it('should show stroke color section when node is selected', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithNode()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    if (nodeRect) await userEvent.click(nodeRect)
    expect(screen.getAllByText('枠の色').length).toBeGreaterThanOrEqual(1)
  })

  it('should show stroke style section when node is selected', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithNode()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    if (nodeRect) await userEvent.click(nodeRect)
    expect(screen.getAllByText('枠の種類').length).toBeGreaterThanOrEqual(1)
  })

  it('should render 10 background color swatches for light theme', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWithNode()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    if (nodeRect) await userEvent.click(nodeRect)
    // Find the 背景色 section - search for element with title attributes (swatches)
    const bgLabels = screen.getAllByText('背景色')
    const bgLabel = bgLabels[0]
    const bgSection = bgLabel.closest('div')?.parentElement
    const swatches = bgSection?.querySelectorAll('[title]')
    expect(swatches?.length).toBe(10)
  })
})
