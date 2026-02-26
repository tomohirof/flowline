import type { ReactNode } from 'react'

export const I: Record<string, ReactNode> = {
  cursor: (
    <path
      d="M4 4l7 7-3 1 2 5-2.5 1-2-5-2.5 2.5z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  ),
  connect: (
    <>
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="12" r="2" fill="currentColor" />
    </>
  ),
  export: (
    <>
      <path
        d="M12 3v12M12 15l-4-4m4 4l4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line
        x1="8"
        y1="11"
        x2="14"
        y2="11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="8"
        x2="11"
        y2="14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="20"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <line
        x1="8"
        y1="11"
        x2="14"
        y2="11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="16"
        x2="20"
        y2="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  addRow: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="3"
        y="13"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rmRow: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="3"
        y="13"
        width="18"
        height="6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="3,2"
      />
    </>
  ),
}

export const Ico = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </svg>
)
