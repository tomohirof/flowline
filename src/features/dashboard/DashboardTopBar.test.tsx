// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../constants/brand'
import { DashboardTopBar } from './DashboardTopBar'

describe('DashboardTopBar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    userName: 'テストユーザー',
    onToggleMenu: vi.fn(),
  }

  it('should render Flowline logo', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
  })

  it('should render search input', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByPlaceholderText('ファイルを検索…')).toBeInTheDocument()
  })

  it('should call onSearchChange when typing in search', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    render(<DashboardTopBar {...defaultProps} onSearchChange={onSearchChange} />)

    const input = screen.getByPlaceholderText('ファイルを検索…')
    await user.type(input, 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')
  })

  it('should not render create flow button', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.queryByTestId('create-flow-button')).not.toBeInTheDocument()
    expect(screen.queryByText('+ 新規作成')).not.toBeInTheDocument()
  })

  it('should render user avatar', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
  })

  it('should have topbar testid', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByTestId('dashboard-topbar')).toBeInTheDocument()
  })

  it('should display user initial in avatar', () => {
    render(<DashboardTopBar {...defaultProps} userName="テストユーザー" />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('should display search query value', () => {
    render(<DashboardTopBar {...defaultProps} searchQuery="検索テスト" />)
    const input = screen.getByPlaceholderText('ファイルを検索…') as HTMLInputElement
    expect(input.value).toBe('検索テスト')
  })

  it('should call onToggleMenu when avatar is clicked', async () => {
    const user = userEvent.setup()
    const onToggleMenu = vi.fn()
    render(<DashboardTopBar {...defaultProps} onToggleMenu={onToggleMenu} />)

    await user.click(screen.getByTestId('user-avatar'))
    expect(onToggleMenu).toHaveBeenCalledTimes(1)
  })

  it('should have メニュー as avatar aria-label', () => {
    render(<DashboardTopBar {...defaultProps} />)
    const avatar = screen.getByTestId('user-avatar')
    expect(avatar).toHaveAttribute('aria-label', 'メニュー')
  })

  it('should display U as initial when userName is empty', () => {
    render(<DashboardTopBar {...defaultProps} userName="" />)
    expect(screen.getByText('U')).toBeInTheDocument()
  })
})
