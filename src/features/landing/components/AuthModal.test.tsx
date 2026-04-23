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
    expect(screen.getByPlaceholderText('form.email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.password')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
    expect(screen.queryByTestId('invitation-code-input')).not.toBeInTheDocument()
  })

  it('ログイン成功時にonCloseが呼ばれ /flows に遷移する', async () => {
    mockLogin.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'Test' })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123')
      expect(onClose).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/flows')
    })
  })

  it('should show verify screen when login returns 403 (email not verified)', async () => {
    mockLogin.mockRejectedValue(new ApiError(403, 'メールアドレスの確認が必要です'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('verifyEmail.title')).toBeInTheDocument()
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
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('verifyEmail.title')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('verifyEmail.resend'))

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith('unverified@example.com')
      expect(screen.getByText('emailResent')).toBeInTheDocument()
    })
  })

  it('verify モードではタブが表示されない（login 403経由）', async () => {
    mockLogin.mockRejectedValue(new ApiError(403, 'メールアドレスの確認が必要です'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('verifyEmail.title')).toBeInTheDocument()
    })
    expect(screen.queryByText('login')).not.toBeInTheDocument()
    expect(screen.queryByText('register')).not.toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockLogin.mockRejectedValue(new Error('認証に失敗しました'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
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
    fireEvent.change(screen.getByPlaceholderText('form.email'), {
      target: { value: 'unverified@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('form.password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByText('verifyEmail.title')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/verifyEmail\.backToLogin/))
    expect(screen.getByPlaceholderText('form.email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.password')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
  })

  it('Googleログインボタンクリックで「準備中」メッセージを表示する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText(/Google/))
    expect(screen.getByText(/googleLoginPending/)).toBeInTheDocument()
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
    fireEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('✕ボタンが表示されている', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('close')).toBeInTheDocument()
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

      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'a@b.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
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

      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'a@b.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
        target: { value: 'pass1234' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/flows')
      })
    })
  })

  describe('register mode with invitation code', () => {
    it('shows invitation code and name fields in register tab', () => {
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('invitation-code-input')).toBeInTheDocument()
      expect(screen.getByTestId('register-name-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('form.email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('form.password')).toBeInTheDocument()
    })

    it('hides Google button and divider in register mode', () => {
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      expect(screen.queryByText(/Google/)).not.toBeInTheDocument()
    })

    it('normalizes invitation code on change (uppercase + strip spaces)', () => {
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      const input = screen.getByTestId('invitation-code-input') as HTMLInputElement
      fireEvent.change(input, { target: { value: ' abc 123 ' } })
      expect(input.value).toBe('ABC123')
    })

    it('calls register with invitationCode and transitions to verify on success', async () => {
      mockRegister.mockResolvedValueOnce({ needsVerification: true, email: 'new@x.com' })
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      fireEvent.change(screen.getByTestId('invitation-code-input'), {
        target: { value: 'VALID01' },
      })
      fireEvent.change(screen.getByTestId('register-name-input'), {
        target: { value: 'New User' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'new@x.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
        target: { value: 'password123' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))
      await waitFor(() =>
        expect(mockRegister).toHaveBeenCalledWith(
          'new@x.com',
          'password123',
          'New User',
          'VALID01',
        ),
      )
      await waitFor(() => {
        expect(screen.getByText('verifyEmail.title')).toBeInTheDocument()
        expect(screen.getByText('new@x.com')).toBeInTheDocument()
      })
    })

    it('shows invalid code error inline when server returns INVITATION_INVALID', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError(
          400,
          '招待コードが無効です。期限切れまたは誤ったコードです。',
          'INVITATION_INVALID',
        ),
      )
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      fireEvent.change(screen.getByTestId('invitation-code-input'), {
        target: { value: 'BADCODE0' },
      })
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'U' } })
      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'x@x.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
        target: { value: 'password123' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /invitationCode\.errors\.invalid|招待コードが無効/,
        )
      })
    })

    it('shows emailAlreadyExists error inline when server returns EMAIL_ALREADY_EXISTS', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError(400, 'このメールアドレスは既に登録されています', 'EMAIL_ALREADY_EXISTS'),
      )
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      fireEvent.change(screen.getByTestId('invitation-code-input'), {
        target: { value: 'VALID01' },
      })
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'U' } })
      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'dup@x.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
        target: { value: 'password123' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/emailAlreadyExists|既に登録/)
      })
    })

    it('shows required error inline when server returns INVITATION_REQUIRED', async () => {
      mockRegister.mockRejectedValueOnce(
        new ApiError(400, '招待コードを入力してください', 'INVITATION_REQUIRED'),
      )
      render(
        <MemoryRouter>
          <AuthModal isOpen={true} onClose={() => {}} initialMode="register" />
        </MemoryRouter>,
      )
      // Use spaces to hit server-side required check (client require is satisfied visually but
      // we trust the mock to simulate the server rejection regardless)
      fireEvent.change(screen.getByTestId('invitation-code-input'), {
        target: { value: 'SOMECODE' },
      })
      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'U' } })
      fireEvent.change(screen.getByPlaceholderText('form.email'), {
        target: { value: 'x@x.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('form.password'), {
        target: { value: 'password123' },
      })
      fireEvent.click(screen.getByTestId('auth-submit'))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /invitationCode\.errors\.required|招待コードを入力/,
        )
      })
    })
  })
})
