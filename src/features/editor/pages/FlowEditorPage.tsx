import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useFlow } from '../hooks/useFlow'
import FlowEditor from '../FlowEditor'
import styles from './FlowEditorPage.module.css'

export function FlowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { flow, loading, error, saveStatus, updateFlow, saveNow } = useFlow(id ?? '')

  // Ctrl+S handler for immediate save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveNow])

  if (loading) {
    return (
      <div className={`${styles.centerScreen} ${styles.loading}`}>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${styles.centerScreen} ${styles.error}`}>
        <p>{error}</p>
      </div>
    )
  }

  if (!flow) {
    return null
  }

  return <FlowEditor flow={flow} onSave={updateFlow} saveStatus={saveStatus} />
}
