// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SettingRow } from './SettingRow'

describe('SettingRow', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render the label', () => {
    render(
      <SettingRow label="ダークモード">
        <button>toggle</button>
      </SettingRow>,
    )
    expect(screen.getByText('ダークモード')).toBeInTheDocument()
  })

  it('should render the description when provided', () => {
    render(
      <SettingRow label="通知" desc="メール通知を有効にする">
        <button>toggle</button>
      </SettingRow>,
    )
    expect(screen.getByText('メール通知を有効にする')).toBeInTheDocument()
  })

  it('should not render description when not provided', () => {
    const { container } = render(
      <SettingRow label="言語">
        <button>select</button>
      </SettingRow>,
    )
    // desc uses a span, so check there's only the label span
    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(1)
    expect(spans[0].textContent).toBe('言語')
  })

  it('should render children in control area', () => {
    render(
      <SettingRow label="テスト">
        <input data-testid="control-input" type="text" />
      </SettingRow>,
    )
    expect(screen.getByTestId('control-input')).toBeInTheDocument()
  })
})
