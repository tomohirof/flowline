import { sign, verify } from 'hono/jwt'

const EXPIRATION_SECONDS = 7 * 24 * 60 * 60 // 7 days

export interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export async function createToken(userId: string, email: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({ sub: userId, email, iat: now, exp: now + EXPIRATION_SECONDS }, secret)
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const payload = await verify(token, secret, 'HS256')
  return payload as unknown as JwtPayload
}

const VERIFY_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours

export interface VerificationPayload {
  sub: string
  purpose: 'email-verify'
  iat: number
  exp: number
}

export async function createVerificationToken(userId: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign(
    { sub: userId, purpose: 'email-verify', iat: now, exp: now + VERIFY_EXPIRATION_SECONDS },
    secret,
  )
}

export async function verifyVerificationToken(
  token: string,
  secret: string,
): Promise<VerificationPayload> {
  const payload = await verify(token, secret, 'HS256')
  const p = payload as unknown as VerificationPayload
  if (p.purpose !== 'email-verify') {
    throw new Error('Invalid token purpose')
  }
  return p
}
