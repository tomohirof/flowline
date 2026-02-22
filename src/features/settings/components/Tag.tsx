import styles from './Tag.module.css'

interface TagProps {
  label: string
  active: boolean
  onClick: () => void
}

export function Tag({ label, active, onClick }: TagProps) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`${styles.tag} ${active ? styles.tagActive : ''}`}
    >
      {label}
    </button>
  )
}
