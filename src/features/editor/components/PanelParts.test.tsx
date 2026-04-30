// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PanelTextarea } from './PanelParts'

afterEach(() => cleanup())

describe('PanelTextarea', () => {
  it('blurs on Enter when submitOnEnter is unset (default true)', () => {
    const onChange = vi.fn()
    const { container } = render(<PanelTextarea value="" onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    expect(document.activeElement).toBe(ta)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(document.activeElement).not.toBe(ta)
  })

  it('does NOT blur on Enter when submitOnEnter is false', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PanelTextarea value="" onChange={onChange} submitOnEnter={false} />,
    )
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    expect(document.activeElement).toBe(ta)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(document.activeElement).toBe(ta)
  })

  it('does not blur during IME composition even when submitOnEnter is true', () => {
    const onChange = vi.fn()
    const { container } = render(<PanelTextarea value="" onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    fireEvent.keyDown(ta, { key: 'Enter', isComposing: true })
    expect(document.activeElement).toBe(ta)
  })
})
