// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsPage } from './SettingsPage'

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

// Mock useAuth — stable references to prevent infinite re-render loops
const mockUser = { id: 'user-1', email: 'test@example.com', name: 'テストユーザー' }
const mockLogout = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    refreshAuth: vi.fn(),
  }),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import { apiFetch } from '../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

const mockSettingsResponse = {
  settings: {
    copyLabelOnSameRow: false,
    autoConnect: true,
    autoAddRow: true,
    enterEditOnCreate: true,
    doubleClickToEdit: true,
    defaultArrowStyle: 'solid',
    defaultArrowColor: 'default',
    showDotGrid: true,
    showOrderBadge: true,
    showLaneColorBar: true,
    defaultTheme: 'cloud',
    language: 'ja',
    notifications: true,
  },
  profile: {
    name: 'テストユーザー',
    email: 'test@example.com',
  },
}

function renderSettingsPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // === ローディング状態 ===
  it('should show loading state while fetching settings', () => {
    mockApiFetch.mockImplementationOnce(() => new Promise(() => {}))
    renderSettingsPage()
    expect(screen.getByTestId('settings-loading')).toBeInTheDocument()
  })

  // === ヘッダー: Flowlineロゴ ===
  it('should display Flowline logo text in header', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-topbar')).toBeInTheDocument()
    })

    expect(screen.getByText('Flowline')).toBeInTheDocument()
  })

  // === ヘッダー: ロゴリンク ===
  it('should have logo link to /flows', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-topbar')).toBeInTheDocument()
    })

    const logoLink = screen.getByTestId('settings-logo-link')
    expect(logoLink).toHaveAttribute('href', '/flows')
  })

  // === ヘッダー: アバター ===
  it('should display user avatar with initial in header', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-avatar')).toBeInTheDocument()
    })

    // テストユーザー -> first char is テ
    expect(screen.getByTestId('settings-avatar')).toHaveTextContent('テ')
  })

  // === 手動保存ボタンなし ===
  it('should not have a manual save button', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-topbar')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('settings-save')).not.toBeInTheDocument()
  })

  // === 戻るボタンなし（ロゴリンクに置き換え） ===
  it('should not have a separate back button', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-topbar')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('settings-back')).not.toBeInTheDocument()
  })

  // === サイドバーナビゲーション ===
  it('should render sidebar with all 6 navigation items', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-profile')).toBeInTheDocument()
    })

    expect(screen.getByTestId('nav-editor')).toBeInTheDocument()
    expect(screen.getByTestId('nav-interaction')).toBeInTheDocument()
    expect(screen.getByTestId('nav-display')).toBeInTheDocument()
    expect(screen.getByTestId('nav-notifications')).toBeInTheDocument()
    expect(screen.getByTestId('nav-security')).toBeInTheDocument()
  })

  it('should render nav items with correct labels', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument()
    })

    const sidebar = screen.getByTestId('settings-sidebar')
    expect(sidebar).toHaveTextContent('nav.profile')
    expect(sidebar).toHaveTextContent('nav.editor')
    expect(sidebar).toHaveTextContent('nav.interaction')
    expect(sidebar).toHaveTextContent('nav.display')
    expect(sidebar).toHaveTextContent('nav.notification')
    expect(sidebar).toHaveTextContent('nav.security')
  })

  // === デフォルト表示 ===
  it('should show profile section by default', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    expect(screen.getByText('profile.desc')).toBeInTheDocument()
  })

  // === セクション切替 ===
  it('should switch to editor section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-editor')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-editor'))

    expect(screen.getByText('editor.nodeCreation.title')).toBeInTheDocument()
  })

  it('should switch to display section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-display')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-display'))

    expect(screen.getByText('display.title')).toBeInTheDocument()
  })

  it('should switch to notifications section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-notifications')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-notifications'))

    expect(screen.getByText('notification.title')).toBeInTheDocument()
  })

  it('should switch to interaction section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-interaction')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-interaction'))

    expect(screen.getByText('interaction.title')).toBeInTheDocument()
  })

  it('should switch to security section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-security')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-security'))

    const content = screen.getByTestId('settings-content')
    expect(content).toHaveTextContent('security.title')
    expect(content).toHaveTextContent('security.dangerZone')
  })

  // === APIエラー ===
  it('should show error state when fetching settings fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-error')).toBeInTheDocument()
    })
  })

  // === 自動保存: トグル変更後にdebounceで保存 ===
  it('should auto-save settings after toggle change with debounce', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    // Clear the initial loadSettings call
    mockApiFetch.mockClear()
    mockApiFetch.mockResolvedValue({})

    // Navigate to editor section and toggle a setting
    const user = userEvent.setup()
    const editorNav = screen.getByTestId('nav-editor')
    await user.click(editorNav)

    await waitFor(() => {
      const toggles = screen.getAllByRole('switch')
      expect(toggles.length).toBeGreaterThan(0)
    })

    const firstToggle = screen.getAllByRole('switch')[0]
    await user.click(firstToggle)

    // Wait for debounce (800ms) + some buffer
    await waitFor(
      () => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/settings',
          expect.objectContaining({ method: 'PUT' }),
        )
      },
      { timeout: 2000 },
    )
  })

  // === 自動保存: ステータス表示 ===
  it('should show save status indicator after auto-save', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    mockApiFetch.mockClear()
    mockApiFetch.mockResolvedValue({})

    const user = userEvent.setup()
    const editorNav = screen.getByTestId('nav-editor')
    await user.click(editorNav)

    await waitFor(() => {
      const toggles = screen.getAllByRole('switch')
      expect(toggles.length).toBeGreaterThan(0)
    })

    const firstToggle = screen.getAllByRole('switch')[0]
    await user.click(firstToggle)

    // Wait for auto-save to complete and show status
    await waitFor(
      () => {
        expect(screen.getByTestId('save-status')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  // === 自動保存: エラー表示 ===
  it('should show error when auto-save fails', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    mockApiFetch.mockClear()
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    const editorNav = screen.getByTestId('nav-editor')
    await user.click(editorNav)

    await waitFor(() => {
      const toggles = screen.getAllByRole('switch')
      expect(toggles.length).toBeGreaterThan(0)
    })

    const firstToggle = screen.getAllByRole('switch')[0]
    await user.click(firstToggle)

    await waitFor(
      () => {
        expect(screen.getByTestId('settings-error')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  // === 自動保存: エラー時のtopbar表示 ===
  it('should show error status in topbar when auto-save fails', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    mockApiFetch.mockClear()
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    const editorNav = screen.getByTestId('nav-editor')
    await user.click(editorNav)

    await waitFor(() => {
      const toggles = screen.getAllByRole('switch')
      expect(toggles.length).toBeGreaterThan(0)
    })

    const firstToggle = screen.getAllByRole('switch')[0]
    await user.click(firstToggle)

    await waitFor(
      () => {
        expect(screen.getByTestId('save-status-error')).toBeInTheDocument()
        expect(screen.getByTestId('save-status-error')).toHaveTextContent('status.saveFailed')
      },
      { timeout: 3000 },
    )
  })

  // === UserMenuPanel: アバタークリックでメニュー表示 ===
  it('should open UserMenuPanel when avatar is clicked', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-avatar')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('settings-avatar'))

    await waitFor(() => {
      expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
    })
  })

  // === アバターのアクセシビリティ ===
  it('should have accessible label on avatar button', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-avatar')).toBeInTheDocument()
    })

    expect(screen.getByTestId('settings-avatar')).toHaveAttribute('aria-label', 'status.menu')
  })

  // === 言語切替: APIリフェッチしない ===
  it('should not re-fetch settings from API when language is changed', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    // Record initial API call count (1 for loadSettings)
    const initialCallCount = mockApiFetch.mock.calls.filter(
      (call) => call[0] === '/settings' && (!call[1] || !call[1].method),
    ).length
    expect(initialCallCount).toBe(1)

    // Navigate to display section
    await user.click(screen.getByTestId('nav-display'))

    await waitFor(() => {
      expect(screen.getByTestId('language-select')).toBeInTheDocument()
    })

    // Change language to English
    await user.selectOptions(screen.getByTestId('language-select'), 'en')

    // Wait a bit and verify no additional GET /settings call was made
    await new Promise((r) => setTimeout(r, 500))

    const getSettingsCalls = mockApiFetch.mock.calls.filter(
      (call) => call[0] === '/settings' && (!call[1] || !call[1].method),
    )
    expect(getSettingsCalls.length).toBe(initialCallCount)
  })

  // === アバターの頭文字表示 ===
  it('should display first character of user name in avatar', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-avatar')).toBeInTheDocument()
    })

    // mockUser name is 'テストユーザー', first char upper is 'テ'
    expect(screen.getByTestId('settings-avatar')).toHaveTextContent('テ')
  })
})
