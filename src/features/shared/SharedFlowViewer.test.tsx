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
  lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task 1', note: null, orderIndex: 0 },
  ],
  arrows: [],
}

describe('SharedFlowViewer', () => {
  it('should have position relative on .root for overlay stacking', () => {
    const css = readFileSync(resolve(__dirname, './SharedFlowViewer.module.css'), 'utf-8')
    const rootMatch = css.match(/\.root\s*\{[^}]*\}/s)
    expect(rootMatch).not.toBeNull()
    expect(rootMatch![0]).toMatch(/position:\s*relative/)
  })

  it('should not render viewModeBadge', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    expect(screen.queryByText('閲覧モード')).toBeNull()
  })

  it('should not render flow title in titleBar', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const titleBar = document.querySelector('[class*="titleBar"]')
    expect(titleBar).not.toBeNull()
    const flowTitleInBar = titleBar!.querySelector('[class*="flowTitle"]')
    expect(flowTitleInBar).toBeNull()
  })

  it('should render flow title in SVG', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const svg = document.querySelector('svg')
    expect(svg).not.toBeNull()
    const titleTexts = svg!.querySelectorAll('text')
    const titleText = Array.from(titleTexts).find((t) => t.textContent === 'テストフロー')
    expect(titleText).not.toBeNull()
  })

  it('should render zoom controls in footer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    expect(footer.querySelector('button')).not.toBeNull()
    expect(footer.textContent).toContain('100%')
  })

  it('should render SVG title text even when title is empty string', () => {
    const emptyTitleFlow = { ...mockFlow, title: '' }
    render(<SharedFlowViewer flow={emptyTitleFlow} />)
    const svg = document.querySelector('svg')
    expect(svg).not.toBeNull()
    // SVG <text> element should exist even with empty title
    const titleTexts = svg!.querySelectorAll('text')
    const emptyTitle = Array.from(titleTexts).find((t) => t.textContent === '')
    expect(emptyTitle).not.toBeNull()
  })

  it('should render brand logo in footer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    expect(footer.textContent).toContain('Flowline')
  })
})
