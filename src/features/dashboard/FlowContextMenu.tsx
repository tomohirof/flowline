import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './FlowContextMenu.module.css'

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
}: FlowContextMenuProps) {
  const { t } = useTranslation(['dashboard', 'common'])
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

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

  return (
    <div
      ref={menuRef}
      data-testid="context-menu"
      className={styles.menu}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item === 'sep') {
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
      })}
    </div>
  )
}
