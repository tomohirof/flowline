// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SharedFlowViewer } from './SharedFlowViewer'
import type { Flow } from '../editor/types'

const mockFlow: Flow = {
  id: 'flow-1',
  title: 'Test Flow',
  themeId: 'cloud',
  shareToken: 'token-abc',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task 1', note: null, orderIndex: 0 },
  ],
  arrows: [],
}

describe('SharedFlowViewer', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    cleanup()
  })

  it('SharedFlowViewer.module.css .root should have position relative for overlay stacking', () => {
    const fs = require('fs')
    const path = require('path')
    const css = fs.readFileSync(path.resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const rootMatch = css.match(/\.root\s*\{[^}]*\}/s)
    expect(rootMatch).not.toBeNull()
    const rootBlock = rootMatch![0]
    expect(rootBlock).toMatch(/position:\s*relative/)
  })
})
