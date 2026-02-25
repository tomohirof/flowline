import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { InternalArrow, TaskData, RowData } from '../types'
import { findChain, detectReorder, reconnectChain } from '../../../lib/flow-engine'
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
  addSuccessToast: (toast: { message: string }) => void
}

interface PendingMove {
  movedKey: string
  laneId: string
}

export function useMoveAutoRepair({
  arrows,
  setArrows,
  tasks,
  rows,
  addConfirmToast,
  addSuccessToast,
}: UseMoveAutoRepairOptions) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  useEffect(() => {
    if (!pendingMove) return
    const { movedKey, laneId } = pendingMove
    setPendingMove(null)

    const chain = findChain(arrows, tasks, laneId)
    if (chain.length < 3) return
    if (!chain.includes(movedKey)) return

    const { changed, proposed } = detectReorder(chain, tasks, rows)
    if (!changed) return

    const detail = proposed.map((k) => tasks[k]?.label ?? '?').join(' → ')
    const arrowCount = proposed.length - 1

    const chainKeySet = new Set(chain)
    const oldChainArrows = arrows.filter((a) => chainKeySet.has(a.from) && chainKeySet.has(a.to))

    addConfirmToast({
      message: '接続順を修復しますか？',
      detail: `接続順を修復: ${detail}`,
      onConfirm: () => {
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
        addSuccessToast({
          message: `↻ オートリペア: ${arrowCount}本の矢印を修復しました`,
        })
      },
      crossingCount: arrowCount,
    })
  }, [pendingMove, arrows, tasks, rows, setArrows, addConfirmToast, addSuccessToast])

  const triggerMoveRepairCheck = (movedKey: string, laneId: string): void => {
    setPendingMove({ movedKey, laneId })
  }

  return { triggerMoveRepairCheck }
}
