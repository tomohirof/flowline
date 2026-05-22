import styles from './ProjectBadge.module.css'

interface Props {
  name: string | undefined
}

export function ProjectBadge({ name }: Props) {
  if (!name) return null
  return (
    <span data-testid="project-badge" className={styles.badge} title={name}>
      {name}
    </span>
  )
}
