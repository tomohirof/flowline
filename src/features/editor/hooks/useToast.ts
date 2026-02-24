import { useState, useEffect } from 'react'

const uid = (): string => crypto.randomUUID()

export interface ToastData {
  id: string
  type: 'confirm' | 'success'
  message: string
  detail?: string
  onConfirm?: () => void
  crossingCount?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  // Auto-dismiss success toasts after 3 seconds
  const successToastIds = toasts
    .filter((t) => t.type === 'success')
    .map((t) => t.id)
    .join(',')

  useEffect(() => {
    if (!successToastIds) return
    const ids = new Set(successToastIds.split(','))
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.has(t.id)))
    }, 3000)
    return () => clearTimeout(timer)
  }, [successToastIds])

  const addConfirmToast = (
    toast: Omit<ToastData, 'id' | 'type'> & { crossingCount?: number },
  ): void => {
    setToasts((prev) => [
      ...prev.filter((t) => t.type !== 'confirm'),
      { ...toast, id: uid(), type: 'confirm' as const },
    ])
  }

  const dismissToast = (id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const confirmToast = (id: string, crossingCount?: number): void => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id)
      toast?.onConfirm?.()
      return [
        ...prev.filter((t) => t.id !== id),
        {
          id: uid(),
          type: 'success' as const,
          message: `${crossingCount ?? 1}本の矢印を整理しました`,
        },
      ]
    })
  }

  return { toasts, addConfirmToast, dismissToast, confirmToast }
}
