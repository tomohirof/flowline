import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { UserMenuPanel } from '../../components/UserMenuPanel'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import styles from './AdminPage.module.css'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  aiEnabled: boolean
}

export function AdminPage() {
  const { user, logout } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const isAdmin = user?.role === 'admin'

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<{ users: AdminUser[] }>('/admin/users')
      setUsers(data.users)
    } catch {
      setError('ユーザー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    } else {
      setLoading(false)
    }
  }, [isAdmin, loadUsers])

  const handleToggleAi = async (userId: string, currentValue: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(userId))
    try {
      const data = await apiFetch<{ user: AdminUser }>(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ aiEnabled: !currentValue }),
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, aiEnabled: data.user.aiEnabled } : u)),
      )
    } catch {
      setError('AI設定の更新に失敗しました')
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  if (!isAdmin) {
    return (
      <div className={styles.layout}>
        <div className={styles.accessDenied} data-testid="admin-access-denied">
          <h2>アクセス権限がありません</h2>
          <p>管理者権限が必要です。</p>
          <Link to="/flows" className={styles.backLink} data-testid="admin-back-link">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      {/* Top bar */}
      <div className={styles.topbar} data-testid="admin-topbar">
        <Link to="/flows" className={styles.logoLink} data-testid="admin-logo-link">
          <div className={styles.logoIcon}>F</div>
          <span className={styles.logoText}>Flowline</span>
        </Link>
        <span className={styles.pageTitle}>管理画面</span>
        <div className={styles.spacer} />
        <button
          className={styles.avatar}
          onClick={() => setMenuOpen((p) => !p)}
          data-testid="admin-avatar"
          aria-label="メニュー"
        >
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </button>
      </div>

      <UserMenuPanel
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={user?.name || ''}
        userEmail={user?.email || ''}
        onLogout={logout}
      />

      {/* Content */}
      <div className={styles.content}>
        <h1 className={styles.heading}>ユーザー管理</h1>

        {error && (
          <div className={styles.error} data-testid="admin-error">
            {error}
          </div>
        )}

        {loading ? (
          <div data-testid="admin-loading">
            <LoadingSpinner />
          </div>
        ) : (
          <div className={styles.tableWrapper} data-testid="admin-user-table">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>メールアドレス</th>
                  <th>名前</th>
                  <th>ロール</th>
                  <th>AI利用</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} data-testid={`user-row-${u.id}`}>
                    <td>{u.email}</td>
                    <td>{u.name}</td>
                    <td>
                      <span
                        className={`${styles.roleBadge} ${u.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`${styles.toggle} ${u.aiEnabled ? styles.toggleOn : styles.toggleOff}`}
                        onClick={() => handleToggleAi(u.id, u.aiEnabled)}
                        disabled={togglingIds.has(u.id)}
                        data-testid={`ai-toggle-${u.id}`}
                        aria-label={`AI利用を${u.aiEnabled ? '無効' : '有効'}にする`}
                      >
                        <span className={styles.toggleKnob} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className={styles.empty} data-testid="admin-empty">
                ユーザーがいません
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
