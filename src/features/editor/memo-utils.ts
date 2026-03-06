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

/** Estimate visual width of a string in units of ~5.5px (half of 11px font). */
function estimateTextWidth(str: string): number {
  let w = 0
  for (const ch of str) {
    // CJK and fullwidth characters take ~2x width of ASCII
    w += ch.charCodeAt(0) > 0x7f ? 2 : 1
  }
  return w
}

export function measureMemoHeight(text: string, width: number): number {
  if (!text) return 30
  // Available width in half-width character units (each unit ≈ 5.5px at 11px font)
  const cpl = Math.floor((width - 16) / 5.5)
  const lines = text
    .split('\n')
    .reduce((a, l) => a + Math.max(1, Math.ceil((estimateTextWidth(l) || 1) / cpl)), 0)
  return Math.max(30, lines * 17 + 14)
}
