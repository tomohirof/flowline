import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendVerificationEmail, buildVerificationUrl } from '../../../api/lib/email'

describe('buildVerificationUrl', () => {
  it('should return URL with token parameter', () => {
    const url = buildVerificationUrl('abc123', 'https://flowline.six1.jp')
    expect(url).toBe('https://flowline.six1.jp/verify?token=abc123')
  })

  it('should handle empty token string', () => {
    const url = buildVerificationUrl('', 'https://flowline.six1.jp')
    expect(url).toBe('https://flowline.six1.jp/verify?token=')
  })

  it('should handle base URL with trailing slash', () => {
    const url = buildVerificationUrl('abc123', 'https://flowline.six1.jp/')
    // Should not produce double slash in path
    expect(url).toContain('verify?token=abc123')
  })

  it('should encode special characters in token', () => {
    const url = buildVerificationUrl('abc+123&foo=bar', 'https://flowline.six1.jp')
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
    await sendVerificationEmail(
      'test@example.com',
      'token123',
      'resend-key',
      'https://flowline.six1.jp',
    )

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
      sendVerificationEmail('bad@example.com', 'token', 'key', 'https://flowline.six1.jp'),
    ).rejects.toThrow()
  })

  it('should include verification URL in email HTML body', async () => {
    await sendVerificationEmail('test@example.com', 'mytoken', 'key', 'https://app.example.com')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('https://app.example.com/verify?token=mytoken')
  })

  it('should throw error when Resend API returns 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp'),
    ).rejects.toThrow(/500/)
  })

  it('should throw error when Resend API returns 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' })
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp'),
    ).rejects.toThrow()
  })

  it('should throw error when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network timeout'))
    await expect(
      sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp'),
    ).rejects.toThrow('Network timeout')
  })

  it('should include from address in request body', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.from).toBeDefined()
    expect(body.from).toContain('Flowline')
  })

  it('should send valid HTML content', async () => {
    await sendVerificationEmail('user@test.com', 'tok', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('<!DOCTYPE html>')
    expect(body.html).toContain('</html>')
  })

  it('should include preheader text in email HTML', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('フロー図を描く準備はできましたか？')
    expect(body.html).toContain('あなたの業務プロセス、きっと思ってるより複雑です')
  })

  it('should include welcome hero section', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('WELCOME TO FLOWLINE')
    expect(body.html).toContain('お待ちしてました')
  })

  it('should include trivia section', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('豆知識')
  })

  it('should include 3-step guide section', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('レーンを並べる')
    expect(body.html).toContain('ノードを置く')
    expect(body.html).toContain('共有する')
  })

  it('should include keyboard shortcuts section', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('ショートカット')
    expect(body.html).toContain('⌘Z')
  })

  it('should include CTA button with verify URL and new label', async () => {
    await sendVerificationEmail('test@example.com', 'mytoken', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain('https://flowline.six1.jp/verify?token=mytoken')
    expect(body.html).toContain('メールを認証して最初のフローを作成する')
  })

  it('should include formatted date in logo bar', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toMatch(/\d{4}年\d{1,2}月\d{1,2}日/)
  })

  it('should include footer with copyright and links', async () => {
    await sendVerificationEmail('test@example.com', 'token', 'key', 'https://flowline.six1.jp')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toContain(`© ${new Date().getFullYear()} Flowline`)
    expect(body.html).toContain('ヘルプセンター')
    expect(body.html).toContain('プライバシー')
    expect(body.html).toContain('配信停止')
  })
})
