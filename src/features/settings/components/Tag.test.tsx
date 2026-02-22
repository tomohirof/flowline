// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tag } from './Tag'

describe('Tag', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render the label text', () => {
    render(<Tag label="日本語" active={false} onClick={vi.fn()} />)
    expect(screen.getByText('日本語')).toBeInTheDocument()
  })

  it('should have aria-pressed="true" when active', () => {
    render(<Tag label="English" active={true} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('should have aria-pressed="false" when not active', () => {
    render(<Tag label="English" active={false} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Tag label="Click me" active={false} onClick={onClick} />)
    await user.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
