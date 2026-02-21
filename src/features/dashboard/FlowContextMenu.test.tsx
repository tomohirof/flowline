// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowContextMenu } from './FlowContextMenu'

describe('FlowContextMenu', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    x: 100,
    y: 200,
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  }

  it('should render all menu items', () => {
    render(<FlowContextMenu {...defaultProps} />)

    expect(screen.getByText('開く')).toBeInTheDocument()
    expect(screen.getByText('名前を変更')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('should call onOpen when "開く" is clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<FlowContextMenu {...defaultProps} onOpen={onOpen} />)

    await user.click(screen.getByText('開く'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('should call onRename when "名前を変更" is clicked', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    render(<FlowContextMenu {...defaultProps} onRename={onRename} />)

    await user.click(screen.getByText('名前を変更'))
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('should call onDelete when "削除" is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<FlowContextMenu {...defaultProps} onDelete={onDelete} />)

    await user.click(screen.getByText('削除'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('should be positioned at x, y coordinates', () => {
    render(<FlowContextMenu {...defaultProps} x={150} y={250} />)

    const menu = screen.getByTestId('context-menu')
    expect(menu.style.left).toBe('150px')
    expect(menu.style.top).toBe('250px')
  })

  it('should have data-testid context-menu', () => {
    render(<FlowContextMenu {...defaultProps} />)
    expect(screen.getByTestId('context-menu')).toBeInTheDocument()
  })

  it('should render menu items as accessible buttons', () => {
    render(<FlowContextMenu {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(3)
  })
})
