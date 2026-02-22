import type { ReactNode } from 'react'
import styles from './SettingRow.module.css'

interface SettingRowProps {
  label: string
  desc?: string
  children: ReactNode
}

export function SettingRow({ label, desc, children }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelWrap}>
        <span className={styles.label}>{label}</span>
        {desc && <span className={styles.desc}>{desc}</span>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  )
}
