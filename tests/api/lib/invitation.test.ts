import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import {
  normalizeInvitationCode,
  validateInvitationCode,
  generateInvitationCode,
  CODE_CHARSET,
} from '../../../api/lib/invitation'

describe('normalizeInvitationCode', () => {
  it('uppercases lowercase characters', () => {
    expect(normalizeInvitationCode('abc123')).toBe('ABC123')
  })
  it('removes all whitespace', () => {
    expect(normalizeInvitationCode(' a b c\t1\n2 3 ')).toBe('ABC123')
  })
  it('returns empty string for all-whitespace input', () => {
    expect(normalizeInvitationCode('   ')).toBe('')
  })
  it('returns empty string for empty input', () => {
    expect(normalizeInvitationCode('')).toBe('')
  })
})

describe('generateInvitationCode', () => {
  it('returns an 8-character string', () => {
    expect(generateInvitationCode()).toHaveLength(8)
  })
  it('uses only characters from CODE_CHARSET', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInvitationCode()
      for (const ch of code) {
        expect(CODE_CHARSET).toContain(ch)
      }
    }
  })
  it('does not include confusing characters (0, O, 1, I, L)', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateInvitationCode()).not.toMatch(/[0O1IL]/)
    }
  })
  it('produces different codes on successive calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) codes.add(generateInvitationCode())
    expect(codes.size).toBeGreaterThan(18)
  })
})

describe('validateInvitationCode', () => {
  let db: ReturnType<typeof Database>
  let d1: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createTestDb()
    d1 = createMockD1(db)
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role)
       VALUES ('admin-1', 'admin@example.com', 'hash', 'Admin', 'admin')`,
    ).run()
  })
  afterEach(() => db.close())

  function insertCode(code: string, opts: { expiresAt?: string; revokedAt?: string | null } = {}) {
    const expiresAt = opts.expiresAt ?? '2099-01-01T00:00:00Z'
    const revokedAt = opts.revokedAt ?? null
    db.prepare(
      `INSERT INTO invitation_codes (code, expires_at, revoked_at, created_by)
       VALUES (?, ?, ?, 'admin-1')`,
    ).run(code, expiresAt, revokedAt)
  }

  it('returns true for active, not-revoked, not-expired code', async () => {
    insertCode('ABCDEFGH')
    expect(await validateInvitationCode(d1, 'ABCDEFGH')).toBe(true)
  })
  it('returns false for expired code', async () => {
    insertCode('EXPIRED1', { expiresAt: '2000-01-01T00:00:00Z' })
    expect(await validateInvitationCode(d1, 'EXPIRED1')).toBe(false)
  })
  it('returns false for revoked code', async () => {
    insertCode('REVOKED1', { revokedAt: '2026-01-01T00:00:00Z' })
    expect(await validateInvitationCode(d1, 'REVOKED1')).toBe(false)
  })
  it('returns false for non-existent code', async () => {
    expect(await validateInvitationCode(d1, 'NOSUCH99')).toBe(false)
  })
  it('returns true after normalizing mixed-case + whitespace input', async () => {
    insertCode('ABCDEFGH')
    expect(await validateInvitationCode(d1, ' abc defgh ')).toBe(true)
  })
  it('returns false for empty input', async () => {
    expect(await validateInvitationCode(d1, '')).toBe(false)
  })
  it('returns false for whitespace-only input', async () => {
    expect(await validateInvitationCode(d1, '   ')).toBe(false)
  })
})
