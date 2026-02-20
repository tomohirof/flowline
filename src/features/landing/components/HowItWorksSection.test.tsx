// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HowItWorksSection } from './HowItWorksSection'

describe('HowItWorksSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render title "3ステップで始める"', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('3ステップで始める')).toBeInTheDocument()
  })

  it('should have id="how-it-works" on section element', () => {
    render(<HowItWorksSection />)
    expect(document.getElementById('how-it-works')).toBeInTheDocument()
  })

  it('should render step "レーンを定義"', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('レーンを定義')).toBeInTheDocument()
  })

  it('should render step "ノードを配置"', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('ノードを配置')).toBeInTheDocument()
  })

  it('should render step "共有・エクスポート"', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('共有・エクスポート')).toBeInTheDocument()
  })

  it('should render step numbers 1, 2, 3', () => {
    render(<HowItWorksSection />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
