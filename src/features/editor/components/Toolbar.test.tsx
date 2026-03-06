// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { Toolbar } from './Toolbar'

const defaultTheme = {
  toolbarBg: '#fff',
  toolbarBorder: '#e8e6f0',
  toolbarShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

const renderInSvg = (ui: React.ReactElement) => render(<svg>{ui}</svg>)

afterEach(() => cleanup())

describe('Toolbar', () => {
  it('should render all items', () => {
    const onAction = vi.fn()
    renderInSvg(
      <Toolbar
        x={100}
        y={50}
        items={[
          { icon: 'A', action: 'act-a', color: '#000', hoverBg: '#eee' },
          { icon: 'B', action: 'act-b', color: '#000', hoverBg: '#eee' },
        ]}
        onAction={onAction}
        theme={defaultTheme}
      />,
    )
    expect(screen.getByTestId('toolbar-pill')).toBeInTheDocument()
    expect(screen.getAllByTestId('toolbar-btn')).toHaveLength(2)
  })

  it('should call onAction with correct action string on click', () => {
    const onAction = vi.fn()
    renderInSvg(
      <Toolbar
        x={100}
        y={50}
        items={[
          { icon: 'A', action: 'delete', color: '#E06060', hoverBg: '#FEE' },
        ]}
        onAction={onAction}
        theme={defaultTheme}
      />,
    )
    fireEvent.click(screen.getByTestId('toolbar-btn'))
    expect(onAction).toHaveBeenCalledWith('delete')
  })

  it('should not render when items array is empty', () => {
    renderInSvg(
      <Toolbar
        x={0}
        y={0}
        items={[]}
        onAction={vi.fn()}
        theme={defaultTheme}
      />,
    )
    expect(screen.queryByTestId('toolbar-pill')).not.toBeInTheDocument()
  })
})
