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

export const PanelBtn = ({
  label,
  color,
  bg,
  onClick,
  full,
}: {
  label: string
  color: string
  bg?: string
  onClick: () => void
  full?: boolean
}) => (
  <button
    onClick={onClick}
    className={`${styles.panelBtn} ${full ? styles.panelBtnFull : styles.panelBtnAuto}`}
    style={{
      border: `1px solid ${color}30`,
      background: bg || `${color}10`,
      color,
    }}
  >
    {label}
  </button>
)
