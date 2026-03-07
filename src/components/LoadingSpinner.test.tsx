// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with role="status" and aria-label', () => {
    render(<LoadingSpinner />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-label', 'loadingAria')
  })

  it('should render logo initial "F"', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('should render loading text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('should apply fullScreen class when fullScreen prop is true', () => {
    render(<LoadingSpinner fullScreen />)
    const el = screen.getByRole('status')
    expect(el.className).toContain('fullScreen')
  })

  it('should not apply fullScreen class by default', () => {
    render(<LoadingSpinner />)
    const el = screen.getByRole('status')
    expect(el.className).not.toContain('fullScreen')
  })
})
