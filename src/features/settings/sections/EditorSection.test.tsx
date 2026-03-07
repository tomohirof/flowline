// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorSection } from './EditorSection'
import type { Settings } from '../types'

const defaultSettings: Settings = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  doubleClickToEdit: true,
  defaultArrowStyle: 'solid',
  defaultArrowColor: 'default',
  showDotGrid: true,
  showOrderBadge: true,
  showLaneColorBar: true,
  defaultTheme: 'cloud',
  language: 'ja',
  notifications: true,
}

describe('EditorSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render all editor setting rows', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('editor.nodeCreation.copyLabel')).toBeInTheDocument()
    expect(screen.getByText('editor.nodeCreation.autoConnect')).toBeInTheDocument()
    expect(screen.getByText('editor.nodeCreation.autoAddRow')).toBeInTheDocument()
    expect(screen.getByText('editor.nodeCreation.editOnCreate')).toBeInTheDocument()
  })

  it('should render section titles', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('editor.nodeCreation.title')).toBeInTheDocument()
    expect(screen.getByText('editor.arrowDefault.title')).toBeInTheDocument()
    expect(screen.getByText('editor.theme.title')).toBeInTheDocument()
  })

  it('should render arrow style tags', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('editor.arrowDefault.solid')).toBeInTheDocument()
    expect(screen.getByText('editor.arrowDefault.dashed')).toBeInTheDocument()
    expect(screen.getByText('editor.arrowDefault.dotted')).toBeInTheDocument()
  })

  it('should render theme tags (Cloud, Midnight, Blueprint)', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('Cloud')).toBeInTheDocument()
    expect(screen.getByText('Midnight')).toBeInTheDocument()
    expect(screen.getByText('Blueprint')).toBeInTheDocument()
  })

  it('should mark the active arrow style tag', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    const solidBtn = screen.getByText('editor.arrowDefault.solid')
    expect(solidBtn).toHaveAttribute('aria-pressed', 'true')
    const dashedBtn = screen.getByText('editor.arrowDefault.dashed')
    expect(dashedBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('should mark the active theme tag', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    const cloudBtn = screen.getByText('Cloud')
    expect(cloudBtn).toHaveAttribute('aria-pressed', 'true')
    const midnightBtn = screen.getByText('Midnight')
    expect(midnightBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('should call onToggle when a toggle is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<EditorSection settings={defaultSettings} onToggle={onToggle} onSet={vi.fn()} />)
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    expect(onToggle).toHaveBeenCalledWith('copyLabelOnSameRow')
  })

  it('should call onSet when an arrow style tag is clicked', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn()
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={onSet} />)
    await user.click(screen.getByText('editor.arrowDefault.dashed'))
    expect(onSet).toHaveBeenCalledWith('defaultArrowStyle', 'dashed')
  })

  it('should call onSet when a theme tag is clicked', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn()
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={onSet} />)
    await user.click(screen.getByText('Midnight'))
    expect(onSet).toHaveBeenCalledWith('defaultTheme', 'midnight')
  })

  it('should reflect different defaultArrowStyle setting', () => {
    const settings = { ...defaultSettings, defaultArrowStyle: 'dashed' }
    render(<EditorSection settings={settings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('editor.arrowDefault.dashed')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('editor.arrowDefault.solid')).toHaveAttribute('aria-pressed', 'false')
  })

  it('should reflect different defaultTheme setting', () => {
    const settings = { ...defaultSettings, defaultTheme: 'blueprint' }
    render(<EditorSection settings={settings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('Blueprint')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Cloud')).toHaveAttribute('aria-pressed', 'false')
  })

  it('should render 4 toggle switches for node creation settings', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(4)
  })

  it('should reflect toggle states from settings', () => {
    const settings = {
      ...defaultSettings,
      copyLabelOnSameRow: true,
      autoConnect: false,
    }
    render(<EditorSection settings={settings} onToggle={vi.fn()} onSet={vi.fn()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })
})
