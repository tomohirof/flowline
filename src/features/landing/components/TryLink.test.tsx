import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('tryLink CSS visibility', () => {
  const heroCSS = fs.readFileSync(path.resolve(__dirname, 'HeroSection.module.css'), 'utf-8')
  const ctaCSS = fs.readFileSync(path.resolve(__dirname, 'CtaSection.module.css'), 'utf-8')

  it('HeroSection .tryLink should not use white color on white background', () => {
    expect(heroCSS).not.toMatch(/\.tryLink\s*\{[^}]*color:\s*rgba\(255/)
    expect(heroCSS).not.toMatch(/\.tryLink:hover\s*\{[^}]*color:\s*#fff/)
  })

  it('CtaSection .tryLink should not use white color on white background', () => {
    expect(ctaCSS).not.toMatch(/\.tryLink\s*\{[^}]*color:\s*rgba\(255/)
    expect(ctaCSS).not.toMatch(/\.tryLink:hover\s*\{[^}]*color:\s*#fff/)
  })

  it('HeroSection .tryLink should use CSS variables', () => {
    expect(heroCSS).toMatch(/\.tryLink\s*\{[^}]*color:\s*var\(--text-sub\)/)
    expect(heroCSS).toMatch(/\.tryLink:hover\s*\{[^}]*color:\s*var\(--brand\)/)
  })

  it('CtaSection .tryLink should use CSS variables', () => {
    expect(ctaCSS).toMatch(/\.tryLink\s*\{[^}]*color:\s*var\(--text-sub\)/)
    expect(ctaCSS).toMatch(/\.tryLink:hover\s*\{[^}]*color:\s*var\(--brand\)/)
  })
})
