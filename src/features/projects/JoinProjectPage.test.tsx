// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JoinProjectPage } from './JoinProjectPage'
import '../../i18n'
import { ApiError } from '../../lib/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockApiFetch = vi.fn()
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, apiFetch: (...a: unknown[]) => mockApiFetch(...a) }
})

const mockUseAuth = { user: null as { id: string } | null, loading: false }
vi.mock('../../hooks/useAuth', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAuth')>('../../hooks/useAuth')
  return { ...actual, useAuth: () => mockUseAuth }
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:token" element={<JoinProjectPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinProjectPage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockNavigate.mockReset()
    mockUseAuth.user = null
    mockUseAuth.loading = false
  })

  afterEach(() => {
    cleanup()
  })

  it('shows β-invite-required screen when not logged in', async () => {
    mockUseAuth.user = null
    renderAt('/join/tok-1')
    await waitFor(() =>
      expect(screen.getByText(/β 招待コード|beta invitation code/i)).toBeInTheDocument(),
    )
  })

  it('calls join API when logged in and navigates on success', async () => {
    mockUseAuth.user = { id: 'u-1' }
    mockApiFetch.mockResolvedValueOnce({ projectId: 'p-1', role: 'editor' })
    renderAt('/join/tok-1')
    await waitFor(
      () =>
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('p-1'),
          expect.anything(),
        ),
      { timeout: 2000 },
    )
  })

  it('shows alreadyMember message then navigates', async () => {
    mockUseAuth.user = { id: 'u-1' }
    mockApiFetch.mockResolvedValueOnce({ projectId: 'p-1', role: 'editor', alreadyMember: true })
    renderAt('/join/tok-1')
    await waitFor(() => screen.getByText(/既に参加済み|already a member/i))
  })

  it('shows token-invalid error for 404', async () => {
    mockUseAuth.user = { id: 'u-1' }
    const err = Object.assign(new ApiError(404, 'invalid'), { code: 'INVITE_TOKEN_INVALID' })
    mockApiFetch.mockRejectedValueOnce(err)
    renderAt('/join/tok-1')
    await waitFor(() => screen.getByText(/招待リンクが無効|invite link is invalid/i))
  })

  it('shows generic error message for non-404 errors', async () => {
    mockUseAuth.user = { id: 'u-1' }
    const err = Object.assign(new ApiError(500, 'boom'), { code: 'SERVER_ERROR' })
    mockApiFetch.mockRejectedValueOnce(err)
    renderAt('/join/tok-1')
    await waitFor(() => screen.getByText(/通信エラー|network error/i))
  })
})
