// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
    expect(screen.getByText('Flowline')).toBeInTheDocument()
  })

  it('should render copyright text', () => {
    render(<Footer />)
    expect(screen.getByText(/2026 Flowline/)).toBeInTheDocument()
  })

  it('should render link "プライバシーポリシー"', () => {
    render(<Footer />)
    expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
  })

  it('should render link "利用規約"', () => {
    render(<Footer />)
    expect(screen.getByText('利用規約')).toBeInTheDocument()
  })

  it('should render link "お問い合わせ"', () => {
    render(<Footer />)
    expect(screen.getByText('お問い合わせ')).toBeInTheDocument()
  })

  it('should use button elements for links', () => {
    render(<Footer />)
    expect(screen.getByText('プライバシーポリシー').tagName).toBe('BUTTON')
    expect(screen.getByText('利用規約').tagName).toBe('BUTTON')
    expect(screen.getByText('お問い合わせ').tagName).toBe('BUTTON')
  })
})
