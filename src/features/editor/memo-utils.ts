import type { MemoData } from './types'

export function parseNote(
  note: string | null,
  laneIndex: number,
  totalLanes: number,
): MemoData | null {
  if (!note) return null
  if (note.startsWith('{')) {
    try {
      const parsed = JSON.parse(note)
      if (
        typeof parsed.text === 'string' &&
        typeof parsed.dx === 'number' &&
        typeof parsed.dy === 'number'
      ) {
        return parsed as MemoData
      }
    } catch {
      // fall through to plain text
    }
  }
  const dx = laneIndex < totalLanes / 2 ? 50 : -50
  return { text: note, dx, dy: 46 }
}

export function serializeMemo(memo: MemoData): string | null {
  if (!memo.text) return null
  return JSON.stringify(memo)
}

export const MEMO_W = 152

export function measureMemoHeight(text: string, width: number): number {
  if (!text) return 30
  const cpl = Math.floor((width - 16) / 11)
  const lines = text
    .split('\n')
    .reduce((a, l) => a + Math.max(1, Math.ceil((l.length || 1) / cpl)), 0)
  return Math.max(30, lines * 17 + 14)
}
