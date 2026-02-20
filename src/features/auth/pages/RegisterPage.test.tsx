// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RegisterPage } from './RegisterPage'

const mockRegister = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    loading: false,
    login: vi.fn(),
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render register page with form', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('register-page')).toBeInTheDocument()
    expect(screen.getByText('新規登録')).toBeInTheDocument()
    expect(screen.getByTestId('register-form')).toBeInTheDocument()
  })

  it('should render link to login page', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    const link = screen.getByText('ログイン')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/login')
  })

  it('should call register and navigate on successful submit', async () => {
    const user = userEvent.setup()
    const mockUser = { id: '1', email: 'new@example.com', name: 'New User' }
    mockRegister.mockResolvedValueOnce(mockUser)

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('name-input'), 'New User')
    await user.type(screen.getByTestId('email-input'), 'new@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(mockRegister).toHaveBeenCalledWith('new@example.com', 'password123', 'New User')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should display ApiError message on register failure', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('../../../lib/api')
    mockRegister.mockRejectedValueOnce(
      new ApiError(409, 'このメールアドレスは既に登録されています'),
    )

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('name-input'), 'Test')
    await user.type(screen.getByTestId('email-input'), 'dup@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent(
      'このメールアドレスは既に登録されています',
    )
  })

  it('should display generic error message on non-ApiError failure', async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('name-input'), 'Test')
    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent('エラーが発生しました')
  })

  it('should clear error on new submit attempt', async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce(new Error('Error'))
    mockRegister.mockImplementation(() => new Promise(() => {})) // never resolves on second call

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByTestId('name-input'), 'Test')
    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toBeInTheDocument()

    // Re-submit
    await user.clear(screen.getByTestId('name-input'))
    await user.type(screen.getByTestId('name-input'), 'Test2')
    await user.clear(screen.getByTestId('email-input'))
    await user.type(screen.getByTestId('email-input'), 'other@example.com')
    await user.clear(screen.getByTestId('password-input'))
    await user.type(screen.getByTestId('password-input'), 'newpass123')
    await user.click(screen.getByTestId('submit-button'))

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })
})
