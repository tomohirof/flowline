import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../editor/types'
import { apiFetch } from '../../lib/api'
import { SharedProjectList, type SharedProject } from './SharedProjectList'
import styles from './DashboardSidebar.module.css'

interface DashboardSidebarProps {
  selectedNav: string
  onNavChange: (navId: string) => void
  userName: string
  projects: Project[]
  onCreateProject: () => void
  onRenameProject: (projectId: string, newName: string) => void
  onDeleteProject: (projectId: string) => void
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

export function DashboardSidebar({
  selectedNav,
  onNavChange,
  userName,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: DashboardSidebarProps) {
  const { t } = useTranslation('dashboard')
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U'
  const [contextMenu, setContextMenu] = useState<{
    projectId: string
    x: number
    y: number
  } | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([])
  const cancelledRef = useRef(false)

  useEffect(() => {
    void apiFetch<{ projects: SharedProject[] }>('/projects/shared')
      .then((d) => setSharedProjects(d.projects ?? []))
      .catch(() => {
        /* swallow — shared section hides itself when empty */
      })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    setContextMenu({ projectId, x: e.clientX, y: e.clientY })
  }, [])

  const handleSidebarClick = useCallback(() => {
    if (contextMenu) {
      setContextMenu(null)
    }
  }, [contextMenu])

  const handleRename = useCallback(
    (projectId: string) => {
      setContextMenu(null)
      const project = projects.find((p) => p.id === projectId)
      setEditingProjectId(projectId)
      setEditingName(project?.name ?? '')
    },
    [projects],
  )

  const handleRenameSubmit = useCallback(() => {
    if (!cancelledRef.current && editingProjectId && editingName.trim()) {
      onRenameProject(editingProjectId, editingName.trim())
    }
    cancelledRef.current = false
    setEditingProjectId(null)
    setEditingName('')
  }, [editingProjectId, editingName, onRenameProject])

  const handleRenameCancel = useCallback(() => {
    cancelledRef.current = true
    setEditingProjectId(null)
    setEditingName('')
  }, [])

  const handleDelete = useCallback(
    (projectId: string) => {
      setContextMenu(null)
      onDeleteProject(projectId)
    },
    [onDeleteProject],
  )

  return (
    <div data-testid="dashboard-sidebar" className={styles.sidebar} onClick={handleSidebarClick}>
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

      {/* Projects */}
      <div>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>{t('sidebar.projects')}</div>
          <button
            data-testid="create-project-btn"
            className={styles.createProjectBtn}
            onClick={(e) => {
              e.stopPropagation()
              onCreateProject()
            }}
            title={t('sidebar.newProject')}
          >
            +
          </button>
        </div>

        {/* Uncategorized */}
        <button
          data-testid="project-item-none"
          className={`${styles.projectItem} ${selectedNav === 'project:none' ? styles.projectItemActive : ''}`}
          onClick={() => onNavChange('project:none')}
        >
          <span className={styles.projectInfo}>
            <span className={styles.projectIcon}>◇</span>
            {t('sidebar.uncategorized')}
          </span>
        </button>

        {/* Project list */}
        {projects.map((p) => (
          <button
            key={p.id}
            data-testid={`project-item-${p.id}`}
            className={`${styles.projectItem} ${selectedNav === `project:${p.id}` ? styles.projectItemActive : ''}`}
            onClick={() => !editingProjectId && onNavChange(`project:${p.id}`)}
            onContextMenu={(e) => handleContextMenu(e, p.id)}
          >
            <span className={styles.projectInfo}>
              <span className={styles.projectIcon}>◫</span>
              {editingProjectId === p.id ? (
                <input
                  data-testid="inline-rename-input"
                  className={styles.inlineRenameInput}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit()
                    if (e.key === 'Escape') handleRenameCancel()
                  }}
                  onBlur={handleRenameSubmit}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                p.name
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Shared projects */}
      <SharedProjectList
        projects={sharedProjects}
        selectedNav={selectedNav}
        onSelect={(id) => onNavChange(`project:${id}`)}
      />

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed' }}
        >
          <button
            className={styles.contextMenuItem}
            onClick={(e) => {
              e.stopPropagation()
              handleRename(contextMenu.projectId)
            }}
          >
            {t('sidebar.rename')}
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(contextMenu.projectId)
            }}
          >
            {t('sidebar.delete')}
          </button>
        </div>
      )}

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
