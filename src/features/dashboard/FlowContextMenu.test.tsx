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
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  }

  it('should render all menu items', () => {
    render(<FlowContextMenu {...defaultProps} />)

    expect(screen.getByText('open')).toBeInTheDocument()
    expect(screen.getByText('action.rename')).toBeInTheDocument()
    expect(screen.getByText('delete')).toBeInTheDocument()
  })

  it('should call onOpen when "open" is clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<FlowContextMenu {...defaultProps} onOpen={onOpen} />)

    await user.click(screen.getByText('open'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('should call onRename when "action.rename" is clicked', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    render(<FlowContextMenu {...defaultProps} onRename={onRename} />)

    await user.click(screen.getByText('action.rename'))
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('should call onDelete when "delete" is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<FlowContextMenu {...defaultProps} onDelete={onDelete} />)

    await user.click(screen.getByText('delete'))
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
    expect(buttons.length).toBe(4)
  })

  it('should render "action.duplicate" menu item', () => {
    render(<FlowContextMenu {...defaultProps} />)
    expect(screen.getByText('action.duplicate')).toBeInTheDocument()
  })

  it('should call onDuplicate when "action.duplicate" is clicked', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()
    render(<FlowContextMenu {...defaultProps} onDuplicate={onDuplicate} />)
    await user.click(screen.getByText('action.duplicate'))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
  })

  it('should render menu items in correct order: open, rename, duplicate, separator, delete', () => {
    render(<FlowContextMenu {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0]).toHaveTextContent('open')
    expect(buttons[1]).toHaveTextContent('action.rename')
    expect(buttons[2]).toHaveTextContent('action.duplicate')
    expect(buttons[3]).toHaveTextContent('delete')
  })
})
