// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FeaturesSection } from './FeaturesSection'

describe('FeaturesSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render section title (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('brand.featuresTitle')).toBeInTheDocument()
  })

  it('should render section subtitle (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('brand.featuresSubtitle')).toBeInTheDocument()
  })

  it('should have id="features" on section element', () => {
    render(<FeaturesSection />)
    expect(document.getElementById('features')).toBeInTheDocument()
  })

  it('should render feature card swimlane (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.swimlane.title')).toBeInTheDocument()
  })

  it('should render feature card smartConnect (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.smartConnect.title')).toBeInTheDocument()
  })

  it('should render feature card realtimeEdit (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.realtimeEdit.title')).toBeInTheDocument()
  })

  it('should render feature card undoRedo (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.undoRedo.title')).toBeInTheDocument()
  })

  it('should render feature card theme (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.theme.title')).toBeInTheDocument()
  })

  it('should render feature card export (i18n key)', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('features.export.title')).toBeInTheDocument()
  })
})
