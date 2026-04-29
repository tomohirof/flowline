import type { ReactNode } from 'react'
import styles from '../FlowEditor.module.css'

export const PanelSection = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className={styles.panelSection}>
    {label && <div className={styles.panelSectionLabel}>{label}</div>}
    {children}
  </div>
)

export const PanelRow = ({ label, children }: { label: string; children?: ReactNode }) => (
  <div className={styles.panelRow}>
    <span className={styles.panelRowLabel}>{label}</span>
    <div className={styles.panelRowChildren}>{children}</div>
  </div>
)

export const PanelInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={styles.panelInput}
  />
)

export const PanelTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={styles.panelTextarea}
    onKeyDown={(e) => {
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ;(e.currentTarget as HTMLTextAreaElement).blur()
      }
    }}
  />
)

export const PanelBtn = ({
  label,
  color,
  bg,
  onClick,
  full,
  disabled,
  active,
}: {
  label: string
  color: string
  bg?: string
  onClick: () => void
  full?: boolean
  disabled?: boolean
  active?: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`${styles.panelBtn} ${full ? styles.panelBtnFull : styles.panelBtnAuto}`}
    style={{
      border: `1px solid ${color}30`,
      background: active ? color : bg || `${color}10`,
      color: active ? '#fff' : color,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    {label}
  </button>
)
