import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './FlowContextMenu.module.css'
import type { Project } from '../editor/types'

interface FlowContextMenuProps {
  x: number
  y: number
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
  isTrash?: boolean
  onRestore?: () => void
  onPermanentDelete?: () => void
  projects?: Project[]
  onMoveToProject?: (projectId: string | null) => void
  currentProjectId?: string | null
}

interface MenuItem {
  label: string
  action: () => void
  danger?: boolean
}

export function FlowContextMenu({
  x,
  y,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
  isTrash = false,
  onRestore,
  onPermanentDelete,
  projects,
  onMoveToProject,
  currentProjectId,
}: FlowContextMenuProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const menuRef = useRef<HTMLDivElement>(null)
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const hasMovableTarget = (projects?.length ?? 0) > 0 || currentProjectId != null
  const showMoveOption = !isTrash && projects && onMoveToProject && hasMovableTarget

  const items: (MenuItem | 'sep')[] = isTrash
    ? [
        { label: t('dashboard:action.restore'), action: () => onRestore?.() },
        'sep',
        {
          label: t('dashboard:action.permanentDelete'),
          action: () => onPermanentDelete?.(),
          danger: true,
        },
      ]
    : [
        { label: t('common:open'), action: onOpen },
        { label: t('dashboard:action.rename'), action: onRename },
        { label: t('dashboard:action.duplicate'), action: onDuplicate },
        'sep',
        { label: t('common:delete'), action: onDelete, danger: true },
      ]

  const filteredProjects = projects?.filter((p) => p.id !== currentProjectId) ?? []

  const handleMoveToProject = (projectId: string | null) => {
    onMoveToProject?.(projectId)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      data-testid="context-menu"
      className={styles.menu}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {(() => {
        let insertedMove = false
        return items.map((item, i) => {
          if (item === 'sep') {
            if (showMoveOption && !insertedMove) {
              insertedMove = true
              return (
                <div key={i}>
                  <button
                    onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}
                    className={styles.item}
                  >
                    {t('dashboard:sidebar.moveToProject')}
                  </button>
                  {showMoveSubmenu && (
                    <div className={styles.submenuContainer}>
                      {currentProjectId != null && (
                        <button
                          className={styles.submenuItem}
                          onClick={() => handleMoveToProject(null)}
                        >
                          {t('dashboard:sidebar.uncategorized')}
                        </button>
                      )}
                      {filteredProjects.map((p) => (
                        <button
                          key={p.id}
                          className={styles.submenuItem}
                          onClick={() => handleMoveToProject(p.id)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={styles.separator} />
                </div>
              )
            }
            return <div key={i} className={styles.separator} />
          }
          return (
            <button
              key={i}
              onClick={item.action}
              className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
            >
              {item.label}
            </button>
          )
        })
      })()}
    </div>
  )
}
