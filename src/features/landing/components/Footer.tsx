import { useTranslation } from 'react-i18next'
import { BRAND } from '../../../constants/brand'
import styles from './Footer.module.css'
import landingStyles from '../landing.module.css'

export function Footer() {
  const { t } = useTranslation('landing')
  return (
    <footer data-testid="landing-footer" className={styles.footer}>
      <div className={landingStyles.container}>
        <div className={styles.inner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>{BRAND.logoInitial}</span>
            <span className={styles.logoText}>{BRAND.name}</span>
          </div>

          <div className={styles.links}>
            <button className={styles.link}>{t('footer.privacy')}</button>
            <button className={styles.link}>{t('footer.terms')}</button>
            <button className={styles.link}>{t('footer.contact')}</button>
          </div>

          <span className={styles.copyright}>{BRAND.copyright}</span>
        </div>
      </div>
    </footer>
  )
}
