// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Flow } from '../features/editor/types'
import { DevRenderPage } from './DevRenderPage'

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

const makeFlow = (id: string, title: string): Flow => ({
  id,
  title,
  themeId: 'cloud',
  shareToken: null,
  projectId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task', note: null, orderIndex: 0 },
  ],
  arrows: [],
})

const fixtures: Record<string, Flow> = {
  simple: makeFlow('flow-simple', 'Simple Fixture'),
  dense: makeFlow('flow-dense', 'Dense Fixture'),
}

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/dev/render${search}`]}>
      <DevRenderPage fixtures={fixtures} />
    </MemoryRouter>,
  )

describe('DevRenderPage', () => {
  beforeEach(() => {
    document.title = ''
  })

  it('lists available fixtures when no fixture query param is provided', () => {
    renderAt('')
    const list = screen.getByTestId('dev-fixture-list')
    expect(list).not.toBeNull()
    expect(list.textContent).toContain('simple')
    expect(list.textContent).toContain('dense')
  })

  it('renders SharedFlowViewer with the selected fixture', () => {
    renderAt('?fixture=simple')
    const hero = screen.getByTestId('shared-title-hero')
    expect(hero.textContent).toContain('Simple Fixture')
  })

  it('shows error UI when fixture name is unknown', () => {
    renderAt('?fixture=does-not-exist')
    const err = screen.getByTestId('dev-fixture-error')
    expect(err.textContent).toContain('does-not-exist')
  })
})
