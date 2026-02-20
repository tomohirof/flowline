// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FeaturesSection } from './FeaturesSection'

describe('FeaturesSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render section title "すべての機能を、ひとつに"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('すべての機能を、ひとつに')).toBeInTheDocument()
  })

  it('should render section subtitle', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('業務フロー設計に必要な機能をすべて備えています')).toBeInTheDocument()
  })

  it('should have id="features" on section element', () => {
    render(<FeaturesSection />)
    expect(document.getElementById('features')).toBeInTheDocument()
  })

  it('should render feature card "スイムレーン設計"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('スイムレーン設計')).toBeInTheDocument()
  })

  it('should render feature card "スマート接続"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('スマート接続')).toBeInTheDocument()
  })

  it('should render feature card "リアルタイム編集"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('リアルタイム編集')).toBeInTheDocument()
  })

  it('should render feature card "Undo / Redo"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('Undo / Redo')).toBeInTheDocument()
  })

  it('should render feature card "テーマシステム"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('テーマシステム')).toBeInTheDocument()
  })

  it('should render feature card "エクスポート"', () => {
    render(<FeaturesSection />)
    expect(screen.getByText('エクスポート')).toBeInTheDocument()
  })
})
