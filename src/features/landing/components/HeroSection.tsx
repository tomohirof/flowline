import { BRAND } from '../../../constants/brand'
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
          {BRAND.heroBadge}
        </div>

        <h1 className={styles.heading}>
          {BRAND.taglinePart1}
          <br />
          <span className={styles.gradientText}>{BRAND.taglinePart2}</span>
        </h1>

        <p className={styles.subtext}>
          {BRAND.heroSubtext}
          <br />
          {BRAND.heroSubtext2}
        </p>

        <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
          {BRAND.ctaButtonPrimary}
        </button>
      </div>
    </section>
  )
}
