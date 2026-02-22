// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenuPanel } from './UserMenuPanel'

describe('UserMenuPanel', () => {
  afterEach(() => { cleanup() })

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userName: 'テストユーザー',
    userEmail: 'test@example.com',
    onLogout: vi.fn(),
  }

  it('should render panel with user info when open', () => {
    render(<UserMenuPanel {...defaultProps} />)
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('アカウント')).toBeInTheDocument()
    expect(screen.getByText('Free プラン')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<UserMenuPanel {...defaultProps} isOpen={false} />)
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(<UserMenuPanel {...defaultProps} onLogout={onLogout} />)
    await user.click(screen.getByTestId('logout-button'))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UserMenuPanel {...defaultProps} onClose={onClose} />)
    await user.click(screen.getByTestId('user-menu-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UserMenuPanel {...defaultProps} onClose={onClose} />)
    await user.click(screen.getByTestId('user-menu-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should render all menu items', () => {
    render(<UserMenuPanel {...defaultProps} />)
    expect(screen.getByText('プロフィール設定')).toBeInTheDocument()
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText('プランと請求')).toBeInTheDocument()
    expect(screen.getByText('チーム管理')).toBeInTheDocument()
    expect(screen.getByText('ダークモード')).toBeInTheDocument()
    expect(screen.getByText('キーボードショートカット')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ・ドキュメント')).toBeInTheDocument()
    expect(screen.getByText('フィードバック')).toBeInTheDocument()
  })

  it('should display user initial in large avatar', () => {
    render(<UserMenuPanel {...defaultProps} />)
    expect(screen.getByTestId('user-menu-avatar')).toHaveTextContent('テ')
  })

  it('should display fallback initial when userName is empty', () => {
    render(<UserMenuPanel {...defaultProps} userName="" />)
    expect(screen.getByTestId('user-menu-avatar')).toHaveTextContent('U')
  })
})
