// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlowEditor from './FlowEditor'
import type { Flow } from './types'
import { NODE_COLORS, NODE_COLORS_DARK, LINE_COLORS, STROKE_STYLES } from './theme-constants'

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
    expect(logoLink.textContent).toContain('F')
    expect(logoLink.textContent).toContain('Flowline')
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
