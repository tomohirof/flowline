// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardSidebar } from './DashboardSidebar'
import type { Project } from '../editor/types'

const mockProjects: Project[] = [
  { id: 'p1', name: 'プロジェクトA', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'p2', name: 'プロジェクトB', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
]

const defaultProps = {
  selectedNav: 'recent',
  onNavChange: vi.fn(),
  userName: 'テストユーザー',
  projects: mockProjects,
  onCreateProject: vi.fn(),
  onRenameProject: vi.fn(),
  onDeleteProject: vi.fn(),
}

describe('DashboardSidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render navigation items', () => {
    render(<DashboardSidebar {...defaultProps} />)

    expect(screen.getByText('sidebar.recent')).toBeInTheDocument()
    expect(screen.getByText('sidebar.allFiles')).toBeInTheDocument()
    expect(screen.getByText('sidebar.shared')).toBeInTheDocument()
    expect(screen.getByText('sidebar.drafts')).toBeInTheDocument()
    expect(screen.getByText('sidebar.trash')).toBeInTheDocument()
  })

  it('should call onNavChange when nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavChange = vi.fn()
    render(<DashboardSidebar {...defaultProps} onNavChange={onNavChange} />)

    await user.click(screen.getByTestId('nav-item-all'))
    expect(onNavChange).toHaveBeenCalledWith('all')
  })

  it('should display user name', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('should display Free plan badge', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('should display project section title instead of team', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('sidebar.projects')).toBeInTheDocument()
    expect(screen.queryByText('sidebar.teams')).not.toBeInTheDocument()
  })

  it('should display projects from props', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('プロジェクトA')).toBeInTheDocument()
    expect(screen.getByText('プロジェクトB')).toBeInTheDocument()
  })

  it('should display uncategorized nav item', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('sidebar.uncategorized')).toBeInTheDocument()
  })

  it('should call onNavChange with project:none when uncategorized is clicked', async () => {
    const user = userEvent.setup()
    const onNavChange = vi.fn()
    render(<DashboardSidebar {...defaultProps} onNavChange={onNavChange} />)

    await user.click(screen.getByText('sidebar.uncategorized'))
    expect(onNavChange).toHaveBeenCalledWith('project:none')
  })

  it('should call onNavChange with project:<id> when project is clicked', async () => {
    const user = userEvent.setup()
    const onNavChange = vi.fn()
    render(<DashboardSidebar {...defaultProps} onNavChange={onNavChange} />)

    await user.click(screen.getByText('プロジェクトA'))
    expect(onNavChange).toHaveBeenCalledWith('project:p1')
  })

  it('should highlight active project', () => {
    render(<DashboardSidebar {...defaultProps} selectedNav="project:p1" />)
    const projectItem = screen.getByTestId('project-item-p1')
    expect(projectItem.className).toContain('Active')
  })

  it('should highlight uncategorized when selected', () => {
    render(<DashboardSidebar {...defaultProps} selectedNav="project:none" />)
    const uncategorized = screen.getByTestId('project-item-none')
    expect(uncategorized.className).toContain('Active')
  })

  it('should have create project button', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByTestId('create-project-btn')).toBeInTheDocument()
  })

  it('should call onCreateProject when create button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateProject = vi.fn()
    render(<DashboardSidebar {...defaultProps} onCreateProject={onCreateProject} />)

    await user.click(screen.getByTestId('create-project-btn'))
    expect(onCreateProject).toHaveBeenCalled()
  })

  it('should show context menu on right-click of project item', async () => {
    render(<DashboardSidebar {...defaultProps} />)
    const projectItem = screen.getByTestId('project-item-p1')

    fireEvent.contextMenu(projectItem)

    expect(screen.getByText('sidebar.rename')).toBeInTheDocument()
    expect(screen.getByText('sidebar.delete')).toBeInTheDocument()
  })

  it('should call onRenameProject when rename is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onRenameProject = vi.fn()
    render(<DashboardSidebar {...defaultProps} onRenameProject={onRenameProject} />)

    const projectItem = screen.getByTestId('project-item-p1')
    fireEvent.contextMenu(projectItem)

    await user.click(screen.getByText('sidebar.rename'))
    expect(onRenameProject).toHaveBeenCalledWith('p1')
  })

  it('should call onDeleteProject when delete is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onDeleteProject = vi.fn()
    render(<DashboardSidebar {...defaultProps} onDeleteProject={onDeleteProject} />)

    const projectItem = screen.getByTestId('project-item-p1')
    fireEvent.contextMenu(projectItem)

    await user.click(screen.getByText('sidebar.delete'))
    expect(onDeleteProject).toHaveBeenCalledWith('p1')
  })

  it('should not show context menu on right-click of uncategorized item', () => {
    render(<DashboardSidebar {...defaultProps} />)
    const uncategorized = screen.getByTestId('project-item-none')

    fireEvent.contextMenu(uncategorized)

    expect(screen.queryByText('sidebar.rename')).not.toBeInTheDocument()
    expect(screen.queryByText('sidebar.delete')).not.toBeInTheDocument()
  })

  it('should close context menu when clicking elsewhere', async () => {
    const user = userEvent.setup()
    render(<DashboardSidebar {...defaultProps} />)

    const projectItem = screen.getByTestId('project-item-p1')
    fireEvent.contextMenu(projectItem)
    expect(screen.getByText('sidebar.rename')).toBeInTheDocument()

    // Click elsewhere to close
    await user.click(screen.getByTestId('dashboard-sidebar'))
    expect(screen.queryByText('sidebar.rename')).not.toBeInTheDocument()
  })

  it('should render empty project list', () => {
    render(<DashboardSidebar {...defaultProps} projects={[]} />)
    expect(screen.getByText('sidebar.projects')).toBeInTheDocument()
    expect(screen.getByText('sidebar.uncategorized')).toBeInTheDocument()
  })

  it('should display Pro upgrade card', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('sidebar.showPlan')).toBeInTheDocument()
    expect(screen.getByText('sidebar.proPlanMessage')).toBeInTheDocument()
  })

  it('should have sidebar testid', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument()
  })

  it('should display user initial in avatar', () => {
    render(<DashboardSidebar {...defaultProps} />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('should display U when userName is empty', () => {
    render(<DashboardSidebar {...defaultProps} userName="" />)
    expect(screen.getByText('U')).toBeInTheDocument()
  })
})
