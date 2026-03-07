import { useTranslation } from 'react-i18next'
import styles from './DashboardSidebar.module.css'

interface DashboardSidebarProps {
  selectedNav: string
  onNavChange: (navId: string) => void
  userName: string
}

interface NavItem {
  id: string
  icon: string
  labelKey: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'recent', icon: '◷', labelKey: 'sidebar.recent' },
  { id: 'all', icon: '▦', labelKey: 'sidebar.allFiles' },
  { id: 'shared', icon: '⊡', labelKey: 'sidebar.shared' },
  { id: 'drafts', icon: '◫', labelKey: 'sidebar.drafts' },
  { id: 'trash', icon: '▢', labelKey: 'sidebar.trash' },
]

const TEAMS = [
  { id: 't1', nameKey: 'sidebar.teamProduct', count: 8 },
  { id: 't2', nameKey: 'sidebar.teamBackoffice', count: 5 },
]

export function DashboardSidebar({ selectedNav, onNavChange, userName }: DashboardSidebarProps) {
  const { t } = useTranslation('dashboard')
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  return (
    <div data-testid="dashboard-sidebar" className={styles.sidebar}>
      {/* Navigation */}
      <div className={styles.navGroup}>
        {NAV_ITEMS.map((n) => (
          <button
            key={n.id}
            data-testid={`nav-item-${n.id}`}
            onClick={() => onNavChange(n.id)}
            className={`${styles.navItem} ${selectedNav === n.id ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{n.icon}</span>
            {t(n.labelKey)}
          </button>
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
        <div className={styles.sectionTitle}>{t('sidebar.teams')}</div>
        {TEAMS.map((team) => (
          <div key={team.id} className={styles.teamItem}>
            <span className={styles.teamInfo}>
              <span className={styles.teamIcon}>◫</span>
              {t(team.nameKey)}
            </span>
            <span className={styles.teamCount}>{team.count}</span>
          </div>
        ))}
      </div>

      <div className={styles.spacer} />

      {/* Upgrade card */}
      <div className={styles.upgradeCard}>
        <div className={styles.upgradeIcon}>⊕</div>
        <p className={styles.upgradeText}>{t('sidebar.proPlanMessage')}</p>
        <button className={styles.upgradeBtn}>{t('sidebar.showPlan')}</button>
      </div>
    </div>
  )
}
