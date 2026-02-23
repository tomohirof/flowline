import { Hono } from 'hono'
import { auth } from './routes/auth'
import { flows } from './routes/flows'
import { shared } from './routes/shared'
import { settings } from './routes/settings'
import { admin } from './routes/admin'
import { ai } from './routes/ai'
import { ogp } from './routes/ogp'

type Bindings = {
  FLOWLINE_DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  ANTHROPIC_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/auth', auth)
app.route('/flows', flows)
app.route('/shared', shared)
app.route('/settings', settings)
app.route('/admin', admin)
app.route('/ai', ai)
app.route('/ogp', ogp)

export type AuthEnv = {
  Bindings: Bindings
  Variables: { userId: string; userRole: string }
}

export { app }
export type { Bindings }
