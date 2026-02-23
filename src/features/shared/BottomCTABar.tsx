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
        <div className={styles.logo}>F</div>
        <div className={styles.textBlock}>
          <div className={styles.heading}>Flowline でフロー図を作成</div>
          <div className={styles.subText}>無料で始める · チームで共有 · Mermaid対応</div>
        </div>
        <a href="/?auth=register" className={styles.ctaLink}>
          無料で試す →
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
