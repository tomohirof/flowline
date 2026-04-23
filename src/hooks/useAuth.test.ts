// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth, AuthProvider } from './useAuth'
import type { ReactNode } from 'react'

// Mock the api module
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { apiFetch } from '../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

function wrapper({ children }: { children: ReactNode }) {
  return AuthProvider({ children })
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start with loading=true and user=null', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('should set user when /auth/me returns user data with role and aiEnabled', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      aiEnabled: false,
    }
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.user?.role).toBe('user')
    expect(result.current.user?.aiEnabled).toBe(false)
  })

  it('should set user to null when /auth/me fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('should call /auth/me on mount', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))

    renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/me')
    })
  })

  it('login should call POST /auth/login then GET /auth/me and set user', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      aiEnabled: true,
    }
    // First call: checkAuth on mount
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: POST /auth/login
    mockApiFetch.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
    })
    // Third call: GET /auth/me (after login to get full user data)
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      const user = await result.current.login('test@example.com', 'password123')
      expect(user).toEqual(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    })
    // Verify /auth/me was called after login
    expect(mockApiFetch).toHaveBeenLastCalledWith('/auth/me')
  })

  it('register should call POST /auth/register and return RegisterResult', async () => {
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: register
    mockApiFetch.mockResolvedValueOnce({ message: 'Verification email sent' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      const registerResult = await result.current.register(
        'test@example.com',
        'password123',
        'New User',
        'INVITE42',
      )
      expect(registerResult).toEqual({ needsVerification: true, email: 'test@example.com' })
    })

    // User should NOT be set after registration (needs email verification)
    expect(result.current.user).toBeNull()
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'New User',
        invitationCode: 'INVITE42',
      }),
    })
  })

  it('resendVerification should call POST /auth/resend-verification', async () => {
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: resendVerification
    mockApiFetch.mockResolvedValueOnce({ message: 'Verification email resent' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.resendVerification('test@example.com')
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })
  })

  it('logout should call POST /auth/logout and clear user', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      aiEnabled: false,
    }
    // First call: checkAuth returns user
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })
    // Second call: logout
    mockApiFetch.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
  })

  it('refreshAuth should re-fetch /auth/me and update user', async () => {
    // First call: checkAuth - no user
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: refreshAuth - user now exists (e.g. after verify set cookie)
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      aiEnabled: true,
    }
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).toBeNull()

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.user?.role).toBe('admin')
    expect(result.current.user?.aiEnabled).toBe(true)
    expect(mockApiFetch).toHaveBeenLastCalledWith('/auth/me')
  })

  it('login should throw when API returns error', async () => {
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: login fails
    mockApiFetch.mockRejectedValueOnce(new Error('Invalid credentials'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await expect(
      act(async () => {
        await result.current.login('bad@example.com', 'wrong')
      }),
    ).rejects.toThrow('Invalid credentials')

    expect(result.current.user).toBeNull()
  })

  describe('register', () => {
    it('sends invitationCode in request body and returns needsVerification', async () => {
      // Initial /auth/me call resolves with null user (not logged in)
      mockApiFetch.mockResolvedValueOnce({ user: null })
      // register call response
      mockApiFetch.mockResolvedValueOnce({ message: 'ok' })

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      let res: { needsVerification: boolean; email: string } | undefined
      await act(async () => {
        res = await result.current.register(
          'new@example.com',
          'password123',
          'New User',
          'VALIDC01',
        )
      })

      expect(res).toEqual({ needsVerification: true, email: 'new@example.com' })

      const registerCall = mockApiFetch.mock.calls.find(([path]) => path === '/auth/register')
      expect(registerCall).toBeTruthy()
      const body = JSON.parse((registerCall![1] as RequestInit).body as string)
      expect(body).toEqual({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        invitationCode: 'VALIDC01',
      })
    })
  })
})
