// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FlowCard } from './FlowCard'
import type { FlowSummary } from '../editor/types'

// FlowThumbnail をモック化（SVG描画の内部詳細はテスト不要）
vi.mock('./FlowThumbnail', () => ({
  FlowThumbnail: ({ themeId, laneCount, nodeCount }: { themeId: string; laneCount: number; nodeCount: number }) => (
    <div data-testid="flow-thumbnail" data-theme={themeId} data-lanes={laneCount} data-nodes={nodeCount}>
      thumbnail
    </div>
  ),
}))

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

  const defaultProps = {
    flow: baseFlow,
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onContextMenu: vi.fn(),
    deleting: false,
    isHovered: false,
    onHover: vi.fn(),
    renamingId: null as string | null,
  }

  function renderCard(overrides: Partial<typeof defaultProps> = {}) {
    const props = { ...defaultProps, ...overrides }
    return render(
      <MemoryRouter>
        <FlowCard {...props} />
      </MemoryRouter>,
    )
  }

  // --- 基本表示テスト ---

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

  it('should have data-testid on the card container', () => {
    renderCard()
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  // --- 共有バッジ ---

  it('should show share badge when flow has shareToken', () => {
    const flowWithShare: FlowSummary = { ...baseFlow, shareToken: 'token-abc' }
    renderCard({ flow: flowWithShare })
    expect(screen.getByTestId('share-badge-flow-1')).toBeInTheDocument()
    expect(screen.getByText('共有中')).toBeInTheDocument()
  })

  it('should not show share badge when flow has no shareToken', () => {
    renderCard()
    expect(screen.queryByTestId('share-badge-flow-1')).not.toBeInTheDocument()
  })

  // --- 削除 ---

  it('should call onDelete with flow id and title when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderCard({ onDelete })
    await user.click(screen.getByTestId('delete-flow-flow-1'))
    expect(onDelete).toHaveBeenCalledWith('flow-1', '業務フロー')
  })

  it('should show "削除中..." and disable button when deleting', () => {
    renderCard({ deleting: true })
    const deleteButton = screen.getByTestId('delete-flow-flow-1')
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveTextContent('削除中...')
  })

  it('should show "削除" and enable button when not deleting', () => {
    renderCard({ deleting: false })
    const deleteButton = screen.getByTestId('delete-flow-flow-1')
    expect(deleteButton).not.toBeDisabled()
    expect(deleteButton).toHaveTextContent('削除')
  })

  // --- エッジケース ---

  it('should render card even with empty title', () => {
    const emptyTitleFlow: FlowSummary = { ...baseFlow, title: '' }
    renderCard({ flow: emptyTitleFlow })
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  // --- サムネイル ---

  it('should render SVG thumbnail via FlowThumbnail component', () => {
    renderCard()
    const thumb = screen.getByTestId('flow-thumbnail')
    expect(thumb).toBeInTheDocument()
    expect(thumb).toHaveAttribute('data-theme', 'cloud')
  })

  // --- ホバー状態: 「開く」ボタン ---

  it('should show "開く" button when isHovered is true', () => {
    renderCard({ isHovered: true })
    expect(screen.getByText('開く')).toBeInTheDocument()
  })

  it('should not show "開く" button when isHovered is false', () => {
    renderCard({ isHovered: false })
    expect(screen.queryByText('開く')).not.toBeInTheDocument()
  })

  // --- ホバー状態: メニューボタン ---

  it('should show menu button when isHovered is true', () => {
    renderCard({ isHovered: true })
    expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
  })

  it('should not show menu button when isHovered is false', () => {
    renderCard({ isHovered: false })
    expect(screen.queryByTestId('card-menu-flow-1')).not.toBeInTheDocument()
  })

  // --- インラインリネーム ---

  it('should show rename input when renamingId matches flow id', () => {
    renderCard({ renamingId: 'flow-1' })
    expect(screen.getByTestId('rename-input-flow-1')).toBeInTheDocument()
  })

  it('should not show rename input when renamingId does not match', () => {
    renderCard({ renamingId: 'flow-other' })
    expect(screen.queryByTestId('rename-input-flow-1')).not.toBeInTheDocument()
  })

  it('should not show rename input when renamingId is null', () => {
    renderCard({ renamingId: null })
    expect(screen.queryByTestId('rename-input-flow-1')).not.toBeInTheDocument()
  })

  // --- リネーム確定 ---

  it('should call onRename when rename input is submitted with Enter', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    renderCard({ renamingId: 'flow-1', onRename })

    const input = screen.getByTestId('rename-input-flow-1')
    await user.clear(input)
    await user.type(input, '新しいタイトル{Enter}')

    expect(onRename).toHaveBeenCalledWith('flow-1', '新しいタイトル')
  })

  // --- ホバーコールバック ---

  it('should call onHover with flow id on mouse enter', () => {
    const onHover = vi.fn()
    renderCard({ onHover })

    fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
    expect(onHover).toHaveBeenCalledWith('flow-1')
  })

  it('should call onHover with null on mouse leave', () => {
    const onHover = vi.fn()
    renderCard({ onHover })

    fireEvent.mouseLeave(screen.getByTestId('flow-card-flow-1'))
    expect(onHover).toHaveBeenCalledWith(null)
  })

  // --- コンテキストメニュー ---

  it('should call onContextMenu on menu button click', async () => {
    const user = userEvent.setup()
    const onContextMenu = vi.fn()
    renderCard({ isHovered: true, onContextMenu })

    await user.click(screen.getByTestId('card-menu-flow-1'))
    expect(onContextMenu).toHaveBeenCalledWith('flow-1', expect.any(Number), expect.any(Number))
  })

  // --- レーンカラードット ---

  it('should render lane color dots in info area', () => {
    renderCard()
    const dots = screen.getByTestId('flow-card-flow-1').querySelectorAll('[data-testid="lane-dot"]')
    // デフォルトのlaneCount=3に対して3つのドットを表示
    expect(dots.length).toBeGreaterThan(0)
  })
})
