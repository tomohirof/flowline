// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FlowEditor from './FlowEditor'
import type { Flow } from './types'

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
