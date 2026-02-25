import { Link } from 'react-router-dom'
import { BRAND } from '../../../constants/brand'
import styles from './CtaSection.module.css'
import landingStyles from '../landing.module.css'

interface CtaSectionProps {
  onCtaClick: () => void
}

export function CtaSection({ onCtaClick }: CtaSectionProps) {
  return (
    <section className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={styles.heading}>{BRAND.ctaHeading}</h2>
        <p className={styles.sub}>{BRAND.ctaSubtext}</p>
        <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
          {BRAND.ctaButtonPrimary}
        </button>
        <Link to="/try" className={styles.tryLink} data-testid="cta-try-link">
          {BRAND.demoTryLink}
        </Link>
      </div>
    </section>
  )
}
