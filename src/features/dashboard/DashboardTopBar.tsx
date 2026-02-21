import styles from './DashboardTopBar.module.css'

interface DashboardTopBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  onCreateFlow: () => void
  creating: boolean
  userName: string
  onLogout: () => void
}

export function DashboardTopBar({
  searchQuery,
  onSearchChange,
  onCreateFlow,
  creating,
  userName,
  onLogout,
}: DashboardTopBarProps) {
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  return (
    <div data-testid="dashboard-topbar" className={styles.topbar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>F</div>
        <span className={styles.logoText}>Flowline</span>
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

      {/* New file button */}
      <button
        data-testid="create-flow-button"
        onClick={onCreateFlow}
        disabled={creating}
        className={`${styles.createBtn} ${creating ? styles.createBtnDisabled : ''}`}
      >
        {creating ? '作成中...' : '+ 新規作成'}
      </button>

      <div className={styles.dividerSmall} />

      {/* Avatar with logout */}
      <button
        data-testid="user-avatar"
        onClick={onLogout}
        className={styles.avatar}
        title={`${userName} - ログアウト`}
        aria-label="ログアウト"
      >
        {initial}
      </button>
    </div>
  )
}
