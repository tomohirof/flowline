// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { VerifyPage } from './VerifyPage'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock apiFetch
const mockApiFetch = vi.fn()
vi.mock('../../lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

function renderWithRouter(initialEntries: string[] = ['/verify']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <VerifyPage />
    </MemoryRouter>,
  )
}

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // --- ローディング状態 ---
  it('should show verifying message while API call is in progress', () => {
    // APIが解決されない状態をシミュレート
    mockApiFetch.mockReturnValue(new Promise(() => {}))
    renderWithRouter(['/verify?token=valid-token'])
    expect(screen.getByText('メールアドレスを確認中...')).toBeInTheDocument()
  })

  // --- 成功状態 ---
  it('should show success message when verification succeeds', async () => {
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=valid-token'])

    await waitFor(() => {
      expect(screen.getByText('メール認証が完了しました！')).toBeInTheDocument()
    })
    expect(screen.getByText('ダッシュボードにリダイレクトします...')).toBeInTheDocument()
  })

  it('should call apiFetch with correct token', async () => {
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=abc123'])

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/verify?token=abc123')
    })
  })

  it('should navigate to /flows after 2 seconds on success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=valid-token'])

    await waitFor(() => {
      expect(screen.getByText('メール認証が完了しました！')).toBeInTheDocument()
    })

    // 2秒後にリダイレクト
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockNavigate).toHaveBeenCalledWith('/flows', { replace: true })
    vi.useRealTimers()
  })

  it('should not navigate immediately on success (only after setTimeout)', async () => {
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=valid-token'])

    await waitFor(() => {
      expect(screen.getByText('メール認証が完了しました！')).toBeInTheDocument()
    })

    // setTimeout(2000)があるので、即座にはnavigateされない
    // ただしfake timersを使わない場合は2秒後に実際にnavigateされるが、
    // テスト実行時間内ではまだ呼ばれていないことを検証
    // NOTE: waitFor完了直後のスナップショットで確認
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // --- エラー状態: トークンなし ---
  it('should show error when token is missing (null)', () => {
    renderWithRouter(['/verify'])
    expect(screen.getByText('認証に失敗しました')).toBeInTheDocument()
    expect(screen.getByText('認証トークンが見つかりません')).toBeInTheDocument()
  })

  it('should show error when token is empty string', () => {
    renderWithRouter(['/verify?token='])
    // URLSearchParams.get('token') returns '' for ?token=, but the component checks !token
    expect(screen.getByText('認証に失敗しました')).toBeInTheDocument()
    expect(screen.getByText('認証トークンが見つかりません')).toBeInTheDocument()
  })

  it('should not call apiFetch when token is missing', () => {
    renderWithRouter(['/verify'])
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  // --- エラー状態: APIエラー ---
  it('should show error message when API returns error', async () => {
    mockApiFetch.mockRejectedValue(new Error('トークンが無効です'))
    renderWithRouter(['/verify?token=invalid-token'])

    await waitFor(() => {
      expect(screen.getByText('認証に失敗しました')).toBeInTheDocument()
    })
    expect(screen.getByText('トークンが無効です')).toBeInTheDocument()
  })

  it('should show default error message when non-Error is thrown', async () => {
    mockApiFetch.mockRejectedValue('something went wrong')
    renderWithRouter(['/verify?token=invalid-token'])

    await waitFor(() => {
      // h2 title and p.errorText both show '認証に失敗しました'
      const errorTexts = screen.getAllByText('認証に失敗しました')
      expect(errorTexts).toHaveLength(2) // title + error message
    })
    // Verify the title heading exists
    expect(screen.getByRole('heading', { name: '認証に失敗しました' })).toBeInTheDocument()
    // Verify the "トップに戻る" button is shown (error state)
    expect(screen.getByText('トップに戻る')).toBeInTheDocument()
  })

  // --- ナビゲーション ---
  it('should navigate to top page when "トップに戻る" button is clicked', async () => {
    mockApiFetch.mockRejectedValue(new Error('エラー'))
    renderWithRouter(['/verify?token=invalid-token'])

    await waitFor(() => {
      expect(screen.getByText('トップに戻る')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('トップに戻る'))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should not show "トップに戻る" button during verifying state', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}))
    renderWithRouter(['/verify?token=valid-token'])
    expect(screen.queryByText('トップに戻る')).not.toBeInTheDocument()
  })

  it('should not show "トップに戻る" button on success state', async () => {
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=valid-token'])

    await waitFor(() => {
      expect(screen.getByText('メール認証が完了しました！')).toBeInTheDocument()
    })
    expect(screen.queryByText('トップに戻る')).not.toBeInTheDocument()
  })

  // --- チェックアイコン表示 ---
  it('should show check icon on success', async () => {
    mockApiFetch.mockResolvedValue({ verified: true })
    renderWithRouter(['/verify?token=valid-token'])

    await waitFor(() => {
      expect(screen.getByText('✓')).toBeInTheDocument()
    })
  })
})
