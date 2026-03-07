import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './HeroSection.module.css'
import landingStyles from '../landing.module.css'

interface HeroSectionProps {
  onCtaClick: () => void
}

export function HeroSection({ onCtaClick }: HeroSectionProps) {
  const { t } = useTranslation('landing')
  return (
    <section data-testid="hero-section" className={styles.hero}>
      <div className={styles.dotGrid} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orb1}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orb2}`} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          {t('brand.heroBadge')}
        </div>

        <h1 className={styles.heading}>
          {t('brand.taglinePart1')}
          <br />
          <span className={styles.gradientText}>{t('brand.taglinePart2')}</span>
        </h1>

        <p className={styles.subtext}>
          {t('brand.heroSubtext')}
          <br />
          {t('brand.heroSubtext2')}
        </p>

        <div className={styles.ctaGroup}>
          <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
            {t('brand.ctaButtonPrimary')}
          </button>
          <Link to="/try" className={styles.tryLink} data-testid="try-link">
            {t('shared:demoTryLink')}
          </Link>
        </div>
      </div>
    </section>
  )
}
