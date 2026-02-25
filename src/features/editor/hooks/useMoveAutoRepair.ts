import { useRef, useEffect } from 'react'
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
}: UseMoveAutoRepairOptions) {
  const pendingMoveRef = useRef<PendingMove | null>(null)

  useEffect(() => {
    const pending = pendingMoveRef.current
    if (!pending) return
    pendingMoveRef.current = null
    const { movedKey, laneId } = pending

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
      },
      crossingCount: arrowCount,
    })
  }, [arrows, tasks, rows, setArrows, addConfirmToast])

  const triggerMoveRepairCheck = (movedKey: string, laneId: string): void => {
    pendingMoveRef.current = { movedKey, laneId }
  }

  return { triggerMoveRepairCheck }
}
