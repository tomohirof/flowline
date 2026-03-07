import { useState, useCallback } from 'react'
import type { Flow, FlowSavePayload, SaveStatus } from '../types'

const DEMO_FLOW: Flow = {
  id: 'demo',
  title: '無題のフロー',
  themeId: 'cloud',
  shareToken: null,
  projectId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lanes: [
    { id: 'lane-1', name: 'lane1', colorIndex: 0, position: 0 },
    { id: 'lane-2', name: 'lane2', colorIndex: 1, position: 1 },
    { id: 'lane-3', name: 'lane3', colorIndex: 2, position: 2 },
    { id: 'lane-4', name: 'lane4', colorIndex: 3, position: 3 },
  ],
  nodes: [],
  arrows: [],
}

export function useDemoFlow() {
  const [flow] = useState<Flow>(() => ({
    ...DEMO_FLOW,
    lanes: DEMO_FLOW.lanes.map((l) => ({ ...l })),
  }))

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateFlow = useCallback((_payload: FlowSavePayload) => {
    // noop — demo mode does not save to API
  }, [])

  const saveNow = useCallback(() => {
    // noop
  }, [])

  const retrySave = useCallback(() => {
    // noop
  }, [])

  return {
    flow,
    loading: false,
    error: null as string | null,
    saveStatus: 'saved' as SaveStatus,
    updateFlow,
    saveNow,
    retrySave,
  }
}
