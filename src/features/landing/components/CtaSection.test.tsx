// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CtaSection } from './CtaSection'

describe('CtaSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render heading "業務フローの可視化を、今日から。"', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText('業務フローの可視化を、今日から。')).toBeInTheDocument()
  })

  it('should render sub text "アカウント登録で無料で始められます"', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByText('アカウント登録で無料で始められます')).toBeInTheDocument()
  })

  it('should render CTA button "無料で始める →"', () => {
    render(<CtaSection onCtaClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /無料で始める/ })).toBeInTheDocument()
  })

  it('should call onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup()
    const onCtaClick = vi.fn()
    render(<CtaSection onCtaClick={onCtaClick} />)

    await user.click(screen.getByRole('button', { name: /無料で始める/ }))
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })
})
