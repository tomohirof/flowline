import { Link } from 'react-router-dom'
import type { FlowSummary } from '../editor/types'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import styles from './FlowCard.module.css'

interface FlowCardProps {
  flow: FlowSummary
  onDelete: (id: string, title: string) => void
  deleting?: boolean
}

export function FlowCard({ flow, onDelete, deleting = false }: FlowCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(flow.id, flow.title)
  }

  return (
    <div data-testid={`flow-card-${flow.id}`} className={styles.card}>
      <Link to={`/flows/${flow.id}`} data-testid={`flow-link-${flow.id}`} className={styles.link}>
        <div className={styles.title}>{flow.title}</div>
        <div className={styles.updatedAt}>更新: {formatRelativeTime(flow.updatedAt)}</div>
        {flow.shareToken && (
          <span data-testid={`share-badge-${flow.id}`} className={styles.shareBadge}>
            共有中
          </span>
        )}
      </Link>
      <div className={styles.actions}>
        <button
          data-testid={`delete-flow-${flow.id}`}
          onClick={handleDelete}
          disabled={deleting}
          className={`${styles.deleteBtn}${deleting ? ` ${styles.deleteBtnDisabled}` : ''}`}
        >
          {deleting ? '削除中...' : '削除'}
        </button>
      </div>
    </div>
  )
}
