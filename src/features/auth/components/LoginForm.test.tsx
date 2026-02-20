// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render email and password inputs and submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeInTheDocument()
  })

  it('should render labels for email and password', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
  })

  it('should display error message when error prop is provided', () => {
    render(<LoginForm onSubmit={vi.fn()} error="認証エラー" />)

    const errorElement = screen.getByTestId('error-message')
    expect(errorElement).toBeInTheDocument()
    expect(errorElement).toHaveTextContent('認証エラー')
    expect(errorElement).toHaveAttribute('role', 'alert')
  })

  it('should not display error message when error prop is null', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('should call onSubmit with email and password on form submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<LoginForm onSubmit={onSubmit} error={null} />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(onSubmit).toHaveBeenCalledWith('test@example.com', 'password123')
  })

  it('should show submitting state while form is being submitted', async () => {
    const user = userEvent.setup()
    let resolveSubmit: () => void
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        }),
    )

    render(<LoginForm onSubmit={onSubmit} error={null} />)

    await user.type(screen.getByTestId('email-input'), 'test@example.com')
    await user.type(screen.getByTestId('password-input'), 'password123')
    await user.click(screen.getByTestId('submit-button'))

    expect(screen.getByTestId('submit-button')).toBeDisabled()
    expect(screen.getByTestId('submit-button')).toHaveTextContent('ログイン中...')

    // Resolve the submission
    resolveSubmit!()
  })

  it('should have default text on submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('submit-button')).toHaveTextContent('ログイン')
    expect(screen.getByTestId('submit-button')).not.toBeDisabled()
  })

  it('should have required attribute on email and password inputs', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('email-input')).toBeRequired()
    expect(screen.getByTestId('password-input')).toBeRequired()
  })

  it('should have minLength=8 on password input', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('password-input')).toHaveAttribute('minLength', '8')
  })

  it('should have type=email on email input', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('email-input')).toHaveAttribute('type', 'email')
  })

  it('should have type=password on password input', () => {
    render(<LoginForm onSubmit={vi.fn()} error={null} />)

    expect(screen.getByTestId('password-input')).toHaveAttribute('type', 'password')
  })
})
