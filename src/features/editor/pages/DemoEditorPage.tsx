import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoFlow } from '../hooks/useDemoFlow'
import FlowEditor from '../FlowEditor'
import { AuthModal } from '../../landing/components/AuthModal'
import { apiFetch } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import type { FlowDetailResponse } from '../types'

export function DemoEditorPage() {
  const { flow, saveStatus } = useDemoFlow()
  const [showAuth, setShowAuth] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleMigrateFlow = useCallback(async () => {
    try {
      const res = await apiFetch<FlowDetailResponse>('/flows', {
        method: 'POST',
        body: JSON.stringify({
          title: flow.title,
          themeId: flow.themeId,
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

  const noop = useCallback(() => {}, [])

  return (
    <>
      <FlowEditor
        flow={flow}
        onSave={noop}
        saveStatus={saveStatus}
        saveCtaLabel="ログインして保存"
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
