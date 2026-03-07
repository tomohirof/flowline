import { useTranslation } from 'react-i18next'
import styles from './HowItWorksSection.module.css'
import landingStyles from '../landing.module.css'

const stepNumbers = [1, 2, 3]

export function HowItWorksSection() {
  const { t } = useTranslation('landing')
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={landingStyles.sectionTitle}>{t('howItWorks.title')}</h2>
        <p className={landingStyles.sectionSub}>{t('howItWorks.subtitle')}</p>

        <div className={styles.steps}>
          {stepNumbers.map((num) => (
            <div key={num} className={styles.step}>
              <div className={styles.stepNumber}>{num}</div>
              <h3 className={styles.stepTitle}>{t(`howItWorks.step${num}.title`)}</h3>
              <p className={styles.stepDesc}>{t(`howItWorks.step${num}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
