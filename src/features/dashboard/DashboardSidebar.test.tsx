// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardSidebar } from './DashboardSidebar'

describe('DashboardSidebar', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render navigation items', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)

    expect(screen.getByText('最近')).toBeInTheDocument()
    expect(screen.getByText('すべてのファイル')).toBeInTheDocument()
    expect(screen.getByText('共有ファイル')).toBeInTheDocument()
    expect(screen.getByText('ドラフト')).toBeInTheDocument()
    expect(screen.getByText('ごみ箱')).toBeInTheDocument()
  })

  it('should call onNavChange when nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavChange = vi.fn()
    render(<DashboardSidebar selectedNav="recent" onNavChange={onNavChange} userName="テストユーザー" />)

    await user.click(screen.getByTestId('nav-item-all'))
    expect(onNavChange).toHaveBeenCalledWith('all')
  })

  it('should display user name', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('should display Free plan badge', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('should display team section', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByText('チーム')).toBeInTheDocument()
    expect(screen.getByText('プロダクトチーム')).toBeInTheDocument()
    expect(screen.getByText('バックオフィス')).toBeInTheDocument()
  })

  it('should display Pro upgrade card', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByText('プランを表示')).toBeInTheDocument()
    expect(screen.getByText(/Proプラン/)).toBeInTheDocument()
  })

  it('should have sidebar testid', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument()
  })

  it('should display user initial in avatar', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="テストユーザー" />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('should display U when userName is empty', () => {
    render(<DashboardSidebar selectedNav="recent" onNavChange={vi.fn()} userName="" />)
    expect(screen.getByText('U')).toBeInTheDocument()
  })
})
