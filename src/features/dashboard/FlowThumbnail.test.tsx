// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FlowThumbnail } from './FlowThumbnail'

describe('FlowThumbnail', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render an SVG element', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={4} nodeCount={12} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should render correct number of lane groups', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={3} nodeCount={8} />
    )
    // Each lane is a <g> with a background rect
    const laneGroups = container.querySelectorAll('svg > g')
    // 3 lanes + 1 arrows group = 4
    expect(laneGroups.length).toBe(4)
  })

  it('should render with midnight theme background', () => {
    const { container } = render(
      <FlowThumbnail themeId="midnight" laneCount={3} nodeCount={6} />
    )
    const bgRect = container.querySelector('svg > rect')
    expect(bgRect).toHaveAttribute('fill', '#1A1A24')
  })

  it('should render with blueprint theme background', () => {
    const { container } = render(
      <FlowThumbnail themeId="blueprint" laneCount={3} nodeCount={6} />
    )
    const bgRect = container.querySelector('svg > rect')
    expect(bgRect).toHaveAttribute('fill', '#E8EDF4')
  })

  it('should render with cloud theme background for unknown theme', () => {
    const { container } = render(
      <FlowThumbnail themeId="unknown" laneCount={3} nodeCount={6} />
    )
    const bgRect = container.querySelector('svg > rect')
    expect(bgRect).toHaveAttribute('fill', '#EAEAF2')
  })

  it('should cap lanes at 5', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={8} nodeCount={20} />
    )
    // 5 lanes + 1 arrows group = 6
    const laneGroups = container.querySelectorAll('svg > g')
    expect(laneGroups.length).toBe(6)
  })

  it('should handle zero lanes gracefully', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={0} nodeCount={0} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // No lane groups, no arrow group
    const laneGroups = container.querySelectorAll('svg > g')
    expect(laneGroups.length).toBe(0)
  })

  it('should handle zero nodes gracefully', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={3} nodeCount={0} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should not render arrows group when only 1 lane', () => {
    const { container } = render(
      <FlowThumbnail themeId="cloud" laneCount={1} nodeCount={3} />
    )
    // 1 lane, no arrows group
    const laneGroups = container.querySelectorAll('svg > g')
    expect(laneGroups.length).toBe(1)
  })
})
