// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeroSection } from './HeroSection'

describe('HeroSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with data-testid="hero-section"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('should render heading "フローを描く。"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(/フローを描く。/)).toBeInTheDocument()
  })

  it('should render gradient text "チームが動く。"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(/チームが動く。/)).toBeInTheDocument()
  })

  it('should render subtext about 業務フロー', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(/業務フローの設計・可視化・共有/)).toBeInTheDocument()
  })

  it('should render badge with "無料で使える"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(/無料で使える/)).toBeInTheDocument()
  })

  it('should render CTA button "無料で始める →"', () => {
    render(<HeroSection onCtaClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /無料で始める/ })).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    render(<HeroSection onCtaClick={onCtaClick} />)

    await user.click(screen.getByRole('button', { name: /無料で始める/ }))
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })
})
