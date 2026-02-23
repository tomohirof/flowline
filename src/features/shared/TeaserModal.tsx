import { PALETTES } from '../editor/theme-constants'
import styles from './TeaserModal.module.css'

interface TeaserModalProps {
  flowTitle: string
  laneCount: number
  nodeCount: number
  laneColors: number[]
  onClose: () => void
}

export function TeaserModal({
  flowTitle,
  laneCount,
  nodeCount,
  laneColors,
  onClose,
}: TeaserModalProps) {
  return (
    <div className={styles.overlay} data-testid="teaser-modal">
      <div className={styles.content}>
        <div className={styles.logo}>F</div>
        <div className={styles.brandName}>Flowline</div>
        <h2 className={styles.flowTitle}>{flowTitle}</h2>
        <p className={styles.subtitle}>Flowline で作成されたフロー</p>
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
          フロー図を表示する
        </button>
        <p className={styles.freeText}>閲覧は無料 · ログイン不要</p>
      </div>
    </div>
  )
}
