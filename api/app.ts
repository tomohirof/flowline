import { Hono } from 'hono'
import { auth } from './routes/auth'
import { flows } from './routes/flows'

type Bindings = {
  FLOWLINE_DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/auth', auth)
app.route('/flows', flows)

export type AuthEnv = {
  Bindings: Bindings
  Variables: { userId: string }
}

export { app }
export type { Bindings }
