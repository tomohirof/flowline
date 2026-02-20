// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    loading: false,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render login page with form', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })

  it('should render link to register page', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const link = screen.getByText('新規登録')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/register')
  })

  it('should call login and navigate on successful submit', async () => {
    const user = userEvent.setup()
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' }
    mockLogin.mockResolvedValueOnce(mockUser)

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should display ApiError message on login failure', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('../../../lib/api')
    mockLogin.mockRejectedValueOnce(
      new ApiError(401, 'メールアドレスまたはパスワードが正しくありません'),
    )

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('email-input'), 'bad@example.com')
    await user.type(screen.getByTestId('password-input'), 'wrongpass')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent(
      'メールアドレスまたはパスワードが正しくありません',
    )
  })

  it('should display generic error message on non-ApiError failure', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent('エラーが発生しました')
  })

  it('should clear error on new submit attempt', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Error'))
    mockLogin.mockImplementation(() => new Promise(() => {})) // never resolves on second call

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toBeInTheDocument()

    // Clear and re-submit
    await user.clear(screen.getByTestId('email-input'))
    await user.type(screen.getByTestId('email-input'), 'other@example.com')
    await user.clear(screen.getByTestId('password-input'))
    await user.type(screen.getByTestId('password-input'), 'newpassword1')
    await user.click(screen.getByTestId('submit-button'))

    // Error should be cleared on new attempt
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })
})
