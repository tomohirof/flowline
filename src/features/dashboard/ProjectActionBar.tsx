import { useTranslation } from 'react-i18next'
import styles from './ProjectActionBar.module.css'

interface Props {
  projectName: string
  ownerName: string | null
  role: 'owner' | 'editor'
  onOpenSettings: () => void
  onOpenMembers: () => void
  onLeave: () => void
}

export function ProjectActionBar({
  projectName,
  ownerName,
  role,
  onOpenSettings,
  onOpenMembers,
  onLeave,
}: Props) {
  const { t } = useTranslation(['project'])
  return (
    <div className={styles.bar} data-testid="project-action-bar">
      <div className={styles.title}>
        <span aria-hidden="true">🗂</span> {projectName}
        {role === 'editor' && ownerName && (
          <span className={styles.ownerLabel}>
            {t('project:sharedProjects.ownerLabel', {
              name: ownerName,
              defaultValue: `(${ownerName})`,
            })}
          </span>
        )}
      </div>
      <div className={styles.actions}>
        {role === 'owner' && (
          <>
            <button type="button" onClick={onOpenSettings} data-testid="project-settings-btn">
              ⚙ {t('project:actionBar.settings', { defaultValue: 'Settings' })}
            </button>
            <button type="button" onClick={onOpenMembers} data-testid="project-members-btn">
              👥 {t('project:actionBar.members', { defaultValue: 'Members' })}
            </button>
          </>
        )}
        {role === 'editor' && (
          <>
            <button type="button" onClick={onOpenMembers} data-testid="project-members-btn">
              👥 {t('project:actionBar.members', { defaultValue: 'Members' })}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('project:leave.confirm', { defaultValue: 'Leave this project?' })))
                  onLeave()
              }}
              data-testid="project-leave-btn"
            >
              🚪 {t('project:actionBar.leave', { defaultValue: 'Leave' })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
