import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, ApiError } from '../../../lib/api'
import type { Flow, FlowDetailResponse, FlowSavePayload, SaveStatus } from '../types'

const DEBOUNCE_MS = 2000

export function useFlow(flowId: string) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')

  const pendingPayloadRef = useRef<FlowSavePayload | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flowIdRef = useRef<string>(flowId)

  // Track current flowId to avoid stale saves
  flowIdRef.current = flowId

  // =============================================
  // Load flow
  // =============================================

  useEffect(() => {
    // Reset state
    setFlow(null)
    setError(null)
    setSaveStatus('saved')
    pendingPayloadRef.current = null

    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!flowId) {
      setLoading(false)
      setError('フローIDが指定されていません')
      return
    }

    setLoading(true)

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
    }
  }, [])

  // =============================================
  // Perform save to API
  // =============================================

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
      setFlow(data.flow)
      setSaveStatus('saved')
    } catch {
      // Payload is preserved in pendingPayloadRef for retry
      setSaveStatus('error')
    }
  }, [])

  // =============================================
  // updateFlow - debounced save
  // =============================================

  const updateFlow = useCallback(
    (payload: FlowSavePayload) => {
      pendingPayloadRef.current = payload
      setSaveStatus('unsaved')

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

  return {
    flow,
    loading,
    error,
    saveStatus,
    updateFlow,
    saveNow,
  }
}
