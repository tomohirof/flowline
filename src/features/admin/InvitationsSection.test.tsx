// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { InvitationsSection } from './InvitationsSection'
import '../../i18n'

const mockApiFetch = vi.fn()
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, apiFetch: (...args: unknown[]) => mockApiFetch(...args) }
})

describe('InvitationsSection', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })
  afterEach(cleanup)

  it('renders empty state when no invitations', async () => {
    mockApiFetch.mockResolvedValueOnce({ invitations: [] })
    render(<InvitationsSection />)
    await waitFor(() => expect(screen.getByTestId('invitations-empty')).toBeInTheDocument())
  })

  it('renders invitations with status badges', async () => {
    mockApiFetch.mockResolvedValueOnce({
      invitations: [
        {
          id: 1,
          code: 'ACTIVE01',
          expiresAt: '2099-01-01T00:00:00Z',
          revokedAt: null,
          createdAt: '2026-04-23T00:00:00Z',
          createdBy: 'admin-1',
          status: 'active',
        },
        {
          id: 2,
          code: 'EXPIRED1',
          expiresAt: '2000-01-01T00:00:00Z',
          revokedAt: null,
          createdAt: '2026-04-22T00:00:00Z',
          createdBy: 'admin-1',
          status: 'expired',
        },
        {
          id: 3,
          code: 'REVOKED1',
          expiresAt: '2099-01-01T00:00:00Z',
          revokedAt: '2026-04-21T00:00:00Z',
          createdAt: '2026-04-20T00:00:00Z',
          createdBy: 'admin-1',
          status: 'revoked',
        },
      ],
    })
    render(<InvitationsSection />)
    await waitFor(() => expect(screen.getByText('ACTIVE01')).toBeInTheDocument())
    expect(screen.getByText('EXPIRED1')).toBeInTheDocument()
    expect(screen.getByText('REVOKED1')).toBeInTheDocument()
    // revoke button only on active
    expect(screen.getByTestId('revoke-btn-1')).toBeInTheDocument()
    expect(screen.queryByTestId('revoke-btn-2')).toBeNull()
    expect(screen.queryByTestId('revoke-btn-3')).toBeNull()
  })

  it('issues a code via modal and displays it after success', async () => {
    mockApiFetch
      .mockResolvedValueOnce({ invitations: [] }) // initial load
      .mockResolvedValueOnce({
        // POST /admin/invitations
        id: 3,
        code: 'NEWCOD01',
        expiresAt: '2099-01-01T00:00:00Z',
        revokedAt: null,
        createdAt: '2026-04-23T00:00:00Z',
        createdBy: 'admin-1',
      })
      .mockResolvedValueOnce({ invitations: [] }) // re-fetch after issue

    render(<InvitationsSection />)
    await waitFor(() => screen.getByTestId('invitations-create-btn'))
    fireEvent.click(screen.getByTestId('invitations-create-btn'))
    fireEvent.click(screen.getByTestId('preset-7'))
    fireEvent.click(screen.getByTestId('invitations-issue-btn'))

    await waitFor(() => expect(screen.getByTestId('issued-code')).toHaveTextContent('NEWCOD01'))

    // POST body check
    const postCall = mockApiFetch.mock.calls.find(
      ([path, init]) => path === '/admin/invitations' && (init as RequestInit)?.method === 'POST',
    )
    expect(postCall).toBeTruthy()
    const body = JSON.parse((postCall![1] as RequestInit).body as string)
    expect(body).toEqual({ expiresInDays: 7 })
  })

  it('revokes an active code after confirm', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        invitations: [
          {
            id: 1,
            code: 'ACTIVE01',
            expiresAt: '2099-01-01T00:00:00Z',
            revokedAt: null,
            createdAt: '2026-04-23T00:00:00Z',
            createdBy: 'admin-1',
            status: 'active',
          },
        ],
      })
      .mockResolvedValueOnce({ id: 1, revokedAt: '2026-04-23T01:00:00Z' }) // POST revoke
      .mockResolvedValueOnce({ invitations: [] }) // re-fetch

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<InvitationsSection />)
    await waitFor(() => screen.getByTestId('revoke-btn-1'))
    fireEvent.click(screen.getByTestId('revoke-btn-1'))

    await waitFor(() => {
      const revokeCall = mockApiFetch.mock.calls.find(
        ([path, init]) =>
          path === '/admin/invitations/1/revoke' && (init as RequestInit)?.method === 'POST',
      )
      expect(revokeCall).toBeTruthy()
    })
    confirmSpy.mockRestore()
  })

  it('shows load error when GET fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('boom'))
    render(<InvitationsSection />)
    await waitFor(() => expect(screen.getByTestId('invitations-error')).toBeInTheDocument())
  })
})
