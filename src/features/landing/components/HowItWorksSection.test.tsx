// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HowItWorksSection } from './HowItWorksSection'

describe('HowItWorksSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render title (i18n key)', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('howItWorks.title')).toBeInTheDocument()
  })

  it('should have id="how-it-works" on section element', () => {
    render(<HowItWorksSection />)
    expect(document.getElementById('how-it-works')).toBeInTheDocument()
  })

  it('should render step 1 title (i18n key)', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('howItWorks.step1.title')).toBeInTheDocument()
  })

  it('should render step 2 title (i18n key)', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('howItWorks.step2.title')).toBeInTheDocument()
  })

  it('should render step 3 title (i18n key)', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('howItWorks.step3.title')).toBeInTheDocument()
  })

  it('should render step numbers 1, 2, 3', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
