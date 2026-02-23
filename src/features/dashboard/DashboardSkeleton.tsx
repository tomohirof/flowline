import styles from './DashboardSkeleton.module.css'

const SKELETON_CARD_COUNT = 6
const NAV_WIDTHS = [130, 110, 95, 80, 90]
const TEAM_WIDTHS = [120, 100]
const TAB_WIDTHS = [60, 70, 80]

export function DashboardSkeleton() {
  return (
    <div
      data-testid="dashboard-skeleton"
      className={styles.skeleton}
      aria-label="読み込み中"
      role="status"
    >
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.logo}>F</div>
        <span className={styles.logoText}>Flowline</span>
        <div className={styles.topbarSpacer} />
        <div className={styles.bone} style={{ width: 200, height: 32 }} />
        <div className={styles.topbarSpacer} />
        <div className={`${styles.bone} ${styles.avatarBone}`} />
      </div>

      <div className={styles.body}>
        {/* Sidebar */}
        <div data-testid="skeleton-sidebar" className={styles.sidebar}>
          <div className={styles.bone} style={{ width: 100, height: 22, marginBottom: 28 }} />
          {NAV_WIDTHS.map((w, i) => (
            <div
              key={i}
              className={styles.bone}
              style={{ width: w, height: 14, marginBottom: 12 }}
            />
          ))}
          <div style={{ height: 24 }} />
          <div className={styles.bone} style={{ width: 60, height: 10, marginBottom: 12 }} />
          {TEAM_WIDTHS.map((w, i) => (
            <div
              key={`t${i}`}
              className={styles.bone}
              style={{ width: w, height: 14, marginBottom: 12 }}
            />
          ))}
        </div>

        {/* Main area */}
        <div data-testid="skeleton-main" className={styles.main}>
          <div className={`${styles.bone} ${styles.titleBone}`} />
          <div className={styles.tabs}>
            {TAB_WIDTHS.map((w, i) => (
              <div key={i} className={styles.bone} style={{ width: w, height: 14 }} />
            ))}
          </div>
          <div className={styles.cardGrid}>
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
              <div key={i} data-testid="skeleton-card" className={styles.card}>
                <div className={`${styles.bone} ${styles.cardThumb}`} />
                <div className={styles.cardInfo}>
                  <div className={`${styles.bone} ${styles.cardTitle}`} />
                  <div className={`${styles.bone} ${styles.cardMeta}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
