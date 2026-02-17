import { Hono } from 'hono'

type Bindings = {
  FLOWLINE_DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

export { app }
export type { Bindings }
