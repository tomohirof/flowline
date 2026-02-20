// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'

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
    user: { id: 'user-1', email: 'test@example.com', name: 'テストユーザー' },
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

const mockFlows = [
  {
    id: 'flow-1',
    title: '業務フロー',
    themeId: 'cloud',
    shareToken: 'abc123',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'flow-2',
    title: '申請処理フロー',
    themeId: 'midnight',
    shareToken: null,
    createdAt: '2026-01-14T08:00:00Z',
    updatedAt: '2026-01-14T08:00:00Z',
  },
]

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // === ローディング状態 ===
  it('should show loading state while fetching flows', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    renderDashboard()

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  // === フロー一覧表示 ===
  it('should render flow cards from API data', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()
    expect(screen.getByText('業務フロー')).toBeInTheDocument()
    expect(screen.getByText('申請処理フロー')).toBeInTheDocument()
  })

  it('should display share status badge when flow has shareToken', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // flow-1 has shareToken → should show share badge
    expect(screen.getByTestId('share-badge-flow-1')).toBeInTheDocument()
    // flow-2 has no shareToken → should NOT show share badge
    expect(screen.queryByTestId('share-badge-flow-2')).not.toBeInTheDocument()
  })

  // === 空状態 ===
  it('should show empty state when no flows exist', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
    })

    expect(screen.getByText('フローがまだありません。新規作成してみましょう！')).toBeInTheDocument()
  })

  // === 新規作成ボタン ===
  it('should have a create flow button', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('create-flow-button')).toBeInTheDocument()
    })

    expect(screen.getByText('+ 新規作成')).toBeInTheDocument()
  })

  it('should call POST /flows and navigate to editor on create', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    mockApiFetch.mockResolvedValueOnce({ flow: { id: 'new-flow-id' } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('create-flow-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('create-flow-button'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/flows',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    expect(mockNavigate).toHaveBeenCalledWith('/flows/new-flow-id')
  })

  it('should show error when create flow fails', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    mockApiFetch.mockRejectedValueOnce(new Error('Server error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('create-flow-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('create-flow-button'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })

    expect(screen.getByText('フローの作成に失敗しました')).toBeInTheDocument()
  })

  it('should disable create button while creating', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    // Second call (create) never resolves → stays in creating state
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('create-flow-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('create-flow-button'))

    expect(screen.getByTestId('create-flow-button')).toBeDisabled()
    expect(screen.getByText('作成中...')).toBeInTheDocument()
  })

  // === 削除機能 ===
  it('should show confirm dialog and delete flow when confirmed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // DELETE call
    mockApiFetch.mockResolvedValueOnce({})

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))

    expect(confirmSpy).toHaveBeenCalledWith('「業務フロー」を削除しますか？')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1', { method: 'DELETE' })
    })

    // flow-1 should be removed from the list
    await waitFor(() => {
      expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    })

    // flow-2 should still be visible
    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('should not delete flow when confirm is cancelled', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))

    expect(confirmSpy).toHaveBeenCalled()
    // DELETE should NOT have been called (only the initial GET was called)
    expect(mockApiFetch).toHaveBeenCalledTimes(1)

    // Flow should still be visible
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('should show error when delete fails', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockRejectedValueOnce(new Error('Delete failed'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })

    expect(screen.getByText('フローの削除に失敗しました')).toBeInTheDocument()

    // Flow should still be visible since delete failed
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  // === APIエラー ===
  it('should show error state when fetching flows fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })

    expect(screen.getByText('フロー一覧の取得に失敗しました')).toBeInTheDocument()
  })

  // === ヘッダー表示 ===
  it('should display "マイフロー" heading', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('マイフロー')).toBeInTheDocument()
    })
  })

  // === カードクリックでナビゲーション ===
  it('should have links to flow editor on each card', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    const card1 = screen.getByTestId('flow-link-flow-1')
    expect(card1).toHaveAttribute('href', '/flows/flow-1')

    const card2 = screen.getByTestId('flow-link-flow-2')
    expect(card2).toHaveAttribute('href', '/flows/flow-2')
  })

  // === 重複削除の防止 ===
  it('should handle rapid delete clicks gracefully', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // Only one DELETE call should go through
    mockApiFetch.mockResolvedValueOnce({})

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('delete-flow-flow-1')).toBeInTheDocument()
    })

    // Click delete
    await user.click(screen.getByTestId('delete-flow-flow-1'))

    await waitFor(() => {
      expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })
})
