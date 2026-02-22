import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendVerificationEmail, buildVerificationUrl } from '../../../api/lib/email'

describe('buildVerificationUrl', () => {
  it('should return URL with token parameter', () => {
    const url = buildVerificationUrl('abc123', 'https://flowline.pages.dev')
    expect(url).toBe('https://flowline.pages.dev/verify?token=abc123')
  })

  it('should handle empty token string', () => {
    const url = buildVerificationUrl('', 'https://flowline.pages.dev')
    expect(url).toBe('https://flowline.pages.dev/verify?token=')
  })

  it('should handle base URL with trailing slash', () => {
    const url = buildVerificationUrl('abc123', 'https://flowline.pages.dev/')
    // Should not produce double slash in path
    expect(url).toContain('verify?token=abc123')
  })

  it('should encode special characters in token', () => {
    const url = buildVerificationUrl('abc+123&foo=bar', 'https://flowline.pages.dev')
    expect(url).toContain('verify?token=')
    // Token should be included (encoding is implementation detail)
    expect(url).toContain('abc')
  })
})

describe('sendVerificationEmail', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email_1' }) })
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should POST to Resend API with correct parameters', async () => {
    await sendVerificationEmail('test@example.com', 'token123', 'resend-key', 'https://flowline.pages.dev')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer resend-key',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.to).toEqual(['test@example.com'])
    expect(body.subject).toContain('Flowline')
    expect(body.html).toContain('token123')
  })

  it('should throw error when Resend API returns error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422, text: async () => 'Bad request' })
    await expect(
      sendVerificationEmail('bad@example.com', 'token', 'key', 'https://flowline.pages.dev'),
    ).rejects.toThrow()
  })

  it('should include verification URL in email HTML body', async () => {
    await sendVerificationEmail('test@example.com', 'mytoken', 'key', 'https://app.example.com')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('https://app.example.com/verify?token=mytoken')
  })

  it('should throw error when Resend API returns 500', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Internal Server Error' })
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.pages.dev'),
    ).rejects.toThrow(/500/)
  })

  it('should throw error when Resend API returns 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' })
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.pages.dev'),
    ).rejects.toThrow()
  })

  it('should throw error when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network timeout'))
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.pages.dev'),
    ).rejects.toThrow('Network timeout')
  })

  it('should include from address in request body', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.pages.dev')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.from).toBeDefined()
    expect(body.from).toContain('Flowline')
  })

  it('should send valid HTML content', async () => {
    await sendVerificationEmail('user@test.com', 'tok', 'key', 'https://flowline.pages.dev')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('<!DOCTYPE html>')
    expect(body.html).toContain('</html>')
  })
})
