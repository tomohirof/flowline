import { BRAND } from '../../constants/brand'
import styles from './BottomCTABar.module.css'

interface BottomCTABarProps {
  visible: boolean
  onClose: () => void
}

export function BottomCTABar({ visible, onClose }: BottomCTABarProps) {
  if (!visible) return null

  return (
    <div className={styles.wrapper} data-testid="bottom-cta-bar">
      <div className={styles.bar}>
        <div className={styles.logo}>{BRAND.logoInitial}</div>
        <div className={styles.textBlock}>
          <div className={styles.heading}>{BRAND.sharedCreateCta}</div>
          <div className={styles.subText}>{BRAND.sharedCtaFeatures}</div>
        </div>
        <a href="https://flowline.six1.jp/" className={styles.ctaLink}>
          {BRAND.ctaButtonShared}
        </a>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          data-testid="bottom-cta-close"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
