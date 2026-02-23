// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../../constants/brand'
import { CtaSection } from './CtaSection'

describe('CtaSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render CTA heading', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(BRAND.ctaHeading)).toBeInTheDocument()
  })

  it('should render CTA subtext', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText(BRAND.ctaSubtext)).toBeInTheDocument()
  })

  it('should render CTA button with primary CTA text', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) }),
    ).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    render(<CtaSection onCtaClick={onCtaClick} />)

    await user.click(
      screen.getByRole('button', { name: new RegExp(BRAND.ctaButtonPrimary.replace('→', '')) }),
    )
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })
})
