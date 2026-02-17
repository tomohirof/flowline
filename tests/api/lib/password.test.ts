import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../../api/lib/password'

describe('Password Utility', () => {
  it('should hash a password and return a bcrypt hash string', async () => {
    const hash = await hashPassword('password123')
    expect(hash).toBeDefined()
    expect(hash).not.toBe('password123')
    expect(hash).toMatch(/^\$2[aby]?\$/)
  })

  it('should verify correct password against hash', async () => {
    const hash = await hashPassword('password123')
    const result = await verifyPassword('password123', hash)
    expect(result).toBe(true)
  })

  it('should reject incorrect password against hash', async () => {
    const hash = await hashPassword('password123')
    const result = await verifyPassword('wrongpassword', hash)
    expect(result).toBe(false)
  })

  it('should generate different hashes for the same password', async () => {
    const hash1 = await hashPassword('password123')
    const hash2 = await hashPassword('password123')
    expect(hash1).not.toBe(hash2)
  })

  it('should handle empty string password', async () => {
    const hash = await hashPassword('')
    expect(hash).toBeDefined()
    const result = await verifyPassword('', hash)
    expect(result).toBe(true)
  })
})
