import { useEffect } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string
  icon?: string
  onClose: () => void
}

export function Toast({ message, icon, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div data-testid="toast" className={styles.toast}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{message}</span>
    </div>
  )
}
