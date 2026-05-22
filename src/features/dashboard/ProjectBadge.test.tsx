// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProjectBadge } from './ProjectBadge'

describe('ProjectBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render project name when name is provided', () => {
    render(<ProjectBadge name="プロジェクトA" />)
    expect(screen.getByText('プロジェクトA')).toBeInTheDocument()
  })

  it('should render with data-testid="project-badge"', () => {
    render(<ProjectBadge name="プロジェクトA" />)
    expect(screen.getByTestId('project-badge')).toBeInTheDocument()
  })

  it('should set title attribute to full name (for ellipsis hover)', () => {
    render(<ProjectBadge name="REFINVERSE Group, Inc." />)
    const badge = screen.getByTestId('project-badge')
    expect(badge).toHaveAttribute('title', 'REFINVERSE Group, Inc.')
  })

  it('should return null when name is undefined', () => {
    const { container } = render(<ProjectBadge name={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('should return null when name is empty string', () => {
    const { container } = render(<ProjectBadge name="" />)
    expect(container.firstChild).toBeNull()
  })
})
