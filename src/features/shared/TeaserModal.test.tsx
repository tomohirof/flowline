// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRAND } from '../../constants/brand'
import { TeaserModal } from './TeaserModal'

describe('TeaserModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render modal overlay with testid', () => {
    render(
      <TeaserModal
        flowTitle="Test Flow"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 1, 2]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
  })

  it('should display flow title', () => {
    render(
      <TeaserModal
        flowTitle="My Business Flow"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 1, 2]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('My Business Flow')).toBeInTheDocument()
  })

  it('should display Flowline logo text', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={4}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
  })

  it('should display lane and node count metadata', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={4}
        nodeCount={8}
        laneColors={[0, 1, 2, 3]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/4 レーン/)).toBeInTheDocument()
    expect(screen.getByText(/8 ノード/)).toBeInTheDocument()
  })

  it('should render lane color dots matching laneColors count', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 2, 4]}
        onClose={vi.fn()}
      />,
    )
    const dots = screen.getAllByTestId('lane-dot')
    expect(dots).toHaveLength(3)
  })

  it('should render CTA button "フロー図を表示する"', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: BRAND.sharedViewButton })).toBeInTheDocument()
  })

  it('should call onClose when CTA button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: BRAND.sharedViewButton }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should display free access text', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(BRAND.sharedFreeText)).toBeInTheDocument()
  })

  it('should render with zero lanes and nodes', () => {
    render(
      <TeaserModal
        flowTitle="Empty Flow"
        laneCount={0}
        nodeCount={0}
        laneColors={[]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
    expect(screen.getByText(/0 レーン/)).toBeInTheDocument()
  })

  it('TeaserModal.module.css .content should have solid white background, not gradient', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const css = readFileSync(resolve(__dirname, './TeaserModal.module.css'), 'utf-8')
    const contentMatch = css.match(/\.content\s*\{[^}]*\}/s)
    expect(contentMatch).not.toBeNull()
    const contentBlock = contentMatch![0]
    expect(contentBlock).not.toContain('radial-gradient')
    expect(contentBlock).toMatch(/background:\s*#fff/)
  })

  it('TeaserModal.module.css .content should have box-shadow for card elevation', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const css = readFileSync(resolve(__dirname, './TeaserModal.module.css'), 'utf-8')
    const contentMatch = css.match(/\.content\s*\{[^}]*\}/s)
    expect(contentMatch).not.toBeNull()
    const contentBlock = contentMatch![0]
    expect(contentBlock).toContain('box-shadow')
  })
})
