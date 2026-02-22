import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import type { Settings } from './types'
import {
  ProfileSection,
  EditorSection,
  InteractionSection,
  DisplaySection,
  NotificationSection,
  SecuritySection,
} from './sections'
import styles from './SettingsPage.module.css'

type NavId = 'profile' | 'editor' | 'interaction' | 'display' | 'notifications' | 'security'

const NAV_ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: 'profile', label: 'プロフィール', icon: 'user' },
  { id: 'editor', label: 'エディタ', icon: 'sliders' },
  { id: 'interaction', label: '操作', icon: 'mouse' },
  { id: 'display', label: '表示', icon: 'palette' },
  { id: 'notifications', label: '通知', icon: 'bell' },
  { id: 'security', label: 'セキュリティ', icon: 'shield' },
]

const ICON_PATHS: Record<string, string> = {
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  mouse: 'M12 2a6 6 0 00-6 6v8a6 6 0 0012 0V8a6 6 0 00-6-6zM12 2v6',
  palette:
    'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.04-.23-.29-.38-.63-.38-1.04 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-9.58-10-10z',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
}

function Icon({
  d,
  size = 16,
  strokeWidth = 1.8,
}: {
  d: string
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

const DEFAULT_SETTINGS: Settings = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  doubleClickToEdit: true,
  defaultArrowStyle: 'solid',
  defaultArrowColor: 'default',
  showDotGrid: true,
  showOrderBadge: true,
  showLaneColorBar: true,
  defaultTheme: 'cloud',
  language: 'ja',
  notifications: true,
}

export function SettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [activeNav, setActiveNav] = useState<NavId>('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<{
        settings: Settings
        profile: { name: string; email: string }
      }>('/settings')
      setSettings(data.settings)
      setProfileName(data.profile.name)
      setProfileEmail(data.profile.email)
    } catch {
      setError('設定の取得に失敗しました')
      // Use user info as fallback
      if (user) {
        setProfileName(user.name)
        setProfileEmail(user.email)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const toggle = (key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const set = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })

      // Also save profile name if changed
      if (profileName !== user?.name) {
        await apiFetch('/settings/profile', {
          method: 'PUT',
          body: JSON.stringify({ name: profileName }),
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('設定の保存に失敗しました')
    }
  }

  const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    await apiFetch('/settings/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  const handleDeleteAccount = async () => {
    await apiFetch('/settings/account', {
      method: 'DELETE',
    })
  }

  const renderContent = () => {
    switch (activeNav) {
      case 'profile':
        return (
          <ProfileSection name={profileName} email={profileEmail} onNameChange={setProfileName} />
        )
      case 'editor':
        return <EditorSection settings={settings} onToggle={toggle} onSet={set} />
      case 'interaction':
        return <InteractionSection settings={settings} onToggle={toggle} />
      case 'display':
        return <DisplaySection settings={settings} onToggle={toggle} />
      case 'notifications':
        return <NotificationSection settings={settings} onToggle={toggle} />
      case 'security':
        return (
          <SecuritySection
            onPasswordChange={handlePasswordChange}
            onDeleteAccount={handleDeleteAccount}
          />
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className={styles.layout}>
        <div className={styles.loading} data-testid="settings-loading">
          読み込み中...
        </div>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className={styles.layout}>
        <div className={styles.error} data-testid="settings-error">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      {/* Top bar */}
      <div className={styles.topbar} data-testid="settings-topbar">
        <Link to="/flows" className={styles.backButton} data-testid="settings-back">
          <Icon d={ICON_PATHS.arrowLeft} />
        </Link>
        <div className={styles.logoGroup}>
          <div className={styles.logo}>F</div>
          <span className={styles.pageTitle}>設定</span>
        </div>
        <div className={styles.spacer} />
        <div className={styles.saveWrapper}>
          <button className={styles.saveButton} onClick={handleSave} data-testid="settings-save">
            保存する
          </button>
          {saved && (
            <div className={styles.savedBadge} data-testid="settings-saved-badge">
              &#10003; 保存済み
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.error} data-testid="settings-error">
          {error}
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        {/* Sidebar nav */}
        <nav className={styles.sidebar} data-testid="settings-sidebar">
          {NAV_ITEMS.map((n) => {
            const active = activeNav === n.id
            return (
              <button
                key={n.id}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                onClick={() => setActiveNav(n.id)}
                data-testid={`nav-${n.id}`}
              >
                <Icon d={ICON_PATHS[n.icon]} strokeWidth={active ? 2.2 : 1.8} />
                {n.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <main className={styles.content} key={activeNav} data-testid="settings-content">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
