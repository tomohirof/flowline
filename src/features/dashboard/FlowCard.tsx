import { useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { FlowSummary } from '../editor/types'
import { PALETTES } from '../editor/theme-constants'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { FlowThumbnail } from './FlowThumbnail'
import { ProjectBadge } from './ProjectBadge'
import styles from './FlowCard.module.css'

interface FlowCardProps {
  flow: FlowSummary
  onDelete: (id: string, title: string) => void
  onRename: (id: string, newTitle: string) => void
  onContextMenu: (id: string, x: number, y: number) => void
  deleting?: boolean
  isHovered: boolean
  onHover: (id: string | null) => void
  renamingId: string | null
  isTrash?: boolean
  onRestore?: (id: string) => void
  projectName?: string
}

const DEFAULT_LANE_COUNT = 3
const DEFAULT_NODE_COUNT = 5

export function FlowCard({
  flow,
  onDelete,
  onRename,
  onContextMenu,
  deleting = false,
  isHovered,
  onHover,
  renamingId,
  isTrash = false,
  onRestore,
  projectName,
}: FlowCardProps) {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const isRenaming = renamingId === flow.id
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Focus and select input when entering rename mode via callback ref
  const renameRefCallback = useCallback(
    (node: HTMLInputElement | null) => {
      renameInputRef.current = node
      if (node && isRenaming) {
        node.value = flow.title
        requestAnimationFrame(() => {
          node.focus()
          node.select()
        })
      }
    },
    [isRenaming, flow.title],
  )

  // Also handle focus when isRenaming changes for already-mounted input
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.value = flow.title
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [isRenaming, flow.title])

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(flow.id, flow.title)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onContextMenu(flow.id, rect.left, rect.bottom)
  }

  const handleRenameSubmit = () => {
    const trimmed = (renameInputRef.current?.value ?? '').trim()
    if (trimmed && trimmed !== flow.title) {
      onRename(flow.id, trimmed)
    } else {
      onRename(flow.id, flow.title)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      onRename(flow.id, flow.title)
    }
  }

  const laneColors = PALETTES.slice(0, DEFAULT_LANE_COUNT).map((p) => p.dot)

  return (
    <div
      data-testid={`flow-card-${flow.id}`}
      className={`${styles.card}${isHovered ? ` ${styles.cardHovered}` : ''}`}
      onMouseEnter={() => onHover(flow.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={styles.thumbnail}>
        <FlowThumbnail
          themeId={flow.themeId}
          laneCount={DEFAULT_LANE_COUNT}
          nodeCount={DEFAULT_NODE_COUNT}
        />

        {isHovered && (
          <div className={styles.hoverOverlay}>
            {isTrash ? (
              <>
                <button
                  data-testid={`restore-flow-${flow.id}`}
                  className={styles.openButton}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRestore?.(flow.id)
                  }}
                >
                  {t('dashboard:action.restore')}
                </button>
                <button
                  data-testid={`permanent-delete-${flow.id}`}
                  className={`${styles.openButton} ${styles.dangerButton}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelete(flow.id, flow.title)
                  }}
                >
                  {t('dashboard:action.permanentDelete')}
                </button>
              </>
            ) : (
              <Link
                to={`/flows/${flow.id}`}
                data-testid={`flow-link-${flow.id}`}
                className={styles.openButton}
              >
                {t('common:open')}
              </Link>
            )}
          </div>
        )}

        {isHovered && (
          <button
            data-testid={`card-menu-${flow.id}`}
            className={styles.menuButton}
            onClick={handleMenuClick}
            aria-label={t('common:menu')}
          >
            &#x22EF;
          </button>
        )}
      </div>

      <div className={styles.info}>
        {isRenaming ? (
          <input
            data-testid={`rename-input-${flow.id}`}
            ref={renameRefCallback}
            type="text"
            className={styles.renameInput}
            defaultValue={flow.title}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
          />
        ) : (
          <div className={styles.title}>{flow.title}</div>
        )}

        <div className={styles.meta}>
          <div className={styles.laneDots}>
            {laneColors.map((color, i) => (
              <span
                key={i}
                data-testid="lane-dot"
                className={styles.laneDot}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className={styles.updatedAt}>
            {isTrash && flow.deletedAt
              ? t('dashboard:deleteTime', {
                  time: formatRelativeTime(flow.deletedAt, i18n.language),
                })
              : t('dashboard:updateTime', {
                  time: formatRelativeTime(flow.updatedAt, i18n.language),
                })}
          </span>
          <ProjectBadge name={projectName} />
          {flow.shareToken && (
            <span data-testid={`share-badge-${flow.id}`} className={styles.shareBadge}>
              {t('dashboard:action.shared')}
            </span>
          )}
        </div>
      </div>

      {!isHovered && (
        <Link
          to={`/flows/${flow.id}`}
          data-testid={`flow-link-${flow.id}`}
          className={styles.hiddenLink}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      <button
        data-testid={`delete-flow-${flow.id}`}
        onClick={handleDelete}
        disabled={deleting}
        className={styles.hiddenDelete}
        tabIndex={-1}
        aria-hidden="true"
      >
        {deleting ? t('dashboard:action.deleting') : t('common:delete')}
      </button>
    </div>
  )
}
