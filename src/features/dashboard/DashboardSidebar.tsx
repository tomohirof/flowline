import styles from './DashboardSidebar.module.css'

interface DashboardSidebarProps {
  selectedNav: string
  onNavChange: (navId: string) => void
  userName: string
}

const NAV_ITEMS = [
  { id: 'recent', icon: '◷', label: '最近' },
  { id: 'all', icon: '▦', label: 'すべてのファイル' },
  { id: 'shared', icon: '⊡', label: '共有ファイル' },
  { id: 'drafts', icon: '◫', label: 'ドラフト' },
  { id: 'trash', icon: '▢', label: 'ごみ箱' },
]

const TEAMS = [
  { id: 't1', name: 'プロダクトチーム', count: 8 },
  { id: 't2', name: 'バックオフィス', count: 5 },
]

export function DashboardSidebar({ selectedNav, onNavChange, userName }: DashboardSidebarProps) {
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  return (
    <div data-testid="dashboard-sidebar" className={styles.sidebar}>
      {/* Navigation */}
      <div className={styles.navGroup}>
        {NAV_ITEMS.map((n) => (
          <div
            key={n.id}
            data-testid={`nav-item-${n.id}`}
            onClick={() => onNavChange(n.id)}
            className={`${styles.navItem} ${selectedNav === n.id ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </div>

      <div className={styles.divider} />

      {/* User section */}
      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>{initial}</div>
          <span className={styles.userName}>{userName}</span>
          <span className={styles.planBadge}>Free</span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Teams */}
      <div>
        <div className={styles.sectionTitle}>チーム</div>
        {TEAMS.map((t) => (
          <div key={t.id} className={styles.teamItem}>
            <span className={styles.teamInfo}>
              <span className={styles.teamIcon}>◫</span>
              {t.name}
            </span>
            <span className={styles.teamCount}>{t.count}</span>
          </div>
        ))}
      </div>

      <div className={styles.spacer} />

      {/* Upgrade card */}
      <div className={styles.upgradeCard}>
        <div className={styles.upgradeIcon}>⊕</div>
        <p className={styles.upgradeText}>
          Proプランでチーム共有やバージョン履歴が使えます
        </p>
        <button className={styles.upgradeBtn}>プランを表示</button>
      </div>
    </div>
  )
}
