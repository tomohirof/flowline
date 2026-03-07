import { useTranslation } from 'react-i18next'
import { BRAND } from '../../constants/brand'
import styles from './BottomCTABar.module.css'

interface BottomCTABarProps {
  visible: boolean
  onClose: () => void
}

export function BottomCTABar({ visible, onClose }: BottomCTABarProps) {
  const { t } = useTranslation('shared')
  const { t: tc } = useTranslation('common')
  if (!visible) return null

  return (
    <div className={styles.wrapper} data-testid="bottom-cta-bar">
      <div className={styles.bar}>
        <div className={styles.logo}>{BRAND.logoInitial}</div>
        <div className={styles.textBlock}>
          <div className={styles.heading}>{t('createCta')}</div>
          <div className={styles.subText}>{t('ctaFeatures')}</div>
        </div>
        <a href={BRAND.siteUrl} className={styles.ctaLink}>
          {t('landing:brand.ctaButtonShared')}
        </a>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          data-testid="bottom-cta-close"
          aria-label={tc('close')}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
