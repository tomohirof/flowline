// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DemoEditorPage } from './DemoEditorPage'

vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({ settings: {} }),
  ApiError: class extends Error {
    status: number
    constructor(msg: string, status: number) {
      super(msg)
      this.status = status
    }
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a
      href={to}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        mockNavigate(to)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    resendVerification: vi.fn(),
    logout: vi.fn(),
  }),
}))

beforeEach(() => {
  global.ResizeObserver = class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof ResizeObserver
  cleanup()
  vi.clearAllMocks()
})

describe('DemoEditorPage', () => {
  it('should render without authentication', () => {
    render(<DemoEditorPage />)
    expect(screen.getByTestId('canvas-svg')).toBeTruthy()
  })

  it('should show save CTA button with login text', () => {
    render(<DemoEditorPage />)
    const ctaButton = screen.getByTestId('save-cta-button')
    expect(ctaButton.textContent).toBe('ログインして保存')
  })

  it('should not show share button', () => {
    render(<DemoEditorPage />)
    expect(screen.queryByTestId('share-button')).toBeNull()
  })

  it('should open auth modal when CTA button is clicked', async () => {
    const user = userEvent.setup()
    render(<DemoEditorPage />)
    const ctaButton = screen.getByTestId('save-cta-button')
    await user.click(ctaButton)
    // AuthModal should be visible with email input
    expect(screen.getByPlaceholderText('メールアドレス')).toBeTruthy()
  })
})
