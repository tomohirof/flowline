// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthModal } from './AuthModal'
import { ApiError } from '../../../lib/api'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockResendVerification = vi.fn()
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    resendVerification: mockResendVerification,
  }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('isOpen=falseの場合は何も表示しない', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={false} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument()
  })

  it('isOpen=trueの場合はモーダルを表示する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
  })

  it('ログインモードでメール・パスワード入力を表示する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.getByPlaceholderText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('パスワード')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('お名前')).not.toBeInTheDocument()
  })

  it('新規登録モードで名前・メール・パスワード入力を表示する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('パスワード')).toBeInTheDocument()
  })

  it('タブクリックでモード切替できる', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.queryByPlaceholderText('お名前')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('新規登録'))
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument()
  })

  it('ログイン成功時にonCloseが呼ばれ /flows に遷移する', async () => {
    mockLogin.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'Test' })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123')
      expect(onClose).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/flows')
    })
  })

  it('should show verify screen after successful registration', async () => {
    mockRegister.mockResolvedValue({ needsVerification: true, email: 'a@b.com' })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('a@b.com', 'password123', 'Test')
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
      expect(screen.getByText('a@b.com')).toBeInTheDocument()
    })
  })

  it('should go back to register when clicking change email link', async () => {
    mockRegister.mockResolvedValue({ needsVerification: true, email: 'a@b.com' })
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/メールアドレスを変更/))
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument()
  })

  it('should not show tabs in verify mode', async () => {
    mockRegister.mockResolvedValue({ needsVerification: true, email: 'a@b.com' })
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
    })
    expect(screen.queryByText('ログイン')).not.toBeInTheDocument()
    expect(screen.queryByText('新規登録')).not.toBeInTheDocument()
  })

  it('should not call onClose or navigate after registration', async () => {
    mockRegister.mockResolvedValue({ needsVerification: true, email: 'a@b.com' })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('should show verify screen when login returns 403 (email not verified)', async () => {
    mockLogin.mockRejectedValue(new ApiError(403, 'メールアドレスの確認が必要です'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
      expect(screen.getByText('unverified@example.com')).toBeInTheDocument()
    })
  })

  it('should allow resend from verify screen after login 403', async () => {
    mockLogin.mockRejectedValue(new ApiError(403, 'メールアドレスの確認が必要です'))
    mockResendVerification.mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('確認メールを再送する'))

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith('unverified@example.com')
      expect(screen.getByText('確認メールを再送しました')).toBeInTheDocument()
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockLogin.mockRejectedValue(new Error('認証に失敗しました'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('should go back to login when clicking back button after login 403', async () => {
    mockLogin.mockRejectedValue(new ApiError(403, 'メールアドレスの確認が必要です'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('メールを確認してください')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/ログイン画面に戻る/))
    expect(screen.getByPlaceholderText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('パスワード')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('お名前')).not.toBeInTheDocument()
  })

  it('Googleログインボタンクリックで「準備中」メッセージを表示する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText(/Google/))
    expect(screen.getByText(/準備中/)).toBeInTheDocument()
  })

  it('オーバーレイクリックでonCloseが呼ばれない', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('auth-modal-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('✕ボタンクリックでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByLabelText('閉じる'))
    expect(onClose).toHaveBeenCalled()
  })

  it('✕ボタンが表示されている', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('閉じる')).toBeInTheDocument()
  })

  describe('onSuccess callback', () => {
    it('should call onSuccess instead of navigating to /flows when provided', async () => {
      const onSuccess = vi.fn()
      const onClose = vi.fn()
      mockLogin.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Test' })

      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={onClose} initialMode="login" onSuccess={onSuccess} />
        </MemoryRouter>,
      )

      fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
        target: { value: 'a@b.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('パスワード'), {
        target: { value: 'pass1234' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledOnce()
      })
      expect(mockNavigate).not.toHaveBeenCalledWith('/flows')
    })

    it('should navigate to /flows when onSuccess is not provided', async () => {
      const onClose = vi.fn()
      mockLogin.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Test' })

      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
        </MemoryRouter>,
      )

      fireEvent.change(screen.getByPlaceholderText('メールアドレス'), {
        target: { value: 'a@b.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('パスワード'), {
        target: { value: 'pass1234' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/flows')
      })
    })
  })
})
