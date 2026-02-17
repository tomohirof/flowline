import { Link } from 'react-router-dom'
import type { FlowSummary } from '../editor/types'
import { formatRelativeTime } from '../../utils/formatRelativeTime'

interface FlowCardProps {
  flow: FlowSummary
  onDelete: (id: string, title: string) => void
}

export function FlowCard({ flow, onDelete }: FlowCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(flow.id, flow.title)
  }

  return (
    <div
      data-testid={`flow-card-${flow.id}`}
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E8E8EE',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#7C5CFC'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(124,92,252,0.10)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#E8E8EE'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <Link
        to={`/flows/${flow.id}`}
        data-testid={`flow-link-${flow.id}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          padding: '20px 18px 14px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#333',
            marginBottom: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {flow.title}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          更新: {formatRelativeTime(flow.updatedAt)}
        </div>
        {flow.shareToken && (
          <span
            data-testid={`share-badge-${flow.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: '#7C5CFC',
              background: '#F0ECFF',
              padding: '2px 8px',
              borderRadius: 4,
              width: 'fit-content',
            }}
          >
            共有中
          </span>
        )}
      </Link>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0 12px 12px',
        }}
      >
        <button
          data-testid={`delete-flow-${flow.id}`}
          onClick={handleDelete}
          style={{
            background: 'none',
            border: 'none',
            color: '#CCC',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 4,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = '#E53935'
            ;(e.currentTarget as HTMLElement).style.background = '#FFEBEE'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = '#CCC'
            ;(e.currentTarget as HTMLElement).style.background = 'none'
          }}
        >
          削除
        </button>
      </div>
    </div>
  )
}
