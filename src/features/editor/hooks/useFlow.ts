import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, ApiError } from '../../../lib/api'
import type { Flow, FlowDetailResponse, FlowSavePayload, SaveStatus } from '../types'

const DEBOUNCE_MS = 2000
const MAX_RETRIES = 3
const RETRY_INTERVAL_MS = 3000

export function useFlow(flowId: string) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState<boolean>(!!flowId)
  const [error, setError] = useState<string | null>(flowId ? null : 'フローIDが指定されていません')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')

  const pendingPayloadRef = useRef<FlowSavePayload | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef<number>(0)
  const flowIdRef = useRef<string>(flowId)

  // Track current flowId to avoid stale saves
  useEffect(() => {
    flowIdRef.current = flowId
  }, [flowId])

  // =============================================
  // Reset state when flowId changes (render-time adjustment)
  // =============================================

  const [prevFlowId, setPrevFlowId] = useState(flowId)
  if (prevFlowId !== flowId) {
    setPrevFlowId(flowId)
    setFlow(null)
    setError(flowId ? null : 'フローIDが指定されていません')
    setSaveStatus('saved')
    setLoading(!!flowId)
  }

  // =============================================
  // Load flow (and cleanup refs when flowId changes)
  // =============================================

  useEffect(() => {
    // Cleanup refs on flowId change
    pendingPayloadRef.current = null
    retryCountRef.current = 0
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    if (!flowId) return

    let cancelled = false

    apiFetch<FlowDetailResponse>(`/flows/${flowId}`)
      .then((data) => {
        if (!cancelled) {
          setFlow(data.flow)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message)
          } else {
            setError('フローの読み込みに失敗しました')
          }
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [flowId])

  // =============================================
  // Cleanup debounce on unmount
  // =============================================

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [])

  // =============================================
  // Perform save to API
  // =============================================

  const performSaveRef = useRef<(() => Promise<void>) | null>(null)

  const performSave = useCallback(async () => {
    const payload = pendingPayloadRef.current
    if (!payload || !flowIdRef.current) return

    setSaveStatus('saving')

    try {
      const data = await apiFetch<FlowDetailResponse>(`/flows/${flowIdRef.current}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      // Clear payload only after successful save
      pendingPayloadRef.current = null
      retryCountRef.current = 0
      setFlow(data.flow)
      setSaveStatus('saved')
    } catch {
      // Payload is preserved in pendingPayloadRef for retry
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          performSaveRef.current?.()
        }, RETRY_INTERVAL_MS)
        // Keep saveStatus as 'saving' during retries
      } else {
        retryCountRef.current = 0
        setSaveStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])

  // =============================================
  // updateFlow - debounced save
  // =============================================

  const updateFlow = useCallback(
    (payload: FlowSavePayload) => {
      pendingPayloadRef.current = payload
      setSaveStatus('unsaved')

      // Reset retry state when user makes a new edit
      retryCountRef.current = 0
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }

      // Cancel existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        performSave()
      }, DEBOUNCE_MS)
    },
    [performSave],
  )

  // =============================================
  // saveNow - immediate save (for Ctrl+S)
  // =============================================

  const saveNow = useCallback(() => {
    // Cancel pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Only save if there are pending changes
    if (pendingPayloadRef.current) {
      performSave()
    }
  }, [performSave])

  // =============================================
  // retrySave - manual retry after error
  // =============================================

  const retrySave = useCallback(() => {
    retryCountRef.current = 0
    performSave()
  }, [performSave])

  return {
    flow,
    loading,
    error,
    saveStatus,
    updateFlow,
    saveNow,
    retrySave,
  }
}
