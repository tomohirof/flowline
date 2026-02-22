// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Section } from './Section'

describe('Section', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render the title', () => {
    render(
      <Section title="一般設定">
        <div>content</div>
      </Section>,
    )
    expect(screen.getByText('一般設定')).toBeInTheDocument()
  })

  it('should render the description when provided', () => {
    render(
      <Section title="通知" desc="通知の設定を管理します">
        <div>content</div>
      </Section>,
    )
    expect(screen.getByText('通知の設定を管理します')).toBeInTheDocument()
  })

  it('should not render description when not provided', () => {
    const { container } = render(
      <Section title="テーマ">
        <div>content</div>
      </Section>,
    )
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  it('should render children', () => {
    render(
      <Section title="テスト">
        <span data-testid="child-element">子要素</span>
      </Section>,
    )
    expect(screen.getByTestId('child-element')).toBeInTheDocument()
    expect(screen.getByText('子要素')).toBeInTheDocument()
  })
})
