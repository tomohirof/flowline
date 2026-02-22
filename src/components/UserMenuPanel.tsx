import { useEffect, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './UserMenuPanel.module.css'

interface UserMenuPanelProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userEmail: string
  onLogout: () => void
}

interface MenuItem {
  icon: string
  label: string
  path?: string
}

const menuItems: (MenuItem | { type: 'sep'; id: string })[] = [
  { icon: 'user', label: 'プロフィール設定', path: '/settings' },
  { icon: 'settings', label: 'アカウント設定', path: '/settings' },
  { icon: 'credit-card', label: 'プランと請求' },
  { icon: 'users', label: 'チーム管理' },
  { type: 'sep', id: 'sep-1' },
  { icon: 'moon', label: 'ダークモード' },
  { icon: 'keyboard', label: 'キーボードショートカット' },
  { type: 'sep', id: 'sep-2' },
  { icon: 'help-circle', label: 'ヘルプ・ドキュメント' },
  { icon: 'message-square', label: 'フィードバック' },
]

const ICON_MAP: Record<string, ReactElement> = {
  user: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  settings: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  'credit-card': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  users: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  moon: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  keyboard: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  ),
  'help-circle': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'message-square': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'log-out': (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
}

function MenuIcon({ name }: { name: string }) {
  return ICON_MAP[name] ?? null
}

export function UserMenuPanel({
  isOpen,
  onClose,
  userName,
  userEmail,
  onLogout,
}: UserMenuPanelProps) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'

  return (
    <>
      <div data-testid="user-menu-overlay" className={styles.overlay} onClick={onClose} />
      <div
        data-testid="user-menu-panel"
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="アカウントメニュー"
      >
        <div className={styles.header}>
          <span className={styles.headerTitle}>アカウント</span>
          <button
            data-testid="user-menu-close"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="メニューを閉じる"
          >
            ✕
          </button>
        </div>

        <div className={styles.userInfo}>
          <div data-testid="user-menu-avatar" className={styles.avatarLarge}>
            {initial}
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userEmail}>{userEmail}</div>
            <span className={styles.planBadge}>Free プラン</span>
          </div>
        </div>

        <div className={styles.menuList}>
          {menuItems.map((item) => {
            if ('type' in item) {
              return <div key={item.id} className={styles.separator} />
            }
            return (
              <button
                key={item.icon}
                className={styles.menuItem}
                style={{ cursor: item.path ? 'pointer' : 'default' }}
                onClick={() => {
                  if (item.path) {
                    navigate(item.path)
                    onClose()
                  }
                }}
              >
                <span className={styles.menuIcon}>
                  <MenuIcon name={item.icon} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>

        <div className={styles.footer}>
          <div className={styles.separator} />
          <button data-testid="logout-button" onClick={onLogout} className={styles.logoutBtn}>
            <span className={styles.menuIcon}>
              <MenuIcon name="log-out" />
            </span>
            ログアウト
          </button>
        </div>
      </div>
    </>
  )
}
