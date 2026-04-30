import { useRef, useState } from 'react'
import type { InternalArrow, TaskData, RowData, InternalLane } from '../types'
import { findClosestUpstream, findCrossingArrows } from '../auto-connect'
import { uid } from '../../../lib/uid'

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
  // Arrow IDs auto-split by autoConnectOnCreate within the current event.
  // detectCrossing (called right after in the same handler) excludes them so
  // the user isn't offered a toast to re-split an arrow that was already rewired.
  const autoSplitHandledRef = useRef<Set<string>>(new Set())

  const autoConnectOnCreate = (taskKey: string, ri: number, li: number): void => {
    if (!autoConnect || Object.keys(tasks).length < 1) return
    const result = findClosestUpstream(tasks, rows, lanes, ri, li, arrows)
    if (!result) return
    const bestKey = result.key
    const splitArrowId = result.splitArrowId

    // Step 2.5 hit: splice only the matched arrow (targeted).
    // Otherwise (Step 1/2/3): if upstream is in a row above, splice all of its
    // outgoing arrows whose target is below the new node (broad — preserves
    // existing same-lane chain insertion behavior).
    let splitArrows: InternalArrow[]
    if (splitArrowId) {
      splitArrows = arrows.filter((a) => a.id === splitArrowId)
    } else {
      const bestTask = tasks[bestKey]
      const bestRi = bestTask ? rows.findIndex((r) => r.id === bestTask.rid) : -1
      splitArrows =
        bestRi >= 0 && bestRi < ri
          ? arrows.filter((a) => {
              if (a.from !== bestKey) return false
              const toTask = tasks[a.to]
              if (!toTask) return false
              const toRi = rows.findIndex((r) => r.id === toTask.rid)
              return toRi > ri
            })
          : []
    }

    const splitIds = new Set(splitArrows.map((a) => a.id))
    autoSplitHandledRef.current = splitIds
    setArrows((prev) => {
      const filtered = prev.filter((a) => !splitIds.has(a.id))
      const additions: InternalArrow[] = [{ id: uid(), from: bestKey, to: taskKey, comment: '' }]
      for (const s of splitArrows) {
        additions.push({ id: uid(), from: taskKey, to: s.to, comment: s.comment })
      }
      return [...filtered, ...additions]
    })
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
    if (!recentInsertedRow || rid !== recentInsertedRow.rowId) {
      autoSplitHandledRef.current = new Set()
      return
    }
    const insertedIndex = rows.findIndex((r) => r.id === recentInsertedRow.rowId)
    if (insertedIndex >= 0) {
      const handled = autoSplitHandledRef.current
      const crossing = findCrossingArrows(arrows, tasks, rows, insertedIndex).filter(
        (a) => !handled.has(a.id),
      )
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
    autoSplitHandledRef.current = new Set()
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
