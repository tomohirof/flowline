import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { app } from '../../../api/app'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

const JWT_SECRET = 'test-secret-key'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return { FLOWLINE_DB: createMockD1(sqliteDb), JWT_SECRET }
}

describe('OGP Proxy Route', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  const VALID_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  describe('GET /api/ogp/share/:tokenPng', () => {
    it('should proxy PNG response from OGP Worker', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          },
        }),
      )

      const res = await app.request('/api/ogp/share/abc123.png', {}, env)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    })

    it('should set X-Robots-Tag noindex header on proxied OGP image (issue #342)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )

      const res = await app.request('/api/ogp/share/abc123.png', {}, env)
      expect(res.status).toBe(200)
      const robotsTag = res.headers.get('x-robots-tag')
      expect(robotsTag).toBeTruthy()
      expect(robotsTag).toMatch(/noindex/i)
      expect(robotsTag).toMatch(/nofollow/i)
    })

    it('should forward 404 from OGP Worker for non-existent token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: '共有フローが見つかりません' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const res = await app.request('/api/ogp/share/nonexistent.png', {}, env)
      expect(res.status).toBe(404)
    })

    it('should forward 500 from OGP Worker', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'OGP画像の生成に失敗しました' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const res = await app.request('/api/ogp/share/error.png', {}, env)
      expect(res.status).toBe(500)
    })

    it('should call OGP Worker with correct URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )

      await app.request('/api/ogp/share/my-token.png', {}, env)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const calledUrl = fetchSpy.mock.calls[0][0]
      expect(calledUrl).toContain('/share/my-token.png')
    })

    it('should return 502 when OGP Worker is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const res = await app.request('/api/ogp/share/abc.png', {}, env)
      expect(res.status).toBe(502)
    })

    it('should not require authentication', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )

      // No auth cookie
      const res = await app.request('/api/ogp/share/public.png', {}, env)
      expect(res.status).toBe(200)
    })

    it('should handle token without .png extension', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )

      const res = await app.request('/api/ogp/share/abc123', {}, env)
      expect(res.status).toBe(200)
    })

    it('should encode special characters in token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(VALID_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )

      await app.request('/api/ogp/share/tok%20en.png', {}, env)

      const calledUrl = fetchSpy.mock.calls[0][0]
      // Token should be passed through (already URL-encoded by client)
      expect(calledUrl).toContain('/share/tok%20en.png')
    })
  })
})
