// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  afterEach(() => {
    cleanup()
  })

  const renderPage = () =>
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

  it('Navbarを表示する', () => {
    renderPage()
    expect(screen.getByTestId('landing-navbar')).toBeInTheDocument()
  })

  it('HeroSectionを表示する', () => {
    renderPage()
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('ProductPreviewを表示する', () => {
    renderPage()
    expect(screen.getByTestId('product-preview')).toBeInTheDocument()
  })

  it('FeaturesSectionを表示する', () => {
    renderPage()
    expect(document.getElementById('features')).toBeInTheDocument()
  })

  it('HowItWorksSectionを表示する', () => {
    renderPage()
    expect(document.getElementById('how-it-works')).toBeInTheDocument()
  })

  it('Footerを表示する', () => {
    renderPage()
    expect(screen.getByTestId('landing-footer')).toBeInTheDocument()
  })
})
