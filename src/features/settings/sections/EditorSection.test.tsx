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
    expect(screen.getByText('同じ行にノード作成時、テキストをコピー')).toBeInTheDocument()
    expect(screen.getByText('自動接続')).toBeInTheDocument()
    expect(screen.getByText('最終行で自動行追加')).toBeInTheDocument()
    expect(screen.getByText('作成後すぐに編集')).toBeInTheDocument()
  })

  it('should render section titles', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('ノード作成')).toBeInTheDocument()
    expect(screen.getByText('接続線のデフォルト')).toBeInTheDocument()
    expect(screen.getByText('デフォルトテーマ')).toBeInTheDocument()
  })

  it('should render arrow style tags (実線, 破線, 点線)', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('実線')).toBeInTheDocument()
    expect(screen.getByText('破線')).toBeInTheDocument()
    expect(screen.getByText('点線')).toBeInTheDocument()
  })

  it('should render theme tags (Cloud, Midnight, Blueprint)', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('Cloud')).toBeInTheDocument()
    expect(screen.getByText('Midnight')).toBeInTheDocument()
    expect(screen.getByText('Blueprint')).toBeInTheDocument()
  })

  it('should mark the active arrow style tag', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    const solidBtn = screen.getByText('実線')
    expect(solidBtn).toHaveAttribute('aria-pressed', 'true')
    const dashedBtn = screen.getByText('破線')
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
    await user.click(screen.getByText('破線'))
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
    expect(screen.getByText('破線')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('実線')).toHaveAttribute('aria-pressed', 'false')
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
