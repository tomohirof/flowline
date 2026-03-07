import { useTranslation } from 'react-i18next'
import { BRAND } from '../constants/brand'
import styles from './LoadingSpinner.module.css'

interface LoadingSpinnerProps {
  fullScreen?: boolean
}

export function LoadingSpinner({ fullScreen }: LoadingSpinnerProps) {
  const { t } = useTranslation()

  return (
    <div
      className={`${styles.spinner}${fullScreen ? ` ${styles.fullScreen}` : ''}`}
      role="status"
      aria-label={t('loadingAria')}
    >
      <div className={styles.logo}>{BRAND.logoInitial}</div>
      <span className={styles.text}>{t('loading')}</span>
    </div>
  )
}
