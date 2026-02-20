// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FlowCard } from './FlowCard'
import type { FlowSummary } from '../editor/types'

describe('FlowCard', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const baseFlow: FlowSummary = {
    id: 'flow-1',
    title: '業務フロー',
    themeId: 'cloud',
    shareToken: null,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  }

  function renderCard(flow: FlowSummary = baseFlow, onDelete = vi.fn(), deleting = false) {
    return render(
      <MemoryRouter>
        <FlowCard flow={flow} onDelete={onDelete} deleting={deleting} />
      </MemoryRouter>,
    )
  }

  it('should render flow title', () => {
    renderCard()

    expect(screen.getByText('業務フロー')).toBeInTheDocument()
  })

  it('should render a link to the flow editor', () => {
    renderCard()

    const link = screen.getByTestId('flow-link-flow-1')
    expect(link).toHaveAttribute('href', '/flows/flow-1')
  })

  it('should show relative update time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    renderCard()

    expect(screen.getByText('更新: 2時間前')).toBeInTheDocument()
  })

  it('should show share badge when flow has shareToken', () => {
    const flowWithShare: FlowSummary = {
      ...baseFlow,
      shareToken: 'token-abc',
    }
    renderCard(flowWithShare)

    expect(screen.getByTestId('share-badge-flow-1')).toBeInTheDocument()
    expect(screen.getByText('共有中')).toBeInTheDocument()
  })

  it('should not show share badge when flow has no shareToken', () => {
    renderCard()

    expect(screen.queryByTestId('share-badge-flow-1')).not.toBeInTheDocument()
  })

  it('should call onDelete with flow id when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderCard(baseFlow, onDelete)

    await user.click(screen.getByTestId('delete-flow-flow-1'))

    expect(onDelete).toHaveBeenCalledWith('flow-1', '業務フロー')
  })

  it('should have data-testid on the card container', () => {
    renderCard()

    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  // エッジケース: 空タイトル
  it('should render card even with empty title', () => {
    const emptyTitleFlow: FlowSummary = {
      ...baseFlow,
      title: '',
    }
    renderCard(emptyTitleFlow)

    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  // エッジケース: delete button should not navigate
  it('should stop propagation on delete button click', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderCard(baseFlow, onDelete)

    const deleteButton = screen.getByTestId('delete-flow-flow-1')
    await user.click(deleteButton)

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  // 削除中状態
  it('should show "削除中..." and disable button when deleting', () => {
    renderCard(baseFlow, vi.fn(), true)

    const deleteButton = screen.getByTestId('delete-flow-flow-1')
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveTextContent('削除中...')
  })

  it('should show "削除" and enable button when not deleting', () => {
    renderCard(baseFlow, vi.fn(), false)

    const deleteButton = screen.getByTestId('delete-flow-flow-1')
    expect(deleteButton).not.toBeDisabled()
    expect(deleteButton).toHaveTextContent('削除')
  })
})
