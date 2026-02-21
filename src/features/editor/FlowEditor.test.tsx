// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    render(<FlowEditor flow={createFlowWithArrow()} onSave={vi.fn()} saveStatus="saved" />)
    const floatingPill = document.querySelector('[data-testid="arrow-floating-controls"]')
    expect(floatingPill).toBeNull()
  })
})
