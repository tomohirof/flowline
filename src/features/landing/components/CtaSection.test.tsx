// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../../constants/brand'
import { CtaSection } from './CtaSection'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('CtaSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render CTA heading', () => {
    renderWithRouter(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(BRAND.ctaHeading)).toBeInTheDocument()
  })

  it('should render CTA subtext', () => {
    renderWithRouter(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(BRAND.ctaSubtext)).toBeInTheDocument()
  })

  it('should render CTA button with primary CTA text', () => {
    renderWithRouter(<CtaSection onCtaClick={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) }),
    ).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    renderWithRouter(<CtaSection onCtaClick={onCtaClick} />)

    await user.click(
      screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) }),
    )
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })

  it('should render try-now link with data-testid="cta-try-link"', () => {
    renderWithRouter(<CtaSection onCtaClick={vi.fn()} />)
    const tryLink = screen.getByTestId('cta-try-link')
    expect(tryLink).toBeInTheDocument()
    expect(tryLink).toHaveAttribute('href', '/try')
    expect(tryLink).toHaveTextContent(BRAND.demoTryLink)
  })
})
