// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { HeroSection } from './HeroSection'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HeroSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with data-testid="hero-section"', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('should render heading tagline part 1 (i18n key)', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText('brand.taglinePart1')).toBeInTheDocument()
  })

  it('should render gradient text tagline part 2 (i18n key)', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText('brand.taglinePart2')).toBeInTheDocument()
  })

  it('should render subtext (i18n key)', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(/brand\.heroSubtext/)).toBeInTheDocument()
  })

  it('should render badge with hero badge text (i18n key)', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText('brand.heroBadge')).toBeInTheDocument()
  })

  it('should render CTA button with primary CTA text (i18n key)', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'brand.ctaButtonPrimary' })).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    renderWithRouter(<HeroSection onCtaClick={onCtaClick} />)

    await user.click(screen.getByRole('button', { name: 'brand.ctaButtonPrimary' }))
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })

  it('should render try-now link with data-testid="try-link"', () => {
    renderWithRouter(<HeroSection onCtaClick={vi.fn()} />)
    const tryLink = screen.getByTestId('try-link')
    expect(tryLink).toBeInTheDocument()
    expect(tryLink).toHaveAttribute('href', '/try')
    expect(tryLink).toHaveTextContent('demoTryLink')
  })
})
