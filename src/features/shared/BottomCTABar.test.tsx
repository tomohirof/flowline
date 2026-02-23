// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../constants/brand'
import { BottomCTABar } from './BottomCTABar'

describe('BottomCTABar', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render bar when visible is true', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('bottom-cta-bar')).toBeInTheDocument()
  })

  it('should not render bar when visible is false', () => {
    render(<BottomCTABar visible={false} onClose={vi.fn()} />)
    expect(screen.queryByTestId('bottom-cta-bar')).not.toBeInTheDocument()
  })

  it('should display Flowline logo', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText(BRAND.logoInitial)).toBeInTheDocument()
  })

  it('should display CTA heading text', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText(BRAND.sharedCreateCta)).toBeInTheDocument()
  })

  it('should display sub text', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText(BRAND.sharedCtaFeatures)).toBeInTheDocument()
  })

  it('should have CTA link pointing to /?auth=register', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: BRAND.ctaButtonShared })
    expect(link).toHaveAttribute('href', '/?auth=register')
  })

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<BottomCTABar visible={true} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('bottom-cta-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should have aria-label on close button for accessibility', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('bottom-cta-close')).toHaveAttribute('aria-label', '閉じる')
  })
})
