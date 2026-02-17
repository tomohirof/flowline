import { Hono } from 'hono'
import { auth } from './routes/auth'

type Bindings = {
  FLOWLINE_DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/auth', auth)

export { app }
export type { Bindings }
