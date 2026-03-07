import { useTranslation } from 'react-i18next'
import styles from './FeaturesSection.module.css'
import landingStyles from '../landing.module.css'

const featureKeys = [
  { icon: '\u2630', key: 'swimlane' },
  { icon: '\u2194', key: 'smartConnect' },
  { icon: '\u26A1', key: 'realtimeEdit' },
  { icon: '\u21A9', key: 'undoRedo' },
  { icon: '\u2728', key: 'theme' },
  { icon: '\u2B07', key: 'export' },
]

export function FeaturesSection() {
  const { t } = useTranslation('landing')
  return (
    <section id="features" className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={landingStyles.sectionTitle}>{t('brand.featuresTitle')}</h2>
        <p className={landingStyles.sectionSub}>{t('brand.featuresSubtitle')}</p>
      </div>

      <div className={styles.grid}>
        {featureKeys.map((f) => (
          <div key={f.key} className={styles.card}>
            <div className={styles.icon}>{f.icon}</div>
            <h3 className={styles.cardTitle}>{t(`features.${f.key}.title`)}</h3>
            <p className={styles.cardDesc}>{t(`features.${f.key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
