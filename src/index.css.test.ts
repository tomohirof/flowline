import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

describe('index.css global styles', () => {
  it('should not have body flex centering that prevents full-width layout', () => {
    const css = readFileSync(resolve(__dirname, './index.css'), 'utf8')
    expect(css).not.toContain('place-items: center')
    expect(css).not.toContain('place-items:center')
  })

  it('should set #root to full width', () => {
    const css = readFileSync(resolve(__dirname, './index.css'), 'utf8')
    expect(css).toMatch(/#root\s*\{[^}]*width:\s*100%/)
  })
})
