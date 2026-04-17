import type Database from 'better-sqlite3'
import { hashPassword } from '../../api/lib/password'
import { createVerificationToken } from '../../api/lib/jwt'
import { generateId } from '../../api/lib/id'

export interface CreateTestUserOptions {
  email: string
  password: string
  name: string
  emailVerified?: boolean
  role?: 'user' | 'admin'
  aiEnabled?: boolean
  verificationSentAt?: string
  jwtSecret: string
}

export interface TestUser {
  id: string
  email: string
  verificationToken: string
}

/**
 * Insert a user directly into the test sqlite DB. Used because POST /api/auth/register
 * returns 503 during closed beta and can no longer be used as test setup.
 */
export async function createTestUser(
  db: ReturnType<typeof Database>,
  opts: CreateTestUserOptions,
): Promise<TestUser> {
  const id = generateId()
  const passwordHash = await hashPassword(opts.password)
  const verificationToken = await createVerificationToken(id, opts.jwtSecret)
  const verificationSentAt = opts.verificationSentAt ?? new Date().toISOString()

  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, email_verified, verification_token, verification_sent_at, role, ai_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.email.toLowerCase(),
    passwordHash,
    opts.name.trim(),
    opts.emailVerified ? 1 : 0,
    verificationToken,
    verificationSentAt,
    opts.role ?? 'user',
    opts.aiEnabled ? 1 : 0,
  )

  return { id, email: opts.email.toLowerCase(), verificationToken }
}
