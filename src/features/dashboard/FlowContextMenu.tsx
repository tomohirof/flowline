import { useEffect, useRef } from 'react'
import styles from './FlowContextMenu.module.css'

interface FlowContextMenuProps {
  x: number
  y: number
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
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
}: FlowContextMenuProps) {
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

  const items: (MenuItem | 'sep')[] = [
    { label: '開く', action: onOpen },
    { label: '名前を変更', action: onRename },
    { label: '複製', action: onDuplicate },
    'sep',
    { label: '削除', action: onDelete, danger: true },
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
          <div
            key={i}
            onClick={item.action}
            className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
          >
            {item.label}
          </div>
        )
      })}
    </div>
  )
}
