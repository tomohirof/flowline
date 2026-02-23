// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../../constants/brand'
import { HeroSection } from './HeroSection'

describe('HeroSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with data-testid="hero-section"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('should render heading tagline part 1', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(new RegExp(BRAND.taglinePart1))).toBeInTheDocument()
  })

  it('should render gradient text tagline part 2', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(new RegExp(BRAND.taglinePart2))).toBeInTheDocument()
  })

  it('should render subtext about 業務フロー', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(new RegExp(BRAND.heroSubtext))).toBeInTheDocument()
  })

  it('should render badge with hero badge text', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(new RegExp(BRAND.heroBadge))).toBeInTheDocument()
  })

  it('should render CTA button with primary CTA text', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) })).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    render(<HeroSection onCtaClick={onCtaClick} />)

    await user.click(screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) }))
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })
})
