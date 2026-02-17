import { handle } from 'hono/cloudflare-pages'
import { app } from '../api/app'

export const onRequest = handle(app)
