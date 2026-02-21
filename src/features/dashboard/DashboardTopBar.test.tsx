// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardTopBar } from './DashboardTopBar'

describe('DashboardTopBar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    onCreateFlow: vi.fn(),
    creating: false,
    userName: 'テストユーザー',
    onLogout: vi.fn(),
  }

  it('should render Flowline logo', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByText('Flowline')).toBeInTheDocument()
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

  it('should render create flow button with text', () => {
    render(<DashboardTopBar {...defaultProps} />)
    expect(screen.getByTestId('create-flow-button')).toBeInTheDocument()
    expect(screen.getByText('+ 新規作成')).toBeInTheDocument()
  })

  it('should call onCreateFlow when create button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateFlow = vi.fn()
    render(<DashboardTopBar {...defaultProps} onCreateFlow={onCreateFlow} />)

    await user.click(screen.getByTestId('create-flow-button'))
    expect(onCreateFlow).toHaveBeenCalledTimes(1)
  })

  it('should disable create button and show 作成中... when creating', () => {
    render(<DashboardTopBar {...defaultProps} creating={true} />)

    const button = screen.getByTestId('create-flow-button')
    expect(button).toBeDisabled()
    expect(screen.getByText('作成中...')).toBeInTheDocument()
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

  it('should call onLogout when avatar is clicked', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<DashboardTopBar {...defaultProps} onLogout={onLogout} />)

    await user.click(screen.getByTestId('user-avatar'))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
