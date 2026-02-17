// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from './useAuth'

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

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start with loading=true and user=null', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('should set user when /auth/me returns user data', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
  })

  it('should set user to null when /auth/me fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('should call /auth/me on mount', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))

    renderHook(() => useAuth())

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/me')
    })
  })

  it('login should call POST /auth/login and set user', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: login
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth())

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
  })

  it('register should call POST /auth/register and set user', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'New User' }
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: register
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      const user = await result.current.register('test@example.com', 'password123', 'New User')
      expect(user).toEqual(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: 'New User' }),
    })
  })

  it('logout should call POST /auth/logout and clear user', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    // First call: checkAuth returns user
    mockApiFetch.mockResolvedValueOnce({ user: mockUser })
    // Second call: logout
    mockApiFetch.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
  })

  it('login should throw when API returns error', async () => {
    // First call: checkAuth
    mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))
    // Second call: login fails
    mockApiFetch.mockRejectedValueOnce(new Error('Invalid credentials'))

    const { result } = renderHook(() => useAuth())

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
})
