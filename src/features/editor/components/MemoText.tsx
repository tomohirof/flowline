import { Fragment } from 'react'
import { splitTextWithUrls } from '../memo-utils'

type Props = {
  text: string
  color: string
}

export function MemoText({ text, color }: Props) {
  const segments = splitTextWithUrls(text)
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: '1.55',
        color,
        fontFamily: 'inherit',
        padding: '5px 8px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {segments.map((seg, i) =>
        seg.type === 'url' ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              color,
              textDecoration: 'underline',
              pointerEvents: 'auto',
              userSelect: 'auto',
              overflowWrap: 'anywhere',
            }}
          >
            {seg.value}
          </a>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </div>
  )
}
