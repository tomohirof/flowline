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
    expect(hero.textContent).toContain('Flowline で作成')
  })

  it('should not render author row when authorName is not provided', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).not.toContain('で作成')
  })

  it('should display meta info with lane and node counts', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).toContain('1 レーン')
    expect(hero.textContent).toContain('1 ノード')
  })

  it('should render brand logo in footer', () => {
    render(<SharedFlowViewer flow={mockFlow} />)
    const footer = screen.getByTestId('shared-flow-footer')
    expect(footer.textContent).toContain('Flowline')
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
})
