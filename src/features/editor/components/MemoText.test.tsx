// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { MemoText } from './MemoText'

afterEach(() => cleanup())

describe('MemoText', () => {
  it('renders plain text without anchor when no URL is present', () => {
    const { container, queryByRole } = render(<MemoText text="just plain text" color="#000" />)
    expect(queryByRole('link')).toBeNull()
    expect(container.textContent).toBe('just plain text')
  })

  it('renders an anchor for an https URL', () => {
    const { getByRole } = render(<MemoText text="visit https://example.com" color="#000" />)
    const link = getByRole('link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('sets target=_blank and a strict rel', () => {
    const { getByRole } = render(<MemoText text="https://example.com" color="#000" />)
    const link = getByRole('link') as HTMLAnchorElement
    expect(link.getAttribute('target')).toBe('_blank')
    const rel = link.getAttribute('rel') ?? ''
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
    expect(rel).toContain('nofollow')
  })

  it('makes the anchor pointer-interactive even though container is non-interactive', () => {
    const { container, getByRole } = render(<MemoText text="https://example.com" color="#000" />)
    const root = container.firstChild as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
    expect(root.style.userSelect).toBe('none')

    const link = getByRole('link') as HTMLAnchorElement
    expect(link.style.pointerEvents).toBe('auto')
    expect(link.style.userSelect).toBe('auto')
  })

  it('uses pre-wrap whiteSpace so newlines are preserved', () => {
    const { container } = render(<MemoText text={'line1\nline2'} color="#000" />)
    const root = container.firstChild as HTMLElement
    expect(root.style.whiteSpace).toBe('pre-wrap')
  })

  it('does NOT linkify dangerous schemes', () => {
    const { queryByRole, container } = render(
      <MemoText text="javascript:alert(1) data:text/html,x" color="#000" />,
    )
    expect(queryByRole('link')).toBeNull()
    expect(container.textContent).toBe('javascript:alert(1) data:text/html,x')
  })

  it('stops mousedown and click propagation on the anchor', () => {
    const onParentMouseDown = vi.fn()
    const onParentClick = vi.fn()
    const { getByRole } = render(
      <div onMouseDown={onParentMouseDown} onClick={onParentClick}>
        <MemoText text="https://example.com" color="#000" />
      </div>,
    )
    const link = getByRole('link') as HTMLAnchorElement
    fireEvent.mouseDown(link)
    fireEvent.click(link)
    expect(onParentMouseDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('renders nothing visible for empty text', () => {
    const { container } = render(<MemoText text="" color="#000" />)
    expect(container.textContent).toBe('')
  })
})
