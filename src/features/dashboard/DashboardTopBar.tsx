import { BRAND } from '../../constants/brand'
import styles from './DashboardTopBar.module.css'

interface DashboardTopBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  userName: string
  onToggleMenu: () => void
}

export function DashboardTopBar({
  searchQuery,
  onSearchChange,
  userName,
  onToggleMenu,
}: DashboardTopBarProps) {
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  return (
    <div data-testid="dashboard-topbar" className={styles.topbar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>{BRAND.logoInitial}</div>
        <span className={styles.logoText}>{BRAND.name}</span>
      </div>

      <div className={styles.divider} />

      {/* Search */}
      <div className={styles.searchWrapper}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          data-testid="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ファイルを検索…"
          className={styles.searchInput}
        />
      </div>

      <div className={styles.spacer} />

      {/* Avatar with menu toggle */}
      <button
        data-testid="user-avatar"
        onClick={onToggleMenu}
        className={styles.avatar}
        title={`${userName} - メニュー`}
        aria-label="メニュー"
      >
        {initial}
      </button>
    </div>
  )
}
