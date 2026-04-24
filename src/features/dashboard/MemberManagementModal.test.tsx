// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemberManagementModal } from './MemberManagementModal'
import '../../i18n'

const mockApiFetch = vi.fn()
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api')
  return { ...actual, apiFetch: (...a: unknown[]) => mockApiFetch(...a) }
})

function ownerMembersResponse() {
  return {
    owner: { id: 'u-owner', email: 'o@x.com', name: 'Owner' },
    editors: [
      { id: 'u-editor', email: 'e@x.com', name: 'Editor', joinedAt: '2026-04-24T00:00:00Z' },
    ],
  }
}

describe('MemberManagementModal', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('owner view: shows invite-link section and remove button for each editor', async () => {
    mockApiFetch.mockResolvedValueOnce(ownerMembersResponse())
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    expect(screen.getByTestId('invite-link-section')).toBeInTheDocument()
    expect(screen.getByTestId('remove-btn-u-editor')).toBeInTheDocument()
  })

  it('editor view: hides invite-link and remove buttons', async () => {
    mockApiFetch.mockResolvedValueOnce(ownerMembersResponse())
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-editor"
        isOwner={false}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    expect(screen.queryByTestId('invite-link-section')).toBeNull()
    expect(screen.queryByTestId(/^remove-btn-/)).toBeNull()
  })

  it('owner: generate invite link displays URL after API response', async () => {
    mockApiFetch
      .mockResolvedValueOnce(ownerMembersResponse())
      .mockResolvedValueOnce({ inviteToken: 'tok-abc', inviteUrl: 'https://x/join/tok-abc' })
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Owner'))
    fireEvent.click(screen.getByTestId('generate-invite-link-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('invite-url')).toHaveTextContent('https://x/join/tok-abc'),
    )
  })

  it('owner: remove-btn triggers confirm then DELETE call', async () => {
    mockApiFetch
      .mockResolvedValueOnce(ownerMembersResponse())
      .mockResolvedValueOnce(undefined) // DELETE response
      .mockResolvedValueOnce({
        owner: { id: 'u-owner', email: 'o@x.com', name: 'Owner' },
        editors: [],
      })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemberManagementModal
        projectId="p-1"
        currentUserId="u-owner"
        isOwner={true}
        onClose={() => {}}
      />,
    )
    await waitFor(() => screen.getByText('Editor'))
    fireEvent.click(screen.getByTestId('remove-btn-u-editor'))
    await waitFor(() => {
      const deleteCall = mockApiFetch.mock.calls.find(
        ([path, init]) =>
          path === '/projects/p-1/members/u-editor' && (init as RequestInit)?.method === 'DELETE',
      )
      expect(deleteCall).toBeTruthy()
    })
    confirmSpy.mockRestore()
  })
})
