// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, ApiError } from './api'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return parsed JSON data when response is ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: '1', name: 'Test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const data = await apiFetch<{ user: { id: string; name: string } }>('/auth/me')
    expect(data).toEqual({ user: { id: '1', name: 'Test' } })
  })

  it('should prepend /api to the path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/auth/me')
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', expect.any(Object))
  })

  it('should set Content-Type header to application/json', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/auth/me')
    const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit
    expect(calledOptions.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json' }),
    )
  })

  it('should pass additional options to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })

    const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify({ email: 'test@example.com' }))
  })

  it('should throw ApiError with status and message when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'メールアドレスまたはパスワードが正しくありません' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    try {
      await apiFetch('/auth/login')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(401)
      expect((e as ApiError).message).toBe('メールアドレスまたはパスワードが正しくありません')
    }
  })

  it('should use default error message when error field is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    try {
      await apiFetch('/auth/me')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(500)
      expect((e as ApiError).message).toBe('エラーが発生しました')
    }
  })

  it('should merge custom headers with default Content-Type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/auth/me', {
      headers: { Authorization: 'Bearer token123' },
    })

    const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit
    expect(calledOptions.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      }),
    )
  })
})

describe('ApiError', () => {
  it('should be an instance of Error', () => {
    const err = new ApiError(404, 'Not found')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('should have status and message properties', () => {
    const err = new ApiError(403, 'Forbidden')
    expect(err.status).toBe(403)
    expect(err.message).toBe('Forbidden')
  })
})
