// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UserMenuPanel } from './UserMenuPanel'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('UserMenuPanel', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userName: 'テストユーザー',
    userEmail: 'test@example.com',
    onLogout: vi.fn(),
  }

  it('should render panel with user info when open', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('アカウント')).toBeInTheDocument()
    expect(screen.getByText('Free プラン')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} isOpen={false} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} onLogout={onLogout} />
      </MemoryRouter>,
    )
    await user.click(screen.getByTestId('logout-button'))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} onClose={onClose} />
      </MemoryRouter>,
    )
    await user.click(screen.getByTestId('user-menu-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} onClose={onClose} />
      </MemoryRouter>,
    )
    await user.click(screen.getByTestId('user-menu-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should render all menu items', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('user-menu-avatar')).toHaveTextContent('テ')
  })

  it('should display fallback initial when userName is empty', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} userName="" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('user-menu-avatar')).toHaveTextContent('U')
  })

  it('should close when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} onClose={onClose} />
      </MemoryRouter>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should have dialog role and aria attributes', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} />
      </MemoryRouter>,
    )
    const panel = screen.getByTestId('user-menu-panel')
    expect(panel).toHaveAttribute('role', 'dialog')
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAttribute('aria-label', 'アカウントメニュー')
  })

  it('should render logout button inside menu list (not in separate footer)', () => {
    render(
      <MemoryRouter>
        <UserMenuPanel {...defaultProps} />
      </MemoryRouter>,
    )
    const menuList = screen.getByTestId('user-menu-panel').querySelector('[class*="menuList"]')
    expect(menuList).not.toBeNull()
    const logoutButton = screen.getByTestId('logout-button')
    expect(menuList!.contains(logoutButton)).toBe(true)
  })

  describe('navigation to settings page', () => {
    it('should navigate to /settings when プロフィール設定 is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <MemoryRouter>
          <UserMenuPanel {...defaultProps} onClose={onClose} />
        </MemoryRouter>,
      )
      await user.click(screen.getByText('プロフィール設定'))
      expect(mockNavigate).toHaveBeenCalledWith('/settings')
    })

    it('should navigate to /settings when アカウント設定 is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <MemoryRouter>
          <UserMenuPanel {...defaultProps} onClose={onClose} />
        </MemoryRouter>,
      )
      await user.click(screen.getByText('アカウント設定'))
      expect(mockNavigate).toHaveBeenCalledWith('/settings')
    })

    it('should close menu after navigation', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <MemoryRouter>
          <UserMenuPanel {...defaultProps} onClose={onClose} />
        </MemoryRouter>,
      )
      await user.click(screen.getByText('プロフィール設定'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not navigate when menu item without path is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <MemoryRouter>
          <UserMenuPanel {...defaultProps} onClose={onClose} />
        </MemoryRouter>,
      )
      await user.click(screen.getByText('ダークモード'))
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
