// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPage } from './AdminPage'

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { apiFetch } from '../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

// Mock react-router-dom
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

// Mock useAuth - default to admin user
const mockLogout = vi.fn()
let mockUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
  aiEnabled: true,
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: mockLogout,
  }),
}))

const mockUsers = [
  { id: 'user-1', email: 'user1@example.com', name: 'User One', role: 'user', aiEnabled: false },
  { id: 'user-2', email: 'user2@example.com', name: 'User Two', role: 'user', aiEnabled: true },
  {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    aiEnabled: true,
  },
]

// Helper: applies a path-routed mockImplementation on top of any queued
// mockResolvedValueOnce/mockRejectedValueOnce calls. Queued "once" responses
// still fire first (vitest behavior); this impl handles the un-queued calls
// so e.g. InvitationsSection's /admin/invitations GET on mount doesn't break
// user-focused tests.
function routeApiFetch(extra?: Record<string, unknown>) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/admin/invitations') return { invitations: [] }
    if (extra && path in extra) return extra[path]
    return { users: [] }
  })
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      aiEnabled: true,
    }
    routeApiFetch()
  })

  afterEach(() => {
    cleanup()
  })

  // ========================================
  // Access Control
  // ========================================
  it('should show access denied when user is not admin', async () => {
    mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Regular User',
      role: 'user',
      aiEnabled: false,
    }

    render(<AdminPage />)

    expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument()
    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument()
    expect(screen.getByTestId('admin-back-link')).toBeInTheDocument()
  })

  it('should not fetch users when user is not admin', () => {
    mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Regular User',
      role: 'user',
      aiEnabled: false,
    }

    render(<AdminPage />)

    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  // ========================================
  // Loading State
  // ========================================
  it('should show loading state while fetching users', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    render(<AdminPage />)

    expect(screen.getByTestId('admin-loading')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  // ========================================
  // User List Rendering
  // ========================================
  it('should render user list for admin user', async () => {
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-table')).toBeInTheDocument()
    })

    expect(screen.getByText('user1@example.com')).toBeInTheDocument()
    expect(screen.getByText('user2@example.com')).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('User One')).toBeInTheDocument()
    expect(screen.getByText('User Two')).toBeInTheDocument()
  })

  it('should display role badges correctly', async () => {
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-table')).toBeInTheDocument()
    })

    // Check role badges exist
    const adminBadges = screen.getAllByText('admin')
    expect(adminBadges.length).toBeGreaterThan(0)
    const userBadges = screen.getAllByText('user')
    expect(userBadges.length).toBeGreaterThan(0)
  })

  it('should show empty state when no users', async () => {
    routeApiFetch({ '/admin/users': { users: [] } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-empty')).toBeInTheDocument()
    })

    expect(screen.getByText('ユーザーがいません')).toBeInTheDocument()
  })

  // ========================================
  // Toggle AI
  // ========================================
  it('should toggle AI enabled when clicking toggle button', async () => {
    const user = userEvent.setup()
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-table')).toBeInTheDocument()
    })

    // Toggle user-1 (currently aiEnabled=false)
    mockApiFetch.mockResolvedValueOnce({
      user: { ...mockUsers[0], aiEnabled: true },
    })

    await user.click(screen.getByTestId('ai-toggle-user-1'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/admin/users/user-1', {
        method: 'PUT',
        body: JSON.stringify({ aiEnabled: true }),
      })
    })
  })

  it('should disable toggle button while API call is in progress', async () => {
    const user = userEvent.setup()
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-table')).toBeInTheDocument()
    })

    // API call never resolves
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    await user.click(screen.getByTestId('ai-toggle-user-1'))

    expect(screen.getByTestId('ai-toggle-user-1')).toBeDisabled()
  })

  it('should show error when toggle API call fails', async () => {
    const user = userEvent.setup()
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-user-table')).toBeInTheDocument()
    })

    mockApiFetch.mockRejectedValueOnce(new Error('Server error'))

    await user.click(screen.getByTestId('ai-toggle-user-1'))

    await waitFor(() => {
      expect(screen.getByTestId('admin-error')).toBeInTheDocument()
    })

    expect(screen.getByText('AI設定の更新に失敗しました')).toBeInTheDocument()
  })

  // ========================================
  // Error Handling
  // ========================================
  it('should show error when user list fetch fails', async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/admin/invitations') return { invitations: [] }
      throw new Error('Server error')
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-error')).toBeInTheDocument()
    })

    expect(screen.getByText('ユーザー一覧の取得に失敗しました')).toBeInTheDocument()
  })

  // ========================================
  // Top Bar
  // ========================================
  it('should render top bar with logo link and avatar', async () => {
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-topbar')).toBeInTheDocument()
    })

    expect(screen.getByTestId('admin-logo-link')).toBeInTheDocument()
    expect(screen.getByTestId('admin-avatar')).toBeInTheDocument()
    expect(screen.getByText('管理画面')).toBeInTheDocument()
  })

  it('should call GET /admin/users on mount for admin', async () => {
    routeApiFetch({ '/admin/users': { users: [] } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/admin/users')
    })
  })

  // ========================================
  // Invitations Section integration
  // ========================================
  it('should render InvitationsSection for admin user', async () => {
    routeApiFetch({ '/admin/users': { users: mockUsers } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('invitations-section')).toBeInTheDocument()
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/invitations')
  })
})
