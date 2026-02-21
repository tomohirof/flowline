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
