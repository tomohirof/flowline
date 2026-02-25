import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND } from '../../../constants/brand'
import { useDemoFlow } from '../hooks/useDemoFlow'
import FlowEditor from '../FlowEditor'
import { AuthModal } from '../../landing/components/AuthModal'
import { apiFetch } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import type { FlowDetailResponse, FlowSavePayload } from '../types'

export function DemoEditorPage() {
  const { flow, saveStatus } = useDemoFlow()
  const [showAuth, setShowAuth] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const latestPayloadRef = useRef<FlowSavePayload | null>(null)

  const capturePayload = useCallback((payload: FlowSavePayload) => {
    latestPayloadRef.current = payload
  }, [])

  const handleMigrateFlow = useCallback(async () => {
    try {
      const payload = latestPayloadRef.current
      const res = await apiFetch<FlowDetailResponse>('/flows', {
        method: 'POST',
        body: JSON.stringify({
          title: payload?.title ?? flow.title,
          themeId: payload?.themeId ?? flow.themeId,
          lanes: payload?.lanes,
          nodes: payload?.nodes,
          arrows: payload?.arrows,
        }),
      })
      navigate(`/flows/${res.flow.id}`)
    } catch {
      navigate('/flows')
    }
  }, [flow.title, flow.themeId, navigate])

  const handleSaveCtaClick = useCallback(() => {
    if (user) {
      handleMigrateFlow()
    } else {
      setShowAuth(true)
    }
  }, [user, handleMigrateFlow])

  const handleAuthSuccess = useCallback(() => {
    handleMigrateFlow()
  }, [handleMigrateFlow])

  return (
    <>
      <FlowEditor
        flow={flow}
        onSave={capturePayload}
        saveStatus={saveStatus}
        saveCtaLabel={BRAND.demoSaveCta}
        onSaveCtaClick={handleSaveCtaClick}
        hideShare={true}
      />
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        initialMode="register"
        onSuccess={handleAuthSuccess}
      />
    </>
  )
}
