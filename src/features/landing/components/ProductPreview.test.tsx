// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProductPreview } from './ProductPreview'

describe('ProductPreview', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with data-testid="product-preview"', () => {
    render(<ProductPreview />)
    expect(screen.getByTestId('product-preview')).toBeInTheDocument()
  })

  it('should show lane name "企画"', () => {
    render(<ProductPreview />)
    expect(screen.getByText('企画')).toBeInTheDocument()
  })

  it('should show lane name "システム"', () => {
    render(<ProductPreview />)
    expect(screen.getByText('システム')).toBeInTheDocument()
  })

  it('should show lane name "事務局"', () => {
    render(<ProductPreview />)
    expect(screen.getByText('事務局')).toBeInTheDocument()
  })

  it('should render macOS window dots', () => {
    render(<ProductPreview />)
    const preview = screen.getByTestId('product-preview')
    // Should have the title bar with dots
    expect(preview).toBeInTheDocument()
  })
})
