import { useState, useEffect, useCallback } from 'react'
import { uid } from '../../../lib/uid'

export interface ToastData {
  id: string
  type: 'confirm' | 'success' | 'error' | 'info'
  message: string
  detail?: string
  onConfirm?: () => void
  onRetry?: () => void
  crossingCount?: number
  confirmLabel?: string
  skipLabel?: string
  successMessage?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  // Auto-dismiss success and info toasts after 3 seconds
  const autoDismissIds = toasts
    .filter((t) => t.type === 'success' || t.type === 'info')
    .map((t) => t.id)
    .join(',')

  useEffect(() => {
    if (!autoDismissIds) return
    const ids = new Set(autoDismissIds.split(','))
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.has(t.id)))
    }, 3000)
    return () => clearTimeout(timer)
  }, [autoDismissIds])

  const addConfirmToast = useCallback(
    (toast: Omit<ToastData, 'id' | 'type'> & { crossingCount?: number }): void => {
      setToasts((prev) => [
        ...prev.filter((t) => t.type !== 'confirm'),
        { ...toast, id: uid(), type: 'confirm' as const },
      ])
    },
    [],
  )

  const dismissToast = (id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const dismissToastByType = useCallback((type: ToastData['type']): void => {
    setToasts((prev) => prev.filter((t) => t.type !== type))
  }, [])

  const confirmToast = (id: string, crossingCount?: number): void => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id)
      if (!toast) return prev
      toast.onConfirm?.()
      const successMsg = toast.successMessage ?? `${crossingCount ?? 1}本の矢印を整理しました`
      return [
        ...prev.filter((t) => t.id !== id),
        {
          id: uid(),
          type: 'success' as const,
          message: successMsg,
        },
      ]
    })
  }

  const addSuccessToast = useCallback((toast: Pick<ToastData, 'message' | 'detail'>): void => {
    setToasts((prev) => [...prev, { ...toast, id: uid(), type: 'success' as const }])
  }, [])

  const addInfoToast = useCallback((toast: Pick<ToastData, 'message' | 'detail'>): void => {
    setToasts((prev) => [...prev, { ...toast, id: uid(), type: 'info' as const }])
  }, [])

  const addErrorToast = useCallback(
    (toast: Pick<ToastData, 'message' | 'detail' | 'onRetry'>): void => {
      setToasts((prev) => [
        ...prev.filter((t) => t.type !== 'error'),
        { ...toast, id: uid(), type: 'error' as const },
      ])
    },
    [],
  )

  return {
    toasts,
    addConfirmToast,
    addSuccessToast,
    addInfoToast,
    addErrorToast,
    dismissToast,
    dismissToastByType,
    confirmToast,
  }
}
