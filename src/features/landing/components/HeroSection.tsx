import styles from './HeroSection.module.css'
import landingStyles from '../landing.module.css'

interface HeroSectionProps {
  onCtaClick: () => void
}

export function HeroSection({ onCtaClick }: HeroSectionProps) {
  return (
    <section data-testid="hero-section" className={styles.hero}>
      <div className={styles.dotGrid} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orb1}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orb2}`} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          無料で使える業務フローエディタ
        </div>

        <h1 className={styles.heading}>
          フローを描く。
          <br />
          <span className={styles.gradientText}>チームが動く。</span>
        </h1>

        <p className={styles.subtext}>
          業務フローの設計・可視化・共有をひとつのツールで。
          <br />
          直感的なエディタで、誰でもすぐに始められます。
        </p>

        <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
          無料で始める →
        </button>
      </div>
    </section>
  )
}
