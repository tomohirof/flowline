import { describe, it, expect } from 'vitest'
import { app } from './app'

describe('API Health Check', () => {
  it('should return status ok with 200 when GET /api/health', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('should return JSON content-type when GET /api/health', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/api/unknown')
    expect(res.status).toBe(404)
  })

  it('should return 404 for root path without /api prefix', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(404)
  })
})
