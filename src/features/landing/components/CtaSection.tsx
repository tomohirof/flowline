import styles from './CtaSection.module.css'
import landingStyles from '../landing.module.css'

interface CtaSectionProps {
  onCtaClick: () => void
}

export function CtaSection({ onCtaClick }: CtaSectionProps) {
  return (
    <section className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={styles.heading}>業務フローの可視化を、今日から。</h2>
        <p className={styles.sub}>登録不要・無料ですぐに始められます</p>
        <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
          無料で始める →
        </button>
      </div>
    </section>
  )
}
