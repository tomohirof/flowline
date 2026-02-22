import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onChange}
      className={`${styles.track} ${checked ? styles.trackOn : ''} ${disabled ? styles.trackDisabled : ''}`}
    >
      <span className={`${styles.thumb} ${checked ? styles.thumbOn : ''}`} />
    </button>
  )
}
