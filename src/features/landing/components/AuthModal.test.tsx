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
  })

  it('registerモードではβ案内を表示しフォームは出さない', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.email')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.password')).not.toBeInTheDocument()
    expect(screen.queryByTestId('auth-submit')).not.toBeInTheDocument()
  })

  it('β案内の「ログインへ」ボタン押下でloginモードに戻る', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('closedBeta.backToLogin'))
    expect(screen.queryByTestId('closed-beta-notice')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('form.password')).toBeInTheDocument()
  })

  it('タブを register→login→register と切替えてもβ案内が復帰する', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="register" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    fireEvent.click(screen.getByText('login'))
    expect(screen.queryByTestId('closed-beta-notice')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('register'))
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
  })

  it('タブクリックでregisterタブに切替えるとβ案内が表示される', () => {
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('closed-beta-notice')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('register'))
    expect(screen.getByTestId('closed-beta-notice')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('form.name')).not.toBeInTheDocument()
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
})
