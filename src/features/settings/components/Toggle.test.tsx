// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render with aria-checked="true" when checked', () => {
    render(<Toggle checked={true} onChange={vi.fn()} />)
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('should render with aria-checked="false" when unchecked', () => {
    render(<Toggle checked={false} onChange={vi.fn()} />)
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onChange when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
