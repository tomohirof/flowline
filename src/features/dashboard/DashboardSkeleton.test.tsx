// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BRAND } from '../../constants/brand'
import { DashboardSkeleton, SKELETON_CARD_COUNT } from './DashboardSkeleton'

describe('DashboardSkeleton', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render skeleton container with testid', () => {
    render(<DashboardSkeleton />)
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
  })

  it('should render topbar skeleton with logo', () => {
    render(<DashboardSkeleton />)
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
    expect(screen.getByText(BRAND.logoInitial)).toBeInTheDocument()
  })

  it('should render sidebar skeleton bones', () => {
    render(<DashboardSkeleton />)
    expect(screen.getByTestId('skeleton-sidebar')).toBeInTheDocument()
  })

  it('should render main area with 6 card skeletons', () => {
    render(<DashboardSkeleton />)
    const cards = screen.getAllByTestId('skeleton-card')
    expect(cards).toHaveLength(SKELETON_CARD_COUNT)
  })

  it('should render title and tab skeletons in main area', () => {
    render(<DashboardSkeleton />)
    expect(screen.getByTestId('skeleton-main')).toBeInTheDocument()
  })

  it('should have aria-label for accessibility', () => {
    render(<DashboardSkeleton />)
    expect(screen.getByLabelText('loadingAria')).toBeInTheDocument()
  })
})
