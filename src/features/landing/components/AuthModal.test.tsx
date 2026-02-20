// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthModal } from './AuthModal'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
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
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123')
      expect(onClose).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/flows')
    })
  })

  it('新規登録成功時にonCloseが呼ばれ /flows に遷移する', async () => {
    mockRegister.mockResolvedValue({ id: '1', email: 'a@b.com', name: 'Test' })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="register" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('a@b.com', 'password123', 'Test')
      expect(onClose).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/flows')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockLogin.mockRejectedValue(new Error('認証に失敗しました'))
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={vi.fn()} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
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

  it('オーバーレイクリックでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} initialMode="login" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('auth-modal-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
