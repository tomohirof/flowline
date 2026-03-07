import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './CtaSection.module.css'
import landingStyles from '../landing.module.css'

interface CtaSectionProps {
  onCtaClick: () => void
}

export function CtaSection({ onCtaClick }: CtaSectionProps) {
  const { t } = useTranslation('landing')
  return (
    <section className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={styles.heading}>{t('brand.ctaHeading')}</h2>
        <p className={styles.sub}>{t('brand.ctaSubtext')}</p>
        <button className={landingStyles.btnPrimary} onClick={onCtaClick}>
          {t('brand.ctaButtonPrimary')}
        </button>
        <Link to="/try" className={styles.tryLink} data-testid="cta-try-link">
          {t('shared:demoTryLink')}
        </Link>
      </div>
    </section>
  )
}
