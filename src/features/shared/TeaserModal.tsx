import { BRAND } from '../../constants/brand'
import { PALETTES } from '../editor/theme-constants'
import styles from './TeaserModal.module.css'

interface TeaserModalProps {
  flowTitle: string
  laneCount: number
  nodeCount: number
  laneColors: number[]
  isDark?: boolean
  onClose: () => void
}

export function TeaserModal({
  flowTitle,
  laneCount,
  nodeCount,
  laneColors,
  isDark = false,
  onClose,
}: TeaserModalProps) {
  return (
    <div
      className={`${styles.overlay}${isDark ? ` ${styles.overlayDark}` : ''}`}
      data-testid="teaser-modal"
    >
      <div className={styles.content}>
        <a href={BRAND.flowsUrl} className={styles.logoLink}>
          <div className={styles.logo}>{BRAND.logoInitial}</div>
          <div className={`${styles.brandName}${isDark ? ` ${styles.brandNameDark}` : ''}`}>
            {BRAND.name}
          </div>
        </a>
        <h2 className={`${styles.flowTitle}${isDark ? ` ${styles.flowTitleDark}` : ''}`}>
          {flowTitle}
        </h2>
        <p className={styles.subtitle}>{BRAND.sharedCreatedBy}</p>
        <div className={styles.meta}>
          {laneColors.map((colorIndex, i) => (
            <div
              key={i}
              data-testid="lane-dot"
              className={styles.laneDot}
              style={{ background: PALETTES[colorIndex % PALETTES.length].dot }}
            />
          ))}
          <span className={styles.metaText}>
            {laneCount} レーン · {nodeCount} ノード
          </span>
        </div>
        <button className={styles.ctaButton} onClick={onClose}>
          {BRAND.sharedViewButton}
        </button>
        <a href={BRAND.flowsUrl} className={styles.freeLink}>
          {BRAND.sharedFreeText}
        </a>
      </div>
    </div>
  )
}
