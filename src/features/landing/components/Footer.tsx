import { BRAND } from '../../../constants/brand'
import styles from './Footer.module.css'
import landingStyles from '../landing.module.css'

export function Footer() {
  return (
    <footer data-testid="landing-footer" className={styles.footer}>
      <div className={landingStyles.container}>
        <div className={styles.inner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>{BRAND.logoInitial}</span>
            <span className={styles.logoText}>{BRAND.name}</span>
          </div>

          <div className={styles.links}>
            <button className={styles.link}>プライバシーポリシー</button>
            <button className={styles.link}>利用規約</button>
            <button className={styles.link}>お問い合わせ</button>
          </div>

          <span className={styles.copyright}>{BRAND.copyright}</span>
        </div>
      </div>
    </footer>
  )
}
