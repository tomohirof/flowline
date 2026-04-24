// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProjectActionBar } from './ProjectActionBar'
import '../../i18n'

describe('ProjectActionBar', () => {
  const noop = () => {}

  afterEach(() => {
    cleanup()
  })

  it('owner view shows Settings and Members buttons', () => {
    render(
      <ProjectActionBar
        projectName="P"
        ownerName={null}
        role="owner"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={noop}
      />,
    )
    expect(screen.getByTestId('project-settings-btn')).toBeInTheDocument()
    expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('project-leave-btn')).toBeNull()
  })

  it('editor view shows Members and Leave, owner name appended', () => {
    render(
      <ProjectActionBar
        projectName="P"
        ownerName="Alice"
        role="editor"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={noop}
      />,
    )
    expect(screen.queryByTestId('project-settings-btn')).toBeNull()
    expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
    expect(screen.getByTestId('project-leave-btn')).toBeInTheDocument()
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })

  it('Leave button triggers onLeave callback after confirm', () => {
    const onLeave = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <ProjectActionBar
        projectName="P"
        ownerName="Alice"
        role="editor"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={onLeave}
      />,
    )
    fireEvent.click(screen.getByTestId('project-leave-btn'))
    expect(onLeave).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('Leave button is not called when confirm is cancelled', () => {
    const onLeave = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <ProjectActionBar
        projectName="P"
        ownerName="Alice"
        role="editor"
        onOpenSettings={noop}
        onOpenMembers={noop}
        onLeave={onLeave}
      />,
    )
    fireEvent.click(screen.getByTestId('project-leave-btn'))
    expect(onLeave).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
