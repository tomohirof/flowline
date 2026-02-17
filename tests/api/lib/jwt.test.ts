import { describe, it, expect } from 'vitest'
import { createToken, verifyToken } from '../../../api/lib/jwt'

const TEST_SECRET = 'test-secret-key-for-testing-only'

describe('JWT Utility', () => {
  // --- 正常系 ---
  it('should create a valid JWT token', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('should verify a valid token and return payload', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    const payload = await verifyToken(token, TEST_SECRET)
    expect(payload.sub).toBe('user-123')
    expect(payload.email).toBe('test@example.com')
    expect(payload.iat).toBeDefined()
    expect(payload.exp).toBeDefined()
  })

  it('should set expiration to 7 days from now', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    const payload = await verifyToken(token, TEST_SECRET)
    const sevenDaysInSeconds = 7 * 24 * 60 * 60
    expect(payload.exp - payload.iat).toBe(sevenDaysInSeconds)
  })

  // --- 異常系: 不正なシークレット ---
  it('should reject token with wrong secret', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow()
  })

  // --- 異常系: 不正なトークン文字列 ---
  it('should reject invalid token string', async () => {
    await expect(verifyToken('invalid.token.string', TEST_SECRET)).rejects.toThrow()
  })

  // --- エッジケース: 空文字列 ---
  it('should reject empty token string', async () => {
    await expect(verifyToken('', TEST_SECRET)).rejects.toThrow()
  })

  // --- エッジケース: 空のシークレットでトークン検証 ---
  it('should reject verification with empty secret', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    await expect(verifyToken(token, '')).rejects.toThrow()
  })

  // --- エッジケース: 異なるユーザーで作成したトークンが正しいペイロードを返す ---
  it('should preserve different user data in separate tokens', async () => {
    const token1 = await createToken('user-1', 'alice@example.com', TEST_SECRET)
    const token2 = await createToken('user-2', 'bob@example.com', TEST_SECRET)

    const payload1 = await verifyToken(token1, TEST_SECRET)
    const payload2 = await verifyToken(token2, TEST_SECRET)

    expect(payload1.sub).toBe('user-1')
    expect(payload1.email).toBe('alice@example.com')
    expect(payload2.sub).toBe('user-2')
    expect(payload2.email).toBe('bob@example.com')
  })

  // --- エッジケース: 改ざんされたトークン ---
  it('should reject a tampered token', async () => {
    const token = await createToken('user-123', 'test@example.com', TEST_SECRET)
    const parts = token.split('.')
    // ペイロード部分を改ざん
    parts[1] = parts[1] + 'tampered'
    const tamperedToken = parts.join('.')
    await expect(verifyToken(tamperedToken, TEST_SECRET)).rejects.toThrow()
  })
})
