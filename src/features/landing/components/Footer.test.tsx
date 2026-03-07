// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BRAND } from '../../../constants/brand'
import { Footer } from './Footer'

describe('Footer', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with data-testid="landing-footer"', () => {
    render(<Footer />)
    expect(screen.getByTestId('landing-footer')).toBeInTheDocument()
  })

  it('should render logo "Flowline"', () => {
    render(<Footer />)
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
  })

  it('should render copyright text', () => {
    render(<Footer />)
    expect(screen.getByText(BRAND.copyright)).toBeInTheDocument()
  })

  it('should render privacy link (i18n key)', () => {
    render(<Footer />)
    expect(screen.getByText('footer.privacy')).toBeInTheDocument()
  })

  it('should render terms link (i18n key)', () => {
    render(<Footer />)
    expect(screen.getByText('footer.terms')).toBeInTheDocument()
  })

  it('should render contact link (i18n key)', () => {
    render(<Footer />)
    expect(screen.getByText('footer.contact')).toBeInTheDocument()
  })

  it('should use button elements for links', () => {
    render(<Footer />)
    expect(screen.getByText('footer.privacy').tagName).toBe('BUTTON')
    expect(screen.getByText('footer.terms').tagName).toBe('BUTTON')
    expect(screen.getByText('footer.contact').tagName).toBe('BUTTON')
  })
})
