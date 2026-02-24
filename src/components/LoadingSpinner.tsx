import { BRAND } from '../constants/brand'
import styles from './LoadingSpinner.module.css'

interface LoadingSpinnerProps {
  fullScreen?: boolean
}

export function LoadingSpinner({ fullScreen }: LoadingSpinnerProps) {
  return (
    <div
      className={`${styles.spinner}${fullScreen ? ` ${styles.fullScreen}` : ''}`}
      role="status"
      aria-label="読み込み中"
    >
      <div className={styles.logo}>{BRAND.logoInitial}</div>
      <span className={styles.text}>読み込み中...</span>
    </div>
  )
}
