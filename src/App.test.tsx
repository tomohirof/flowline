// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const mockUseAuth = vi.fn()
vi.mock('./hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./features/landing/LandingPage', () => ({
  LandingPage: () => <div data-testid="landing-page">Landing</div>,
}))

vi.mock('./features/dashboard/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard">Dashboard</div>,
}))

vi.mock('./features/editor/pages/FlowEditorPage', () => ({
  FlowEditorPage: () => <div data-testid="flow-editor">Editor</div>,
}))

vi.mock('./features/shared/SharedFlowPage', () => ({
  SharedFlowPage: () => <div data-testid="shared-flow">Shared</div>,
}))

// Replace BrowserRouter with MemoryRouter for testing
let testInitialEntries: string[] = ['/']
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={testInitialEntries}>{children}</MemoryRouter>
    ),
  }
})

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testInitialEntries = ['/']
  })

  afterEach(() => {
    cleanup()
  })

  it('未認証ユーザーが / にアクセスするとLPを表示する', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })
    testInitialEntries = ['/']
    render(<App />)
    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
  })

  it('認証済みユーザーが / にアクセスすると /flows にリダイレクトする', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', name: 'Test' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })
    testInitialEntries = ['/']
    render(<App />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('LP表示時は共通ヘッダーを非表示にする', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })
    testInitialEntries = ['/']
    render(<App />)
    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument()
  })

  it('/login にアクセスすると LP が表示される', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() })
    testInitialEntries = ['/login']
    render(<App />)
    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
  })

  it('/register にアクセスすると LP が表示される', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() })
    testInitialEntries = ['/register']
    render(<App />)
    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
  })
})
