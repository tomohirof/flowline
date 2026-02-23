import { Hono } from 'hono'
import type { Bindings } from '../app'

const OGP_WORKER_ORIGIN = 'https://flowline-ogp.tomohirof.workers.dev'

export const ogp = new Hono<{ Bindings: Bindings }>()

ogp.get('/share/:tokenPng', async (c) => {
  const tokenPng = c.req.param('tokenPng')

  try {
    const workerUrl = `${OGP_WORKER_ORIGIN}/share/${encodeURIComponent(tokenPng)}`
    const res = await fetch(workerUrl)

    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': res.headers.get('Cache-Control') || 'public, max-age=86400',
      },
    })
  } catch {
    return c.json({ error: 'OGP Worker への接続に失敗しました' }, 502)
  }
})
