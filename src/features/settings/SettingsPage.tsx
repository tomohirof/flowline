import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { UserMenuPanel } from '../../components/UserMenuPanel'
import { LoadingSpinner } from '../../components/LoadingSpinner'
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

const NAV_ITEMS: { id: NavId; labelKey: string; icon: string }[] = [
  { id: 'profile', labelKey: 'nav.profile', icon: 'user' },
  { id: 'editor', labelKey: 'nav.editor', icon: 'sliders' },
  { id: 'interaction', labelKey: 'nav.interaction', icon: 'mouse' },
  { id: 'display', labelKey: 'nav.display', icon: 'palette' },
  { id: 'notifications', labelKey: 'nav.notification', icon: 'bell' },
  { id: 'security', labelKey: 'nav.security', icon: 'shield' },
]

const ICON_PATHS: Record<string, string> = {
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
  const { t, i18n } = useTranslation('settings')
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [activeNav, setActiveNav] = useState<NavId>('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef(true)
  const userNameRef = useRef(user?.name)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setLoadFailed(false)
      const data = await apiFetch<{
        settings: Settings
        profile: { name: string; email: string }
      }>('/settings')
      setSettings(data.settings)
      setProfileName(data.profile.name)
      setProfileEmail(data.profile.email)
      // Mark initial load complete after setting state
      // Use setTimeout(0) to ensure state updates are batched before auto-save can trigger
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 0)
    } catch {
      setError(t('status.loadError'))
      setLoadFailed(true)
      // Use user info as fallback
      if (user) {
        setProfileName(user.name)
        setProfileEmail(user.email)
      }
      // Use setTimeout(0) to match success path — prevents auto-save from firing
      // with DEFAULT_SETTINGS when initial load fails
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 0)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Sync language from settings to i18n on load
  useEffect(() => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language)
    }
  }, [settings.language])

  // Keep userNameRef in sync with user.name
  useEffect(() => {
    userNameRef.current = user?.name
  }, [user?.name])

  const toggle = (key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const set = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Auto-save when settings or profileName change (debounce 800ms)
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoadRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await apiFetch('/settings', {
          method: 'PUT',
          body: JSON.stringify(settings),
        })
        if (profileName !== userNameRef.current) {
          await apiFetch('/settings/profile', {
            method: 'PUT',
            body: JSON.stringify({ name: profileName }),
          })
        }
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
        setError(t('status.saveError'))
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }, 800)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [settings, profileName])

  const handlePasswordChange = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<string | null> => {
    try {
      await apiFetch('/settings/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : t('security.passwordChangeFailed')
    }
  }

  const handleDeleteAccount = async () => {
    await apiFetch('/settings/account', {
      method: 'DELETE',
    })
    await logout()
    navigate('/')
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
        return <DisplaySection settings={settings} onToggle={toggle} onSet={set} />
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
        <div data-testid="settings-loading">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (error && loadFailed) {
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
        <Link to="/flows" className={styles.logoLink} data-testid="settings-logo-link">
          <div className={styles.logoIcon}>F</div>
          <span className={styles.logoText}>Flowline</span>
        </Link>
        <div className={styles.spacer} />
        {saveStatus === 'saving' && (
          <span className={styles.saveStatus} data-testid="save-status">
            {t('status.saving')}
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className={styles.saveStatusDone} data-testid="save-status">
            &#10003; {t('status.saved')}
          </span>
        )}
        {saveStatus === 'error' && (
          <span className={styles.saveStatusError} data-testid="save-status-error">
            {t('status.saveFailed')}
          </span>
        )}
        <button
          className={styles.avatar}
          onClick={() => setMenuOpen((p) => !p)}
          data-testid="settings-avatar"
          aria-label={t('status.menu')}
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
                {t(n.labelKey)}
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
