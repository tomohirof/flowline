import { useState } from 'react'
import type { InternalArrow, TaskData, RowData, InternalLane } from '../types'
import { findClosestUpstream, findCrossingArrows } from '../auto-connect'

const uid = (): string => crypto.randomUUID()

interface UseArrowsOptions {
  initialArrows: InternalArrow[]
  tasks: Record<string, TaskData>
  rows: RowData[]
  lanes: InternalLane[]
  autoConnect: boolean
}

export function useArrows({ initialArrows, tasks, rows, lanes, autoConnect }: UseArrowsOptions) {
  const [arrows, setArrows] = useState<InternalArrow[]>(initialArrows)
  const [recentInsertedRow, setRecentInsertedRow] = useState<{ rowId: string } | null>(null)

  const autoConnectOnCreate = (taskKey: string, ri: number, li: number): void => {
    if (!autoConnect || Object.keys(tasks).length < 1) return
    const bestKey = findClosestUpstream(tasks, rows, lanes, ri, li)
    if (bestKey) {
      setArrows((p) => [...p, { id: uid(), from: bestKey, to: taskKey, comment: '' }])
    }
  }

  const detectCrossing = (
    rid: string,
    taskKey: string,
    label: string,
    addConfirmToast: (toast: {
      message: string
      detail?: string
      onConfirm?: () => void
      crossingCount?: number
    }) => void,
  ): void => {
    if (!recentInsertedRow || rid !== recentInsertedRow.rowId) return
    const insertedIndex = rows.findIndex((r) => r.id === recentInsertedRow.rowId)
    if (insertedIndex >= 0) {
      const crossing = findCrossingArrows(arrows, tasks, rows, insertedIndex)
      if (crossing.length > 0) {
        const newNodeKey = taskKey
        const crossingCount = crossing.length
        addConfirmToast({
          message: '挿入した行を経由するよう矢印を整理しますか？',
          detail: crossing
            .map((a) => {
              const fromLabel = tasks[a.from]?.label ?? '?'
              const toLabel = tasks[a.to]?.label ?? '?'
              return `${fromLabel} → ${label} → ${toLabel} に変更`
            })
            .join('\n'),
          onConfirm: () => {
            setArrows((prev) => {
              const crossingIds = new Set(crossing.map((c) => c.id))
              const filtered = prev.filter((a) => !crossingIds.has(a.id))
              const newArrows: typeof prev = []
              for (const c of crossing) {
                newArrows.push({ id: uid(), from: c.from, to: newNodeKey, comment: '' })
                newArrows.push({ id: uid(), from: newNodeKey, to: c.to, comment: '' })
              }
              return [...filtered, ...newArrows]
            })
          },
          crossingCount,
        })
      }
    }
    setRecentInsertedRow(null)
  }

  return {
    arrows,
    setArrows,
    recentInsertedRow,
    setRecentInsertedRow,
    autoConnectOnCreate,
    detectCrossing,
  }
}
