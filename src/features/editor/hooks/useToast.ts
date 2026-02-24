import { useState, useEffect, useCallback } from 'react'
import { uid } from '../../../lib/uid'

export interface ToastData {
  id: string
  type: 'confirm' | 'success' | 'error'
  message: string
  detail?: string
  onConfirm?: () => void
  onRetry?: () => void
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

  const dismissToastByType = useCallback((type: ToastData['type']): void => {
    setToasts((prev) => prev.filter((t) => t.type !== type))
  }, [])

  const confirmToast = (id: string, crossingCount?: number): void => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id)
      if (!toast) return prev
      toast.onConfirm?.()
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

  const addSuccessToast = useCallback((toast: Pick<ToastData, 'message' | 'detail'>): void => {
    setToasts((prev) => [...prev, { ...toast, id: uid(), type: 'success' as const }])
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
    addErrorToast,
    dismissToast,
    dismissToastByType,
    confirmToast,
  }
}
