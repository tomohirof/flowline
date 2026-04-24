import { useTranslation } from 'react-i18next'
import styles from './DashboardSidebar.module.css'

export interface SharedProject {
  id: string
  name: string
  ownerName: string
}

interface Props {
  projects: SharedProject[]
  selectedNav: string
  onSelect: (projectId: string) => void
}

export function SharedProjectList({ projects, selectedNav, onSelect }: Props) {
  const { t } = useTranslation(['project'])
  if (projects.length === 0) return null

  return (
    <div className={styles.sharedProjectsSection} data-testid="shared-projects-section">
      <div className={styles.sectionTitle}>{t('project:sharedProjects.title')}</div>
      {projects.map((p) => {
        const isActive = selectedNav === `project:${p.id}`
        return (
          <button
            key={p.id}
            type="button"
            data-testid={`shared-project-${p.id}`}
            className={`${styles.projectItem} ${isActive ? styles.projectItemActive : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className={styles.projectInfo}>
              <span className={styles.projectIcon}>◫</span>
              <span>{p.name}</span>
              <span className={styles.ownerLabel}>
                {t('project:sharedProjects.ownerLabel', {
                  name: p.ownerName,
                  defaultValue: `(${p.ownerName})`,
                })}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
