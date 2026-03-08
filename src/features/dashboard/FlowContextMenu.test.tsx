// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowContextMenu } from './FlowContextMenu'

const defaultProps = {
  x: 100,
  y: 100,
  onOpen: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
}

describe('FlowContextMenu', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('should render basic menu items', () => {
    render(<FlowContextMenu {...defaultProps} />)

    expect(screen.getByText('open')).toBeInTheDocument()
    expect(screen.getByText('action.rename')).toBeInTheDocument()
    expect(screen.getByText('action.duplicate')).toBeInTheDocument()
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

  it('should not show move-to-project when projects prop is not provided', () => {
    render(<FlowContextMenu {...defaultProps} />)
    expect(screen.queryByText('sidebar.moveToProject')).not.toBeInTheDocument()
  })

  it('should show move-to-project when projects prop is provided', () => {
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={vi.fn()}
        currentProjectId={null}
      />,
    )
    expect(screen.getByText('sidebar.moveToProject')).toBeInTheDocument()
  })

  it('should show project submenu when move-to-project is clicked', async () => {
    const user = userEvent.setup()
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'p2',
        name: 'プロジェクトB',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={vi.fn()}
        currentProjectId={null}
      />,
    )
    await user.click(screen.getByText('sidebar.moveToProject'))
    expect(screen.getByText('プロジェクトA')).toBeInTheDocument()
    expect(screen.getByText('プロジェクトB')).toBeInTheDocument()
  })

  it('should call onMoveToProject with project id when project is selected', async () => {
    const user = userEvent.setup()
    const onMoveToProject = vi.fn()
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={onMoveToProject}
        currentProjectId={null}
      />,
    )
    await user.click(screen.getByText('sidebar.moveToProject'))
    await user.click(screen.getByText('プロジェクトA'))
    expect(onMoveToProject).toHaveBeenCalledWith('p1')
  })

  it('should show uncategorized option when flow has a project', async () => {
    const user = userEvent.setup()
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'p2',
        name: 'プロジェクトB',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={vi.fn()}
        currentProjectId="p1"
      />,
    )
    await user.click(screen.getByText('sidebar.moveToProject'))
    // Should show uncategorized since flow has a project
    expect(screen.getByText('sidebar.uncategorized')).toBeInTheDocument()
    // Should not show current project
    expect(screen.queryByText('プロジェクトA')).not.toBeInTheDocument()
    // Should show other project
    expect(screen.getByText('プロジェクトB')).toBeInTheDocument()
  })

  it('should not show uncategorized when flow is already uncategorized', async () => {
    const user = userEvent.setup()
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={vi.fn()}
        currentProjectId={null}
      />,
    )
    await user.click(screen.getByText('sidebar.moveToProject'))
    expect(screen.queryByText('sidebar.uncategorized')).not.toBeInTheDocument()
    expect(screen.getByText('プロジェクトA')).toBeInTheDocument()
  })

  it('should call onMoveToProject with null when uncategorized is selected', async () => {
    const user = userEvent.setup()
    const onMoveToProject = vi.fn()
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={projects}
        onMoveToProject={onMoveToProject}
        currentProjectId="p1"
      />,
    )
    await user.click(screen.getByText('sidebar.moveToProject'))
    await user.click(screen.getByText('sidebar.uncategorized'))
    expect(onMoveToProject).toHaveBeenCalledWith(null)
  })

  it('should not show move-to-project when flow is uncategorized and no projects exist', () => {
    render(
      <FlowContextMenu
        {...defaultProps}
        projects={[]}
        onMoveToProject={vi.fn()}
        currentProjectId={null}
      />,
    )
    expect(screen.queryByText('sidebar.moveToProject')).not.toBeInTheDocument()
  })

  it('should not show move-to-project in trash mode', () => {
    const projects = [
      {
        id: 'p1',
        name: 'プロジェクトA',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    render(
      <FlowContextMenu
        {...defaultProps}
        isTrash
        projects={projects}
        onMoveToProject={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />,
    )
    expect(screen.queryByText('sidebar.moveToProject')).not.toBeInTheDocument()
  })
})
