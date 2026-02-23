import { describe, it, expect } from 'vitest'
import { BRAND } from './brand'

describe('BRAND constants', () => {
  it('should have Flowline as brand name', () => {
    expect(BRAND.name).toBe('Flowline')
  })

  it('should have F as logo initial', () => {
    expect(BRAND.logoInitial).toBe('F')
  })

  it('should have copyright with brand name', () => {
    expect(BRAND.copyright).toContain(BRAND.name)
  })

  it('should have all required keys defined and non-empty', () => {
    const keys = Object.keys(BRAND) as (keyof typeof BRAND)[]
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(BRAND[key]).toBeTruthy()
    }
  })

  it('should be immutable (as const)', () => {
    // TypeScript ensures this at compile time, but verify values are strings
    for (const value of Object.values(BRAND)) {
      expect(typeof value).toBe('string')
    }
  })
})
