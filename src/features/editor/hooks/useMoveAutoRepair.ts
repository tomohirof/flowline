import { useRef, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { InternalArrow, TaskData, RowData } from '../types'
import {
  findChain,
  detectReorder,
  reconnectChain,
  detectCrossLaneRewire,
  type CrossLaneRewire,
} from '../../../lib/flow-engine'
import { uid } from '../../../lib/uid'

interface UseMoveAutoRepairOptions {
  arrows: InternalArrow[]
  setArrows: Dispatch<SetStateAction<InternalArrow[]>>
  tasks: Record<string, TaskData>
  rows: RowData[]
  addConfirmToast: (toast: {
    message: string
    detail?: string
    onConfirm?: () => void
    crossingCount?: number
  }) => void
}

export function useMoveAutoRepair({
  arrows,
  setArrows,
  tasks,
  rows,
  addConfirmToast,
}: UseMoveAutoRepairOptions) {
  const pendingCrossLaneRef = useRef<CrossLaneRewire[] | null>(null)
  const [repairPreview, setRepairPreview] = useState<{
    nodes: string[]
    proposedArrows: { from: string; to: string }[]
  } | null>(null)

  // Cross-lane rewire detection (fires after chain reconnection updates arrows)
  // arrows is required in deps: onConfirm sets the ref, then setArrows triggers
  // a re-render with new arrows reference, causing this effect to fire.
  // tasks is included for label display only; changes early-return via ref guard.
  useEffect(() => {
    const pending = pendingCrossLaneRef.current
    if (!pending) return
    pendingCrossLaneRef.current = null

    const detailLines = pending.map((r) => {
      const oldLabel = tasks[r.oldFrom]?.label ?? '?'
      const newLabel = tasks[r.newFrom]?.label ?? '?'
      const toLabel = tasks[r.to]?.label ?? '?'
      return `${oldLabel} → ${toLabel}\n↓\n${newLabel} → ${toLabel}`
    })

    const rewireNodes = new Set<string>()
    pending.forEach((r) => {
      rewireNodes.add(r.newFrom)
      rewireNodes.add(r.to)
    })
    setRepairPreview({
      nodes: [...rewireNodes],
      proposedArrows: pending.map((r) => ({ from: r.newFrom, to: r.to })),
    })

    addConfirmToast({
      message: '横矢印の張り替え',
      detail: detailLines.join('\n'),
      onConfirm: () => {
        setRepairPreview(null)
        setArrows((prev) =>
          prev.map((a) => {
            const match = pending.find((r) => r.arrowId === a.id)
            if (!match) return a
            return { ...a, from: match.newFrom, comment: match.comment }
          }),
        )
      },
      crossingCount: pending.length,
    })
  }, [arrows, tasks, setArrows, addConfirmToast])

  // Synchronous chain detection — called directly from moveTask
  const triggerMoveRepairCheck = (
    movedKey: string,
    laneId: string,
    currentArrows: InternalArrow[],
    currentTasks: Record<string, TaskData>,
  ): void => {
    const chain = findChain(currentArrows, currentTasks, laneId)
    if (chain.length < 3) return
    if (!chain.includes(movedKey)) return

    const { changed, current, proposed } = detectReorder(chain, currentTasks, rows)
    if (!changed) return

    const detail = proposed.map((k) => currentTasks[k]?.label ?? '?').join(' → ')
    const arrowCount = proposed.length - 1

    const chainKeySet = new Set(chain)
    const oldChainArrows = currentArrows.filter(
      (a) => chainKeySet.has(a.from) && chainKeySet.has(a.to),
    )

    // Pre-compute cross-lane rewires before chain reconnection
    const crossLaneRewires = detectCrossLaneRewire(
      current,
      proposed,
      currentArrows,
      currentTasks,
      rows,
    )

    // Set repair preview for visual feedback
    const proposedArrowPairs = reconnectChain(proposed)
    setRepairPreview({
      nodes: [...proposed],
      proposedArrows: proposedArrowPairs,
    })

    addConfirmToast({
      message: '接続順を修復しますか？',
      detail: `接続順を修復: ${detail}`,
      onConfirm: () => {
        setRepairPreview(null)
        setArrows((prev) => {
          const oldIds = new Set(oldChainArrows.map((a) => a.id))
          const filtered = prev.filter((a) => !oldIds.has(a.id))

          const commentMap = new Map<string, string>()
          for (const a of oldChainArrows) {
            if (a.comment) {
              commentMap.set(`${a.from}->${a.to}`, a.comment)
              commentMap.set(`${a.to}->${a.from}`, a.comment)
            }
          }

          const newPairs = reconnectChain(proposed)
          const newArrows: InternalArrow[] = newPairs.map((p) => ({
            id: uid(),
            from: p.from,
            to: p.to,
            comment: commentMap.get(`${p.from}->${p.to}`) ?? '',
          }))

          return [...filtered, ...newArrows]
        })

        // Queue cross-lane rewire toast
        if (crossLaneRewires.length > 0) {
          pendingCrossLaneRef.current = crossLaneRewires
        }
      },
      crossingCount: arrowCount,
    })
  }

  const clearRepairPreview = (): void => {
    setRepairPreview(null)
  }

  return { triggerMoveRepairCheck, repairPreview, clearRepairPreview }
}
