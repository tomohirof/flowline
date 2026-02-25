// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlowEditor from './FlowEditor'
import type { Flow } from './types'
import { BRAND } from '../../constants/brand'
import { NODE_COLORS, NODE_COLORS_DARK, LINE_COLORS, STROKE_STYLES } from './theme-constants'
import { apiFetch } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class extends Error {
    status: number
    constructor(msg: string, status: number) {
      super(msg)
      this.status = status
    }
  },
}))

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a
      href={to}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        mockNavigate(to)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))

const mockLogout = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
    loading: false,
    logout: mockLogout,
  }),
}))

beforeEach(() => {
  global.ResizeObserver = class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof ResizeObserver

  mockApiFetch.mockResolvedValue({
    settings: {
      copyLabelOnSameRow: false,
      autoConnect: true,
      autoAddRow: true,
      enterEditOnCreate: true,
      showDotGrid: true,
      showOrderBadge: true,
    },
    profile: { name: 'Test User', email: 'test@example.com' },
  })
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
    const hintText = Array.from(statusHints).find((el) => el.textContent?.includes('○:接続'))
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

describe('auto-save payload optimization', () => {
  it('should send metadata-only payload when title is changed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const flow = createMinimalFlow()

    const { container } = render(<FlowEditor flow={flow} onSave={onSave} saveStatus="saved" />)

    // Click on the title text to enter edit mode (use class selector to avoid multiple matches)
    const titleSpan = container.querySelector('[class*="titleText"]') as HTMLElement
    expect(titleSpan).toBeTruthy()
    await user.click(titleSpan)

    // Change the title
    const titleInput = document.querySelector('input[class*="titleInput"]') as HTMLInputElement
    expect(titleInput).toBeTruthy()
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')

    // Blur to exit edit mode and trigger state update
    fireEvent.blur(titleInput)

    // Wait for the useEffect to fire and check onSave was called with metadata-only payload
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })

    // The payload should only contain title and themeId (no lanes, nodes, arrows)
    const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0]
    expect(lastCall).toHaveProperty('title', 'New Title')
    expect(lastCall).toHaveProperty('themeId', 'cloud')
    expect(lastCall).not.toHaveProperty('lanes')
    expect(lastCall).not.toHaveProperty('nodes')
    expect(lastCall).not.toHaveProperty('arrows')
  })

  it('should send full payload when structure is changed (arrow deleted)', async () => {
    const onSave = vi.fn()
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
    }

    const { container } = render(<FlowEditor flow={flow} onSave={onSave} saveStatus="saved" />)

    // Click arrow to select it
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)

    // Delete the arrow via floating controls
    const controls = container.querySelector('[data-testid="arrow-floating-controls"]')
    expect(controls).toBeTruthy()
    const clickableGroups = Array.from(controls!.querySelectorAll(':scope > g')).filter(
      (g) => (g as HTMLElement).style.cursor === 'pointer',
    )
    // Click delete (3rd button)
    fireEvent.click(clickableGroups[2])

    // Verify arrow was actually deleted from DOM
    expect(container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')).toBeNull()

    // Wait for auto-save to trigger
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })

    // The payload should contain the full structure (lanes, nodes, arrows)
    const lastCall = onSave.mock.calls[onSave.mock.calls.length - 1][0]
    expect(lastCall).toHaveProperty('title')
    expect(lastCall).toHaveProperty('themeId')
    expect(lastCall).toHaveProperty('lanes')
    expect(lastCall).toHaveProperty('nodes')
    expect(lastCall).toHaveProperty('arrows')
  })

  it('should not call onSave on initial render', () => {
    const onSave = vi.fn()
    const flow = createMinimalFlow()

    render(<FlowEditor flow={flow} onSave={onSave} saveStatus="saved" />)

    // onSave should not be called on initial render
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('editorSettings panel (#72)', () => {
  it('should show behavior and display setting sections when nothing selected', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    expect(screen.getAllByText('挙動').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('表示').length).toBeGreaterThanOrEqual(1)
  })

  it('should render all 6 setting checkboxes with correct data-testid', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const settingKeys = [
      'copyLabelOnSameRow',
      'autoConnect',
      'autoAddRow',
      'enterEditOnCreate',
      'showDotGrid',
      'showOrderBadge',
    ]
    for (const key of settingKeys) {
      expect(screen.getAllByTestId(`setting-${key}`).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('should render correct labels for all settings', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    expect(screen.getAllByText('同行テキストコピー').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('自動接続').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('自動行追加').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('作成後すぐ編集').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ドットグリッド').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('順番バッジ').length).toBeGreaterThanOrEqual(1)
  })

  it('should toggle autoConnect setting when checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const checkbox = screen.getAllByTestId('setting-autoConnect')[0]
    // Default ON: should have checkmark SVG
    expect(checkbox.querySelector('svg')).toBeTruthy()
    // Click to toggle OFF
    await user.click(checkbox)
    expect(checkbox.querySelector('svg')).toBeNull()
    // Click to toggle back ON
    await user.click(checkbox)
    expect(checkbox.querySelector('svg')).toBeTruthy()
  })

  it('should have copyLabelOnSameRow OFF by default (no checkmark)', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const checkbox = screen.getAllByTestId('setting-copyLabelOnSameRow')[0]
    expect(checkbox.querySelector('svg')).toBeNull()
  })

  it('should have autoConnect, autoAddRow, enterEditOnCreate ON by default', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    expect(screen.getAllByTestId('setting-autoConnect')[0].querySelector('svg')).toBeTruthy()
    expect(screen.getAllByTestId('setting-autoAddRow')[0].querySelector('svg')).toBeTruthy()
    expect(screen.getAllByTestId('setting-enterEditOnCreate')[0].querySelector('svg')).toBeTruthy()
  })

  it('should have showDotGrid and showOrderBadge ON by default', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    expect(screen.getAllByTestId('setting-showDotGrid')[0].querySelector('svg')).toBeTruthy()
    expect(screen.getAllByTestId('setting-showOrderBadge')[0].querySelector('svg')).toBeTruthy()
  })

  it('should hide settings sections when a node is selected', async () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const nodeRect = Array.from(container.querySelectorAll('rect[rx="10"]')).find(
      (r) => r.getAttribute('width') === '152',
    )
    if (nodeRect) await userEvent.click(nodeRect)
    // When node selected, right panel shows node properties, not settings
    expect(screen.getAllByText('背景色').length).toBeGreaterThanOrEqual(1)
  })
})

describe('editor user avatar and UserMenuPanel (#58)', () => {
  it('should render user avatar in title bar', async () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    // Multiple matches possible due to portal/re-render; verify at least one exists
    const avatars = screen.getAllByTestId('editor-user-avatar')
    expect(avatars[0]).toBeInTheDocument()
  })

  it('should open user menu panel when editor avatar is clicked', async () => {
    const user = userEvent.setup()
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const avatars = screen.getAllByTestId('editor-user-avatar')
    await user.click(avatars[0])
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
  })

  it('should close user menu panel when overlay is clicked in editor', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const avatar = container.querySelector('[data-testid="editor-user-avatar"]') as HTMLElement
    expect(avatar).toBeTruthy()
    await user.click(avatar)
    const panel = container.querySelector('[data-testid="user-menu-panel"]')
    expect(panel).toBeTruthy()
    const overlay = container.querySelector('[data-testid="user-menu-overlay"]') as HTMLElement
    expect(overlay).toBeTruthy()
    await user.click(overlay)
    expect(container.querySelector('[data-testid="user-menu-panel"]')).toBeNull()
  })
})

describe('Multi-select (#76)', () => {
  const createFlowWith2Nodes = (): Flow => {
    const flow = createMinimalFlow()
    flow.lanes = [
      { id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 },
      { id: 'lane-2', name: 'レーン2', colorIndex: 1, position: 1 },
    ]
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'タスクA', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-2', rowIndex: 0, label: 'タスクB', note: null, orderIndex: 1 },
    ]
    return flow
  }

  const findNodeRects = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
      (r) => r.getAttribute('width') === '152',
    )

  it('should enter multi-select mode when Shift+clicking two nodes', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)
    expect(rects.length).toBe(2)

    // Shift+click first node, then Shift+click second node
    fireEvent.click(rects[0], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    // Panel header should show "2件選択"
    expect(screen.getAllByText('2件選択').length).toBeGreaterThanOrEqual(1)
  })

  it('should clear multi-select on normal click', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)

    // Shift+click both nodes
    fireEvent.click(rects[0], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    // Multi-select panel should be visible
    expect(container.querySelector('[data-testid="multi-delete-btn"]')).toBeTruthy()

    // Normal click on background clears multi-select
    const svg = container.querySelector('[data-testid="canvas-svg"]')!
    fireEvent.click(svg)

    // Multi-select panel should be gone
    expect(container.querySelector('[data-testid="multi-delete-btn"]')).toBeNull()
    expect(container.querySelector('[data-testid="multi-deselect-btn"]')).toBeNull()
  })

  it('should show multi-select panel with delete and deselect buttons', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)

    fireEvent.click(rects[0], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    expect(container.querySelector('[data-testid="multi-delete-btn"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="multi-deselect-btn"]')).toBeTruthy()
  })

  it('should show Shift+click hint in default status bar', () => {
    render(<FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />)
    const hints = document.querySelectorAll('[class*="statusTextHint"]')
    const shiftHint = Array.from(hints).find((el) =>
      el.textContent?.includes('Shift+クリック:複数選択'),
    )
    expect(shiftHint).toBeTruthy()
  })

  it('should show multi-select hint in status bar when nodes are selected', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)

    fireEvent.click(rects[0], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    const hints = document.querySelectorAll('[class*="statusTextHint"]')
    const multiHint = Array.from(hints).find((el) => el.textContent?.includes('件選択中'))
    expect(multiHint).toBeTruthy()
  })

  it('should clear multi-select when deselect button is clicked', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)

    fireEvent.click(rects[0], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    // Multi-select panel should be visible
    const deselectBtn = container.querySelector('[data-testid="multi-deselect-btn"]') as HTMLElement
    expect(deselectBtn).toBeTruthy()
    fireEvent.click(deselectBtn)

    // Multi-select panel should be gone after deselect
    expect(container.querySelector('[data-testid="multi-delete-btn"]')).toBeNull()
    expect(container.querySelector('[data-testid="multi-deselect-btn"]')).toBeNull()
  })

  it('should seed selected node into multi-select on first Shift+click', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)

    // Normal click on first node to select it
    fireEvent.click(rects[0])
    expect(screen.getAllByText('ノード').length).toBeGreaterThanOrEqual(1)

    // Shift+click on second node - should seed first node into multiSel too
    fireEvent.click(rects[1], { shiftKey: true })

    // Both nodes should be in multi-select: 2件選択
    expect(screen.getAllByText('2件選択').length).toBeGreaterThanOrEqual(1)
  })

  it('should not start drag when Shift+mouseDown on node (#88)', async () => {
    const { container } = render(
      <FlowEditor flow={createFlowWith2Nodes()} onSave={vi.fn()} saveStatus="saved" />,
    )
    const rects = findNodeRects(container)
    expect(rects.length).toBe(2)

    // Normal click to select first node
    fireEvent.click(rects[0])

    // Shift+mouseDown should NOT start drag, then Shift+click should trigger multi-select
    fireEvent.mouseDown(rects[1], { shiftKey: true })
    fireEvent.click(rects[1], { shiftKey: true })

    // Multi-select should work: "2件選択" should be visible
    expect(screen.getAllByText('2件選択').length).toBeGreaterThanOrEqual(1)
  })
})

describe('logo navigation (#83)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('should render logo as a link to /flows', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const logoLinks = screen.getAllByTestId('logo-link')
    const logoLink = logoLinks[0]
    expect(logoLink).toBeTruthy()
    expect(logoLink.tagName).toBe('A')
    expect(logoLink.getAttribute('href')).toBe('/flows')
  })

  it('should navigate to /flows when logo is clicked', async () => {
    const user = userEvent.setup()
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const logoLinks = screen.getAllByTestId('logo-link')
    await user.click(logoLinks[0])
    expect(mockNavigate).toHaveBeenCalledWith('/flows')
  })

  it('should contain logo icon and brand name text', () => {
    render(<FlowEditor flow={createMinimalFlow()} onSave={vi.fn()} saveStatus="saved" />)
    const logoLinks = screen.getAllByTestId('logo-link')
    const logoLink = logoLinks[0]
    expect(logoLink.textContent).toContain(BRAND.logoInitial)
    expect(logoLink.textContent).toContain(BRAND.name)
  })
})

describe('IME composition Enter (#87)', () => {
  it('should keep title input open when Enter is pressed during IME composition (isComposing=true)', async () => {
    const user = userEvent.setup()
    const flow = createMinimalFlow()

    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Click on the title text to enter edit mode
    const titleSpan = container.querySelector('[class*="titleText"]') as HTMLElement
    expect(titleSpan).toBeTruthy()
    await user.click(titleSpan)

    // Title input should be visible
    const titleInput = document.querySelector('input[class*="titleInput"]') as HTMLInputElement
    expect(titleInput).toBeTruthy()

    // Press Enter with isComposing=true (simulating IME composition via React fireEvent)
    // React's onKeyDown receives a SyntheticEvent; nativeEvent.isComposing comes from the DOM event
    fireEvent.keyDown(titleInput, { key: 'Enter', isComposing: true })

    // Title input should still be visible (IME composition should NOT close it)
    const titleInputAfter = document.querySelector('input[class*="titleInput"]') as HTMLInputElement
    expect(titleInputAfter).toBeTruthy()
  })

  it('should close title input when Enter is pressed normally (isComposing=false)', async () => {
    const user = userEvent.setup()
    const flow = createMinimalFlow()

    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Click on the title text to enter edit mode
    const titleSpan = container.querySelector('[class*="titleText"]') as HTMLElement
    expect(titleSpan).toBeTruthy()
    await user.click(titleSpan)

    // Title input should be visible
    const titleInput = document.querySelector('input[class*="titleInput"]') as HTMLInputElement
    expect(titleInput).toBeTruthy()

    // Press Enter normally (not composing) - should close the input
    fireEvent.keyDown(titleInput, { key: 'Enter' })

    // Title input should be gone (replaced by span)
    const titleInputAfter = document.querySelector('input[class*="titleInput"]') as HTMLInputElement
    expect(titleInputAfter).toBeNull()
  })

  it('should keep node label input open when Enter is pressed during IME composition', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Double-click on node rect to enter edit mode
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    expect(nodeRect).toBeTruthy()
    fireEvent.dblClick(nodeRect!)

    // Advance timers to allow the setTimeout for focus to fire
    vi.advanceTimersByTime(50)

    // Wait for the node edit input to appear
    const nodeInput = document.querySelector('input[class*="nodeEditInput"]') as HTMLInputElement
    expect(nodeInput).toBeTruthy()

    // Press Enter with isComposing=true (simulating IME composition)
    fireEvent.keyDown(nodeInput, { key: 'Enter', isComposing: true })

    // Node edit input should still be visible
    const nodeInputAfter = document.querySelector(
      'input[class*="nodeEditInput"]',
    ) as HTMLInputElement
    expect(nodeInputAfter).toBeTruthy()
    vi.useRealTimers()
  })

  it('should keep note input open when Enter is pressed during IME composition', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: 'メモ内容', orderIndex: 0 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Find the note text element and click it to enter note edit mode
    const noteTexts = container.querySelectorAll('text')
    const noteText = Array.from(noteTexts).find((t) => t.textContent === 'メモ内容')
    expect(noteText).toBeTruthy()
    fireEvent.click(noteText!)

    // Advance timers to allow the setTimeout for focus to fire
    vi.advanceTimersByTime(50)

    // Wait for the note edit input to appear
    const noteInput = document.querySelector('input[class*="noteEditInput"]') as HTMLInputElement
    expect(noteInput).toBeTruthy()

    // Press Enter with isComposing=true (simulating IME composition)
    fireEvent.keyDown(noteInput, { key: 'Enter', isComposing: true })

    // Note edit input should still be visible
    const noteInputAfter = document.querySelector(
      'input[class*="noteEditInput"]',
    ) as HTMLInputElement
    expect(noteInputAfter).toBeTruthy()
    vi.useRealTimers()
  })

  it('should keep lane name input open when Enter is pressed during IME composition', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Find the transparent rect overlay on the lane header and double-click it
    const allRects = container.querySelectorAll('rect')
    const laneHeaderRect = Array.from(allRects).find(
      (r) =>
        r.getAttribute('fill') === 'transparent' && (r as HTMLElement).style.cursor === 'pointer',
    )
    expect(laneHeaderRect).toBeTruthy()
    fireEvent.dblClick(laneHeaderRect!)

    // Advance timers to allow the setTimeout for focus to fire
    vi.advanceTimersByTime(50)

    // Wait for the lane name input to appear
    const laneInput = document.querySelector('input[class*="laneNameInput"]') as HTMLInputElement
    expect(laneInput).toBeTruthy()

    // Press Enter with isComposing=true (simulating IME composition)
    fireEvent.keyDown(laneInput, { key: 'Enter', isComposing: true })

    // Lane name input should still be visible
    const laneInputAfter = document.querySelector(
      'input[class*="laneNameInput"]',
    ) as HTMLInputElement
    expect(laneInputAfter).toBeTruthy()
    vi.useRealTimers()
  })

  it('should keep arrow comment input open when Enter is pressed during IME composition', async () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: 'テスト' }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Click on arrow to select it
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)

    // Click comment button on floating controls to enter edit mode
    const controls = container.querySelector('[data-testid="arrow-floating-controls"]')
    expect(controls).toBeTruthy()
    const clickableGroups = Array.from(controls!.querySelectorAll(':scope > g')).filter(
      (g) => (g as HTMLElement).style.cursor === 'pointer',
    )
    // Comment button is the 2nd button
    fireEvent.click(clickableGroups[1])

    // Wait for the arrow comment input to appear
    await waitFor(() => {
      const commentInput = container.querySelector(
        'input[placeholder="コメント…"]',
      ) as HTMLInputElement
      expect(commentInput).toBeTruthy()
    })

    const commentInput = container.querySelector(
      'input[placeholder="コメント…"]',
    ) as HTMLInputElement

    // Press Enter with isComposing=true (simulating IME composition)
    fireEvent.keyDown(commentInput, { key: 'Enter', isComposing: true })

    // Arrow comment input should still be visible
    const commentInputAfter = container.querySelector(
      'input[placeholder="コメント…"]',
    ) as HTMLInputElement
    expect(commentInputAfter).toBeTruthy()
  })
})

describe('empty row at bottom on reload (#84)', () => {
  it('should have extra empty row below the last node row', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 6, label: 'B', note: null, orderIndex: 1 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // ノードの最大rowIndex=6 → 行0~6(7行) + 空白行1 = 8行
    const rows = container.querySelectorAll('[data-testid^="canvas-row-"]')
    expect(rows.length).toBe(8)
  })

  it('should have at least 7 rows when no nodes exist', () => {
    const flow = createMinimalFlow()
    flow.nodes = []
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const rows = container.querySelectorAll('[data-testid^="canvas-row-"]')
    // ノードなし: maxRow=6, rowCount=6+1=7
    expect(rows.length).toBe(7)
  })

  it('should have extra empty row when nodes span many rows', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 9, label: 'B', note: null, orderIndex: 1 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // maxRowIndex=9 → 行0~9(10行) + 空白行1 = 11行
    const rows = container.querySelectorAll('[data-testid^="canvas-row-"]')
    expect(rows.length).toBe(11)
  })
})

describe('row insertion UI (#91)', () => {
  it('should render row gap hit areas for each row boundary', () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // With 7+ rows (default), there should be 8+ row gap hit areas (between + after)
    const rowGapHitAreas = document.querySelectorAll('[data-testid^="rowgap-hit-"]')
    expect(rowGapHitAreas.length).toBeGreaterThanOrEqual(8)
  })

  it('should show row gap visual feedback on hover', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const hitArea = document.querySelector('[data-testid="rowgap-hit-0"]')
    expect(hitArea).toBeTruthy()
    await userEvent.hover(hitArea!)
    const feedback = document.querySelector('[data-testid="rowgap-feedback-0"]')
    expect(feedback).toBeTruthy()
  })

  it('should insert row at specified position when row gap is clicked twice (2-click confirm)', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const initialRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    const hitArea = document.querySelector('[data-testid="rowgap-hit-1"]')
    expect(hitArea).toBeTruthy()
    await userEvent.click(hitArea!) // 1st click — ghost
    await userEvent.click(hitArea!) // 2nd click — confirm
    const newRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(newRowCount).toBe(initialRowCount + 1)
  })
})

describe('empty row deletion (#192)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('should show trash icon on empty row hover', () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // All rows are empty in minimal flow, row 0 should show row number "1"
    const rowLabel = document.querySelector('[data-testid="canvas-row-0"]')
    expect(rowLabel).toBeTruthy()
    expect(rowLabel!.textContent).toBe('1')
    // Hover the row number hit rect
    const hitRect = document.querySelector('[data-testid="rownum-hit-0"]')
    expect(hitRect).toBeTruthy()
    fireEvent.mouseEnter(hitRect!)
    const updatedEl = document.querySelector('[data-testid="canvas-row-0"]')
    // Trash icon is a <g> element (not <text>), indicating the icon changed
    expect(updatedEl!.tagName.toLowerCase()).toBe('g')
  })

  it('should delete empty row when clicked (after animation delay)', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const initialRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    // Hover then click to delete
    const hitRect = document.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(hitRect)
    fireEvent.click(hitRect)
    // Row still exists during animation
    expect(document.querySelectorAll('[data-testid^="canvas-row-"]').length).toBe(initialRowCount)
    // After animation delay, row is removed
    act(() => {
      vi.advanceTimersByTime(450)
    })
    const newRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(newRowCount).toBe(initialRowCount - 1)
    vi.useRealTimers()
  })

  it('should not delete row with nodes', () => {
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 }],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const initialRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    // Hover row 0 (has a node) — should stay as text
    const hitRect = document.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(hitRect)
    const updatedEl = document.querySelector('[data-testid="canvas-row-0"]')
    expect(updatedEl!.tagName.toLowerCase()).toBe('text')
    // Click — row count should not change
    fireEvent.click(hitRect)
    const newRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(newRowCount).toBe(initialRowCount)
  })

  it('should not delete the last remaining row', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const initialRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    // Delete rows one by one until only 1 left
    for (let i = 0; i < initialRowCount - 1; i++) {
      const hitRect = document.querySelector('[data-testid="rownum-hit-0"]')!
      fireEvent.mouseEnter(hitRect)
      fireEvent.click(hitRect)
      act(() => {
        vi.advanceTimersByTime(450)
      })
    }
    const afterDeleteCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(afterDeleteCount).toBe(1)
    // Try to delete the last row — should not work
    const hitRect = document.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(hitRect)
    // Should show row number, not trash (canDelete is false)
    const updatedEl = document.querySelector('[data-testid="canvas-row-0"]')
    expect(updatedEl!.tagName.toLowerCase()).toBe('text')
    fireEvent.click(hitRect)
    act(() => {
      vi.advanceTimersByTime(450)
    })
    const finalCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(finalCount).toBe(1)
    vi.useRealTimers()
  })

  // --- Row animation tests (#207) ---

  it('should block row insert during animation (rowAnim lock)', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const initialRowCount = document.querySelectorAll('[data-testid^="canvas-row-"]').length

    // First insert (2 clicks for confirm)
    const hitArea = document.querySelector('[data-testid="rowgap-hit-1"]')!
    fireEvent.click(hitArea) // ghost
    fireEvent.click(hitArea) // confirm
    const afterFirstInsert = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(afterFirstInsert).toBe(initialRowCount + 1)

    // Second insert during animation should be blocked (even ghost click is blocked by rowAnim)
    const hitArea2 = document.querySelector('[data-testid="rowgap-hit-0"]')!
    fireEvent.click(hitArea2)
    fireEvent.click(hitArea2)
    const afterSecondInsert = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(afterSecondInsert).toBe(initialRowCount + 1) // No change

    // After animation lock expires, insert works again
    act(() => {
      vi.advanceTimersByTime(700)
    })
    const hitArea3 = document.querySelector('[data-testid="rowgap-hit-0"]')!
    fireEvent.click(hitArea3) // ghost
    fireEvent.click(hitArea3) // confirm
    const afterThirdInsert = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    expect(afterThirdInsert).toBe(initialRowCount + 2)

    vi.useRealTimers()
  })

  it('should block row delete during animation (rowAnim lock)', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert a row to get animation lock (2 clicks)
    const hitArea = document.querySelector('[data-testid="rowgap-hit-1"]')!
    fireEvent.click(hitArea) // ghost
    fireEvent.click(hitArea) // confirm

    // Try to delete during animation — should be blocked
    const deleteHit = document.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(deleteHit)
    fireEvent.click(deleteHit)
    // Advance past delete delay — row should NOT be deleted (was blocked)
    act(() => {
      vi.advanceTimersByTime(450)
    })

    // Advance past add animation lock
    act(() => {
      vi.advanceTimersByTime(250)
    })

    // Now delete should work
    const deleteHit2 = document.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(deleteHit2)
    fireEvent.click(deleteHit2)
    act(() => {
      vi.advanceTimersByTime(450)
    })
    // Verify row was deleted
    const count = document.querySelectorAll('[data-testid^="canvas-row-"]').length
    // Initial 7 + 1 inserted - 1 deleted = 7
    expect(count).toBe(7)

    vi.useRealTimers()
  })

  it('should show add animation overlay on row insert', () => {
    const flow = createMinimalFlow()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert a row (2 clicks)
    const hitArea = container.querySelector('[data-testid="rowgap-hit-1"]')!
    fireEvent.click(hitArea) // ghost
    fireEvent.click(hitArea) // confirm

    // Animation overlay should be present
    const overlay = container.querySelector('[data-testid="row-anim-overlay"]')
    expect(overlay).toBeTruthy()
  })

  it('should show delete animation overlay on row delete', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Delete a row
    const deleteHit = container.querySelector('[data-testid="rownum-hit-0"]')!
    fireEvent.mouseEnter(deleteHit)
    fireEvent.click(deleteHit)

    // Animation overlay should be present
    const overlay = container.querySelector('[data-testid="row-anim-overlay"]')
    expect(overlay).toBeTruthy()

    // After delay, overlay disappears
    act(() => {
      vi.advanceTimersByTime(450)
    })
    const overlayAfter = container.querySelector('[data-testid="row-anim-overlay"]')
    expect(overlayAfter).toBeNull()

    vi.useRealTimers()
  })

  it('should clear add animation overlay after 700ms', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const flow = createMinimalFlow()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert a row (2 clicks)
    const hitArea = container.querySelector('[data-testid="rowgap-hit-1"]')!
    fireEvent.click(hitArea) // ghost
    fireEvent.click(hitArea) // confirm

    expect(container.querySelector('[data-testid="row-anim-overlay"]')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(700)
    })

    expect(container.querySelector('[data-testid="row-anim-overlay"]')).toBeNull()

    vi.useRealTimers()
  })
})

describe('lane gap UI header-only (#91)', () => {
  it('should render lane gap hit area with header-only height', () => {
    const flow = createMinimalFlow()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    // Lane gap hit areas should exist (for 1 lane: 2 gaps, left and right)
    const laneGapHitAreas = container.querySelectorAll('[data-testid^="lanegap-hit-"]')
    expect(laneGapHitAreas.length).toBe(2)
    // Hit area height should be TM + HH (24 + 46 = 70), not HH + rows * RH
    const hitArea = laneGapHitAreas[0]
    const height = hitArea.getAttribute('height')
    expect(Number(height)).toBe(70) // TM + HH = 24 + 46 = 70
  })
})

describe('editorSettings API sync (#89)', () => {
  beforeEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('should load editorSettings from API on mount', async () => {
    mockApiFetch.mockReset()
    const settingsData = {
      settings: {
        copyLabelOnSameRow: true,
        autoConnect: false,
        autoAddRow: true,
        enterEditOnCreate: true,
        showDotGrid: true,
        showOrderBadge: true,
      },
      profile: { name: 'Test User', email: 'test@example.com' },
    }
    mockApiFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(settingsData), 10)
        }),
    )
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    expect(mockApiFetch).toHaveBeenCalledWith('/settings')
    await waitFor(
      () => {
        const checkboxes = screen.getAllByTestId('setting-copyLabelOnSameRow')
        expect(checkboxes[0].getAttribute('aria-checked')).toBe('true')
      },
      { timeout: 3000 },
    )
  })

  it('should use defaults when API fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const checkboxes = screen.getAllByTestId('setting-copyLabelOnSameRow')
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('false')
  })

  it('should save editorSettings to API when toggled', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/settings')
    })
    mockApiFetch.mockClear()

    const checkbox = screen.getByTestId('setting-copyLabelOnSameRow')
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/settings', {
        method: 'PUT',
        body: expect.stringContaining('"copyLabelOnSameRow":true'),
      })
    })
  })
})

describe('Mermaid flowchart TD export (#mermaid)', () => {
  beforeEach(() => {
    cleanup()
  })

  /**
   * Helper: mock navigator.clipboard.writeText and return spy.
   * Each test sets up its own mock for independence.
   */
  const setupClipboardMock = () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    })
    return writeTextSpy
  }

  /**
   * Helper: click "Mermaid コードをコピー" button and return clipboard text.
   * The button is in the right panel (default state, nothing selected).
   */
  const clickMermaidCopyButton = async (writeTextSpy: ReturnType<typeof vi.fn>) => {
    const btns = screen.getAllByText('Mermaid コードをコピー')
    await userEvent.click(btns[0])
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
    return writeTextSpy.mock.calls[0][0] as string
  }

  it('exportMermaid should output flowchart LR with row-based subgraphs and lane labels', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [
        { id: 'lane-1', name: '企画', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: '開発', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: '要件定義', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: '設計', note: null, orderIndex: 1 },
        { id: 'n3', laneId: 'lane-2', rowIndex: 2, label: '実装', note: null, orderIndex: 2 },
      ],
      arrows: [
        { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null },
        { id: 'a2', fromNodeId: 'n2', toNodeId: 'n3', comment: null },
      ],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('%% Flowline')
    expect(mermaid).toContain('flowchart LR')
    expect(mermaid).not.toContain('subgraph 企画')
    expect(mermaid).not.toContain('subgraph 開発')
    expect(mermaid).toContain('要件定義')
    expect(mermaid).toContain('企画')
    expect(mermaid).toContain('実装')
    expect(mermaid).toContain('開発')
    expect(mermaid).toMatch(/n1\[/)
    expect(mermaid).toMatch(/n2\[/)
    expect(mermaid).toMatch(/n3\[/)
    expect(mermaid).toContain('n1 --> n2')
    expect(mermaid).toContain('n2 --> n3')
  })

  it('exportMermaid should group nodes by row in subgraphs', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [
        { id: 'lane-1', name: 'A', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'B', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'ノード1', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-2', rowIndex: 0, label: 'ノード2', note: null, orderIndex: 1 },
        { id: 'n3', laneId: 'lane-1', rowIndex: 1, label: 'ノード3', note: null, orderIndex: 2 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    const lines = mermaid.split('\n')
    const subgraphStarts = lines
      .map((l, i) => ({ line: l.trim(), idx: i }))
      .filter((x) => x.line.startsWith('subgraph'))
    // 2 row subgraphs (row 0 and row 1)
    expect(subgraphStarts.length).toBe(2)
    // n1 and n2 (both row 0) should be in the first subgraph block
    const firstSubgraphStart = subgraphStarts[0].idx
    const firstEndIdx = lines.findIndex((l, i) => i > firstSubgraphStart && l.trim() === 'end')
    const firstBlock = lines.slice(firstSubgraphStart, firstEndIdx + 1).join('\n')
    expect(firstBlock).toContain('n1[')
    expect(firstBlock).toContain('n2[')
    expect(firstBlock).not.toContain('n3[')
    // n3 (row 1) should be in the second subgraph block
    const secondSubgraphStart = subgraphStarts[1].idx
    const secondEndIdx = lines.findIndex((l, i) => i > secondSubgraphStart && l.trim() === 'end')
    const secondBlock = lines.slice(secondSubgraphStart, secondEndIdx + 1).join('\n')
    expect(secondBlock).toContain('n3[')
    expect(secondBlock).not.toContain('n1[')
  })

  it('exportMermaid should include isolated nodes inside row subgraph', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: '孤立ノード', note: null, orderIndex: 0 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('flowchart LR')
    expect(mermaid).toContain('subgraph')
    // Full node format: id["label<br><small>laneName</small>"]
    expect(mermaid).toMatch(/n1\["孤立ノード<br><small>レーン1<\/small>"\]/)
    expect(mermaid).not.toContain('-->')
  })

  it('exportMermaid should escape double quotes in node labels as #quot;', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [
        {
          id: 'n1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'テスト"ラベル"です',
          note: null,
          orderIndex: 0,
        },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    // Full node format with escaped quotes and lane label
    expect(mermaid).toMatch(/n1\["テスト#quot;ラベル#quot;です<br><small>レーン1<\/small>"\]/)
  })

  it('exportMermaid should escape angle brackets in labels to prevent HTML injection', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'step <1>', note: null, orderIndex: 0 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    // Angle brackets in user content should be escaped
    expect(mermaid).toContain('&lt;')
    expect(mermaid).toContain('&gt;')
    expect(mermaid).not.toContain('step <1>')
  })

  it('exportMermaid should output arrow comments with -->|comment| format', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: '承認後' }],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('-->|承認後|')
  })

  it('exportMermaid should output only flowchart LR without error when flow has no nodes', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('flowchart LR')
    expect(mermaid).not.toContain('-->')
    expect(typeof mermaid).toBe('string')
    expect(mermaid.length).toBeGreaterThan(0)
  })

  it('exportMermaid should escape brackets and pipe characters in labels', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 }],
      nodes: [
        {
          id: 'n1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'テスト[注釈]',
          note: null,
          orderIndex: 0,
        },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('#lsqb;')
    expect(mermaid).toContain('#rsqb;')
    expect(mermaid).not.toContain('[注釈]')
  })

  it('exportMermaid should escape pipe characters in arrow comments', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [
        { id: 'lane-1', name: 'A', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'B', colorIndex: 1, position: 1 },
      ],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'ノード1', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-2', rowIndex: 1, label: 'ノード2', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: 'A|B選択' }],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)
    expect(mermaid).toContain('#vert;')
    expect(mermaid).toContain('A#vert;B選択')
  })

  it('exportMermaid should sort nodes within same row by lane position', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [
        { id: 'lane-1', name: 'レーンA', colorIndex: 0, position: 0 },
        { id: 'lane-2', name: 'レーンB', colorIndex: 1, position: 1 },
        { id: 'lane-3', name: 'レーンC', colorIndex: 2, position: 2 },
      ],
      nodes: [
        // Deliberately out of lane-position order
        { id: 'n1', laneId: 'lane-3', rowIndex: 0, label: 'C', note: null, orderIndex: 2 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n3', laneId: 'lane-2', rowIndex: 0, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const mermaid = await clickMermaidCopyButton(writeTextSpy)

    // All 3 nodes should be in the same subgraph (same row)
    const lines = mermaid.split('\n')
    const subgraphStart = lines.findIndex((l) => l.trim().startsWith('subgraph'))
    const endIdx = lines.findIndex((l, i) => i > subgraphStart && l.trim() === 'end')
    const block = lines.slice(subgraphStart, endIdx + 1).join('\n')

    // Nodes should appear sorted by lane position: A (lane0), B (lane1), C (lane2)
    const posA = block.indexOf('A<br><small>レーンA</small>')
    const posB = block.indexOf('B<br><small>レーンB</small>')
    const posC = block.indexOf('C<br><small>レーンC</small>')
    expect(posA).toBeLessThan(posB)
    expect(posB).toBeLessThan(posC)
  })

  it('should show "✓ コピーしました" after successful Mermaid copy', async () => {
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'A', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'ノード', note: null, orderIndex: 0 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const btn = screen.getByText('Mermaid コードをコピー')
    await userEvent.click(btn)
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
    expect(screen.getByText('✓ コピーしました')).toBeInTheDocument()
  })

  it('should revert Mermaid copy button label after 1.5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const writeTextSpy = setupClipboardMock()
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'A', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'ノード', note: null, orderIndex: 0 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const btn = screen.getByText('Mermaid コードをコピー')
    await userEvent.click(btn)
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
    expect(screen.getByText('✓ コピーしました')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByText('Mermaid コードをコピー')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('should not change label when clipboard.writeText fails', async () => {
    const writeTextSpy = vi.fn().mockRejectedValue(new Error('clipboard error'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    })
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [{ id: 'lane-1', name: 'A', colorIndex: 0, position: 0 }],
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'ノード', note: null, orderIndex: 0 },
      ],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const btn = screen.getByText('Mermaid コードをコピー')
    await userEvent.click(btn)
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
    // Label should remain unchanged on failure
    expect(screen.getByText('Mermaid コードをコピー')).toBeInTheDocument()
    expect(screen.queryByText('✓ コピーしました')).not.toBeInTheDocument()
  })
})

describe('auto-connect by flow position (#182)', () => {
  it('should auto-connect from closest upstream node by position, not creation order', () => {
    // A(row0, lane-1) and B(row2, lane-1) exist. Creating C at (row1, lane-1).
    // Closest upstream to C is A(row0), not B(row2) which is downstream.
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 2, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Find an empty cell rect at row1 (y = TM + HH + 1 * RH = 24 + 46 + 84 = 154)
    // Empty cells have fill="transparent" and cursor="crosshair"
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    // Find the rect at y=154 (row 1)
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '154')
    expect(targetRect).toBeTruthy()
    fireEvent.click(targetRect!) // 1st click — ghost
    fireEvent.click(targetRect!) // 2nd click — confirm

    // After clicking, an arrow should be created from A → C (closest upstream)
    // Check that an arrow path with marker-end exists
    const arrowPaths = container.querySelectorAll('path[marker-end]')
    expect(arrowPaths.length).toBeGreaterThanOrEqual(1)
  })

  it('should not auto-connect when new node has no upstream nodes', () => {
    // B exists only at row2. Creating node at row0 → no upstream.
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 2, label: 'B', note: null, orderIndex: 0 }],
      arrows: [],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Find empty cell at row0 (y = TM + HH + 0 * RH = 24 + 46 = 70)
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
    expect(targetRect).toBeTruthy()
    fireEvent.click(targetRect!) // 1st click — ghost
    fireEvent.click(targetRect!) // 2nd click — confirm

    // No arrows should be created (B is below, not upstream)
    const arrowPaths = container.querySelectorAll('path[marker-end]')
    expect(arrowPaths.length).toBe(0)
  })
})

describe('arrow reorganization toast (#182)', () => {
  it('should show confirm toast when node added to inserted row with crossing arrows', async () => {
    // A(row0) → B(row1) connected, insert row between them
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert row at index 1 (between row0 and row1) — 2 clicks
    const rowGapHit = container.querySelector('[data-testid="rowgap-hit-1"]')
    expect(rowGapHit).toBeTruthy()
    fireEvent.click(rowGapHit!) // ghost
    fireEvent.click(rowGapHit!) // confirm

    // After insertion, rows: [row0(A), newRow(empty), row1(B)]
    // The new empty cell at ri=1 will have y = 24 + 46 + 1*84 = 154
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '154')
    expect(targetRect).toBeTruthy()
    fireEvent.click(targetRect!) // ghost
    fireEvent.click(targetRect!) // confirm

    // Confirm toast should appear
    await waitFor(() => {
      expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    })
    // Should have skip and organize buttons
    expect(container.querySelector('[data-testid="toast-skip-btn"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="toast-organize-btn"]')).toBeTruthy()
  })

  it('should reorganize arrows when "整理する" button is clicked', async () => {
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert row and click cell — both need 2 clicks
    const rowGapHit = container.querySelector('[data-testid="rowgap-hit-1"]')
    fireEvent.click(rowGapHit!) // ghost
    fireEvent.click(rowGapHit!) // confirm
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '154')
    fireEvent.click(targetRect!) // ghost
    fireEvent.click(targetRect!) // confirm

    await waitFor(() => {
      expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    })

    // Click "整理する"
    const organizeBtn = container.querySelector('[data-testid="toast-organize-btn"]')
    expect(organizeBtn).toBeTruthy()
    fireEvent.click(organizeBtn!)

    // Success toast should appear
    await waitFor(() => {
      expect(container.querySelector('[data-testid="toast-success"]')).toBeTruthy()
    })
    // Confirm toast should be dismissed
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeNull()
  })

  it('should dismiss toast when "スキップ" button is clicked', async () => {
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert row and click cell — both need 2 clicks
    const rowGapHit = container.querySelector('[data-testid="rowgap-hit-1"]')
    fireEvent.click(rowGapHit!) // ghost
    fireEvent.click(rowGapHit!) // confirm
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '154')
    fireEvent.click(targetRect!) // ghost
    fireEvent.click(targetRect!) // confirm

    await waitFor(() => {
      expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    })

    // Click "スキップ"
    const skipBtn = container.querySelector('[data-testid="toast-skip-btn"]')
    fireEvent.click(skipBtn!)

    // Toast should be dismissed
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeNull()
    expect(container.querySelector('[data-testid="toast-success"]')).toBeNull()
  })

  it('should not show toast when no crossing arrows exist', async () => {
    // A(row0) → B(row1), insert row AFTER both (at index 2)
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }],
    }
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Insert row at index 2 (after both nodes) — 2 clicks
    const rowGapHit = container.querySelector('[data-testid="rowgap-hit-2"]')
    expect(rowGapHit).toBeTruthy()
    fireEvent.click(rowGapHit!) // ghost
    fireEvent.click(rowGapHit!) // confirm

    // Click cell at new row (ri=2, y = 24 + 46 + 2*84 = 238) — 2 clicks
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const emptyCellRects = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '238')
    expect(targetRect).toBeTruthy()
    fireEvent.click(targetRect!) // ghost
    fireEvent.click(targetRect!) // confirm

    // No toast should appear
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeNull()
  })
})

describe('z-order: arrow controls above row gap (#212)', () => {
  it('should render arrow hit paths after row gap hit zones in SVG DOM order', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    const allElements = Array.from(container.querySelectorAll('*'))

    const rowGapIndices = allElements
      .map((el, i) => (el.getAttribute('data-testid')?.startsWith('rowgap-hit-') ? i : -1))
      .filter((i) => i !== -1)
    expect(rowGapIndices.length).toBeGreaterThan(0)
    const lastRowGapIndex = Math.max(...rowGapIndices)

    // Arrow hit path: transparent stroke-width=20 path
    const arrowHitIndex = allElements.findIndex(
      (el) =>
        el.tagName === 'path' &&
        el.getAttribute('pointer-events') === 'stroke' &&
        el.getAttribute('stroke-width') === '20',
    )
    expect(arrowHitIndex).not.toBe(-1)

    // Arrow hit paths should come AFTER row gaps = higher z-order, so arrow clicks win
    expect(arrowHitIndex).toBeGreaterThan(lastRowGapIndex)
  })

  it('should render arrow floating controls after row gap hit zones in SVG DOM order', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
    ]
    flow.arrows = [{ id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null }]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Click arrow to show floating controls
    const arrowHit = container.querySelector('path[pointer-events="stroke"][stroke-width="20"]')
    expect(arrowHit).toBeTruthy()
    fireEvent.click(arrowHit!)

    const controls = container.querySelector('[data-testid="arrow-floating-controls"]')
    expect(controls).toBeTruthy()

    // Check DOM order within the full container (jsdom doesn't fully parse SVG children via svg.querySelectorAll)
    const allElements = Array.from(container.querySelectorAll('*'))

    const rowGapIndices = allElements
      .map((el, i) => (el.getAttribute('data-testid')?.startsWith('rowgap-hit-') ? i : -1))
      .filter((i) => i !== -1)
    expect(rowGapIndices.length).toBeGreaterThan(0)
    const lastRowGapIndex = Math.max(...rowGapIndices)

    const controlsIndex = allElements.findIndex(
      (el) => el.getAttribute('data-testid') === 'arrow-floating-controls',
    )
    expect(controlsIndex).not.toBe(-1)

    // Floating controls should come AFTER row gaps in DOM = higher z-order in SVG
    expect(controlsIndex).toBeGreaterThan(lastRowGapIndex)
  })

  it('should render connection handles after row gap hit zones in SVG DOM order', () => {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
    ]
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    // Click node rect to select it and show connection handles
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    expect(nodeRect).toBeTruthy()
    fireEvent.click(nodeRect!)

    const handles = container.querySelectorAll('[data-testid="connection-handle"]')
    expect(handles.length).toBeGreaterThan(0)

    // Check DOM order within the full container (jsdom doesn't fully parse SVG children via svg.querySelectorAll)
    const allElements = Array.from(container.querySelectorAll('*'))

    const rowGapIndices = allElements
      .map((el, i) => (el.getAttribute('data-testid')?.startsWith('rowgap-hit-') ? i : -1))
      .filter((i) => i !== -1)
    expect(rowGapIndices.length).toBeGreaterThan(0)
    const lastRowGapIndex = Math.max(...rowGapIndices)

    const handleIndex = allElements.findIndex(
      (el) => el.getAttribute('data-testid') === 'connection-handle',
    )
    expect(handleIndex).not.toBe(-1)

    expect(handleIndex).toBeGreaterThan(lastRowGapIndex)
  })
})

describe('2-click confirm UX (#219)', () => {
  beforeEach(() => {
    cleanup()
  })

  describe('node ghost (empty cell 2-click)', () => {
    it('should show ghost node on first click and create node on second click', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      // Find an empty cell rect at row 0 (y = TM + HH + 0 * RH = 24 + 46 = 70)
      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      expect(targetRect).toBeTruthy()

      // 1st click — should show ghost (dashed rect with "作業" and "クリックで確定")
      fireEvent.click(targetRect!)

      // Ghost should be visible
      const ghostTexts = Array.from(container.querySelectorAll('text')).filter(
        (t) => t.textContent === 'クリックで確定',
      )
      expect(ghostTexts.length).toBeGreaterThanOrEqual(1)

      // Node should NOT exist yet (no rect with width=152)
      const nodeRects = Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
        (r) => r.getAttribute('width') === '152',
      )
      expect(nodeRects.length).toBe(0)

      // 2nd click on same element — should create node (same DOM element, no mouseLeave)
      fireEvent.click(targetRect!)

      // Node should now exist
      const nodeRectsAfter = Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
        (r) => r.getAttribute('width') === '152',
      )
      expect(nodeRectsAfter.length).toBe(1)
    })

    it('should cancel ghost when Escape is pressed', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      fireEvent.click(targetRect!)

      // Ghost should be visible
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' })

      // Ghost should be gone
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)
    })

    it('should cancel ghost when background (SVG) is clicked', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      fireEvent.click(targetRect!)

      // Ghost should be visible
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Click SVG background
      const svg = container.querySelector('[data-testid="canvas-svg"]')
      fireEvent.click(svg!)

      // Ghost should be gone
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)
    })

    it('should cancel ghost when mouse leaves the cell', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      fireEvent.click(targetRect!)

      // Ghost should be visible
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Mouse leave the cell
      fireEvent.mouseLeave(targetRect!)

      // Ghost should be gone
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)
    })

    it('should move ghost when clicking a different empty cell', () => {
      const flow: Flow = {
        ...createMinimalFlow(),
        lanes: [
          { id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 },
          { id: 'lane-2', name: 'レーン2', colorIndex: 1, position: 1 },
        ],
      }
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      // Find empty cells — we want two at different rows
      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const cell1 = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      expect(cell1).toBeTruthy()
      // Pick a different cell at row 1 (y=154) — use same lane for simplicity
      const cell2 = emptyCellRects.find((r) => r.getAttribute('y') === '154' && r !== cell1)
      expect(cell2).toBeTruthy()

      // Click cell 1 — ghost appears
      fireEvent.click(cell1!)
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Mouse leaves cell 1 — ghost cancels (matches real browser behavior)
      fireEvent.mouseLeave(cell1!)
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)

      // Click cell 2 — new ghost appears at cell 2, NOT creating a node
      fireEvent.click(cell2!)
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Node should NOT exist
      const nodeRects = Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
        (r) => r.getAttribute('width') === '152',
      )
      expect(nodeRects.length).toBe(0)
    })
  })

  describe('row ghost (row gap 2-click)', () => {
    it('should show ghost row on first click and insert row on second click', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
      const initialRowCount = container.querySelectorAll('[data-testid^="canvas-row-"]').length

      // 1st click on row gap
      const hitArea = container.querySelector('[data-testid="rowgap-hit-1"]')
      expect(hitArea).toBeTruthy()
      fireEvent.click(hitArea!)

      // Row count should NOT change yet
      expect(container.querySelectorAll('[data-testid^="canvas-row-"]').length).toBe(
        initialRowCount,
      )

      // Ghost should be visible (dashed line with "クリックで確定" text)
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // 2nd click on same row gap
      const hitArea2 = container.querySelector('[data-testid="rowgap-hit-1"]')
      fireEvent.click(hitArea2!)

      // Row should now be inserted
      expect(container.querySelectorAll('[data-testid^="canvas-row-"]').length).toBe(
        initialRowCount + 1,
      )
    })

    it('should cancel ghost row when Escape is pressed', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const hitArea = container.querySelector('[data-testid="rowgap-hit-1"]')
      fireEvent.click(hitArea!)

      // Ghost should be visible
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' })

      // Ghost should be gone
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)
    })

    it('should cancel ghost row when mouse leaves the row gap', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      const hitArea = container.querySelector('[data-testid="rowgap-hit-1"]')
      fireEvent.click(hitArea!)

      // Ghost should be visible
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(true)

      // Mouse leave
      fireEvent.mouseLeave(hitArea!)

      // Ghost should be gone
      expect(
        Array.from(container.querySelectorAll('text')).some(
          (t) => t.textContent === 'クリックで確定',
        ),
      ).toBe(false)
    })
  })

  describe('bounce animation on node creation', () => {
    it('should apply bounce class to newly confirmed node', () => {
      const flow = createMinimalFlow()
      const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

      // Find empty cell at row 0
      const allRects = container.querySelectorAll('rect[fill="transparent"]')
      const emptyCellRects = Array.from(allRects).filter(
        (r) => (r as SVGRectElement).style.cursor === 'crosshair',
      )
      const targetRect = emptyCellRects.find((r) => r.getAttribute('y') === '70')
      expect(targetRect).toBeTruthy()

      // 1st click — ghost, 2nd click — confirm (same element reference)
      fireEvent.click(targetRect!)
      fireEvent.click(targetRect!)

      // Node should exist and its parent <g> should have bounce class
      const nodeGroups = Array.from(container.querySelectorAll('g')).filter((g) =>
        g.classList.toString().includes('ghostBounceAnim'),
      )
      expect(nodeGroups.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('demo mode props (#225)', () => {
    it('should render saveCtaLabel button instead of save status when provided', () => {
      const flow = createMinimalFlow()
      const onSaveCtaClick = vi.fn()
      render(
        <FlowEditor
          flow={flow}
          onSave={vi.fn()}
          saveStatus="saved"
          saveCtaLabel="ログインして保存"
          onSaveCtaClick={onSaveCtaClick}
        />,
      )
      const ctaButton = screen.getByTestId('save-cta-button')
      expect(ctaButton.textContent).toBe('ログインして保存')
    })

    it('should call onSaveCtaClick when CTA button is clicked', async () => {
      const flow = createMinimalFlow()
      const onSaveCtaClick = vi.fn()
      const user = userEvent.setup()
      render(
        <FlowEditor
          flow={flow}
          onSave={vi.fn()}
          saveStatus="saved"
          saveCtaLabel="ログインして保存"
          onSaveCtaClick={onSaveCtaClick}
        />,
      )
      const ctaButton = screen.getByTestId('save-cta-button')
      await user.click(ctaButton)
      expect(onSaveCtaClick).toHaveBeenCalledOnce()
    })

    it('should hide share button when hideShare is true', () => {
      const flow = createMinimalFlow()
      render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" hideShare={true} />)
      expect(screen.queryByTestId('share-button')).toBeNull()
    })

    it('should show share button by default (hideShare undefined)', () => {
      const flow = createMinimalFlow()
      render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
      expect(screen.getByTestId('share-button')).toBeTruthy()
    })

    it('should show normal save status when saveCtaLabel is not provided', () => {
      const flow = createMinimalFlow()
      render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
      expect(screen.getByTestId('save-status')).toBeTruthy()
      expect(screen.queryByTestId('save-cta-button')).toBeNull()
    })
  })
})

describe('JSON export (#235)', () => {
  beforeEach(() => {
    cleanup()
  })

  // Save originals for restoration
  let origCreateElement: typeof document.createElement
  let origCreateObjectURL: typeof URL.createObjectURL
  let origRevokeObjectURL: typeof URL.revokeObjectURL
  let origBlob: typeof Blob

  beforeEach(() => {
    origCreateElement = document.createElement.bind(document)
    origCreateObjectURL = URL.createObjectURL
    origRevokeObjectURL = URL.revokeObjectURL
    origBlob = globalThis.Blob
  })

  afterEach(() => {
    // Restore mocks to not leak between tests
    URL.createObjectURL = origCreateObjectURL
    URL.revokeObjectURL = origRevokeObjectURL
    globalThis.Blob = origBlob
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Helper: mock download infrastructure (createElement('a'), URL).
   * Must be called AFTER render() to avoid breaking React's internal createElement calls.
   * Returns spies to assert on.
   */
  const setupDownloadMock = () => {
    const clickSpy = vi.fn()
    let capturedHref = ''
    let capturedDownload = ''
    let capturedBlobText = ''

    URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      // Read the blob text synchronously via the Blob constructor argument
      // We intercept at createElement('a') level and also capture from Blob
      blob.text().then((t) => {
        capturedBlobText = t
      })
      return 'blob:mock-url'
    })
    URL.revokeObjectURL = vi.fn()

    // Intercept Blob constructor to capture content synchronously
    const OrigBlob = globalThis.Blob
    globalThis.Blob = class MockBlob extends OrigBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options)
        if (parts && parts.length > 0 && typeof parts[0] === 'string') {
          capturedBlobText = parts[0]
        }
      }
    } as typeof Blob

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = origCreateElement('a')
        // Override click to prevent navigation and capture values
        el.click = clickSpy
        // Intercept property assignments
        const origHrefDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href')
        const origDownloadDesc = Object.getOwnPropertyDescriptor(
          HTMLAnchorElement.prototype,
          'download',
        )
        Object.defineProperty(el, 'href', {
          get() {
            return origHrefDesc?.get?.call(this) ?? capturedHref
          },
          set(v: string) {
            capturedHref = v
            origHrefDesc?.set?.call(this, v)
          },
        })
        Object.defineProperty(el, 'download', {
          get() {
            return origDownloadDesc?.get?.call(this) ?? capturedDownload
          },
          set(v: string) {
            capturedDownload = v
            origDownloadDesc?.set?.call(this, v)
          },
        })
        return el
      }
      return origCreateElement(tag)
    })

    return {
      clickSpy,
      getCapturedBlobText: () => capturedBlobText,
      getCapturedHref: () => capturedHref,
      getCapturedDownload: () => capturedDownload,
      restoreBlob: () => {
        globalThis.Blob = OrigBlob
      },
    }
  }

  const clickJSONDownloadButton = async () => {
    const btn = screen.getByText('JSON をダウンロード')
    await userEvent.click(btn)
  }

  it('should render JSON download button in export panel', () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    expect(screen.getByText('JSON をダウンロード')).toBeInTheDocument()
  })

  it('should export valid JSON with meta, flow, and recentActions fields', async () => {
    const flow: Flow = {
      ...createMinimalFlow(),
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
      ],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const { clickSpy, getCapturedBlobText } = setupDownloadMock()
    await clickJSONDownloadButton()

    expect(clickSpy).toHaveBeenCalled()
    const text = getCapturedBlobText()
    const data = JSON.parse(text)

    // meta fields
    expect(data.meta).toBeDefined()
    expect(data.meta.exportedAt).toBeDefined()
    expect(typeof data.meta.appVersion).toBe('string')
    expect(typeof data.meta.gitHash).toBe('string')
    expect(typeof data.meta.url).toBe('string')

    // flow fields
    expect(data.flow).toBeDefined()
    expect(data.flow.title).toBe('Test Flow')
    expect(data.flow.themeId).toBe('cloud')
    expect(data.flow.lanes).toHaveLength(1)
    // flowToInternalState creates at least 7 rows (max(6, maxRowIndex) + 2)
    expect(data.flow.rows.length).toBeGreaterThanOrEqual(7)
    expect(data.flow.order).toHaveLength(1)

    // recentActions
    expect(data.recentActions).toBeDefined()
    expect(Array.isArray(data.recentActions)).toBe(true)
  })

  it('should export empty flow without errors', async () => {
    const flow: Flow = {
      ...createMinimalFlow(),
      lanes: [],
      nodes: [],
      arrows: [],
    }
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const { clickSpy, getCapturedBlobText } = setupDownloadMock()
    await clickJSONDownloadButton()

    expect(clickSpy).toHaveBeenCalled()
    const text = getCapturedBlobText()
    const data = JSON.parse(text)
    expect(data.flow.lanes).toEqual([])
    expect(data.flow.tasks).toEqual({})
    expect(data.flow.arrows).toEqual([])
    expect(data.flow.notes).toEqual({})
    expect(data.flow.order).toEqual([])
    expect(data.recentActions).toEqual([])
  })

  it('should show feedback text after download', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    setupDownloadMock()
    await clickJSONDownloadButton()
    expect(screen.getByText('✓ ダウンロードしました')).toBeInTheDocument()
  })

  it('should revert download button label after 1.5 seconds', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    setupDownloadMock()
    // Enable fake timers after render to avoid blocking useEffect timers
    vi.useFakeTimers()
    const btn = screen.getByText('JSON をダウンロード')
    // Use fireEvent instead of userEvent to avoid async timer conflicts
    fireEvent.click(btn)
    expect(screen.getByText('✓ ダウンロードしました')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByText('JSON をダウンロード')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('should have empty recentActions when no edits made', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const { getCapturedBlobText } = setupDownloadMock()
    await clickJSONDownloadButton()
    const data = JSON.parse(getCapturedBlobText())
    expect(data.recentActions).toEqual([])
  })

  it('should call URL.revokeObjectURL after download', async () => {
    vi.useFakeTimers()
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    setupDownloadMock()
    fireEvent.click(screen.getByText('JSON をダウンロード'))
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    vi.useRealTimers()
  })

  it('should generate filename with sanitized title', async () => {
    const flow = createMinimalFlow()
    render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    const { getCapturedDownload } = setupDownloadMock()
    await clickJSONDownloadButton()
    const filename = getCapturedDownload()
    expect(filename).toMatch(/^flowline-.*\.json$/)
    expect(filename).toContain('Test')
  })
})
