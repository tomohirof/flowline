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

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
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
    name: 'Test User',
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
    expect(sidebar).toHaveTextContent('プロフィール')
    expect(sidebar).toHaveTextContent('エディタ')
    expect(sidebar).toHaveTextContent('操作')
    expect(sidebar).toHaveTextContent('表示')
    expect(sidebar).toHaveTextContent('通知')
    expect(sidebar).toHaveTextContent('セキュリティ')
  })

  // === デフォルト表示 ===
  it('should show profile section by default', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument()
    })

    // Profile section should be visible (it has the section title)
    expect(screen.getByText('アカウント情報を管理します')).toBeInTheDocument()
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

    // Editor section should now be visible
    expect(screen.getByText('ノード作成')).toBeInTheDocument()
  })

  it('should switch to display section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-display')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-display'))

    expect(screen.getByText('表示設定')).toBeInTheDocument()
  })

  it('should switch to notifications section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-notifications')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-notifications'))

    expect(screen.getByText('通知設定')).toBeInTheDocument()
  })

  // === トップバー ===
  it('should have save button', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-save')).toBeInTheDocument()
    })

    expect(screen.getByText('保存する')).toBeInTheDocument()
  })

  it('should have back button with correct testid', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-back')).toBeInTheDocument()
    })
  })

  it('should render the page title', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByText('設定')).toBeInTheDocument()
    })
  })

  // === 保存機能 ===
  it('should call PUT /settings when save is clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/settings' && options?.method === 'PUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve(mockSettingsResponse)
    })
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-save')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('settings-save'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
  })

  it('should show saved badge after successful save', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/settings' && options?.method === 'PUT') {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve(mockSettingsResponse)
    })
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-save')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('settings-save'))

    await waitFor(() => {
      expect(screen.getByTestId('settings-saved-badge')).toBeInTheDocument()
    })
  })

  // === APIエラー ===
  it('should show error state when fetching settings fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-error')).toBeInTheDocument()
    })
  })

  // === 戻るボタン ===
  it('should have back button linking to /flows', async () => {
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('settings-back')).toBeInTheDocument()
    })

    const backLink = screen.getByTestId('settings-back')
    expect(backLink.closest('a')).toHaveAttribute('href', '/flows')
  })

  // === セクション切替: interaction / security ===
  it('should switch to interaction section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-interaction')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-interaction'))

    expect(screen.getByText('操作設定')).toBeInTheDocument()
  })

  it('should switch to security section when nav clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce(mockSettingsResponse)
    renderSettingsPage()

    await waitFor(() => {
      expect(screen.getByTestId('nav-security')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('nav-security'))

    // Security section content area should contain "危険ゾーン"
    const content = screen.getByTestId('settings-content')
    expect(content).toHaveTextContent('セキュリティ')
    expect(content).toHaveTextContent('危険ゾーン')
  })
})
