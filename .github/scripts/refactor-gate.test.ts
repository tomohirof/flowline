import { describe, it, expect, vi } from 'vitest'
import { evaluateRefactorGate } from './refactor-gate.js'

function makeDeps(
  overrides: {
    score?: number
    openPRs?: number
    lastMergeIsRefactor?: boolean
  } = {},
) {
  return {
    readScore: vi.fn(() => overrides.score ?? 100),
    countOpenPRs: vi.fn(() => overrides.openPRs ?? 0),
    checkLastMergeLabel: vi.fn(() => overrides.lastMergeIsRefactor ?? false),
  }
}

describe('evaluateRefactorGate', () => {
  it('should return needsRefactor=true when score < 80 and no locks', () => {
    const deps = makeDeps({ score: 75 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 75, needsRefactor: true })
  })

  it('should return needsRefactor=false when score >= 80', () => {
    const deps = makeDeps({ score: 85 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 85, needsRefactor: false })
  })

  it('should return needsRefactor=false when score is exactly 80', () => {
    const deps = makeDeps({ score: 80 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 80, needsRefactor: false })
  })

  it('should skip when Healing Lock is active (open ai-refactor PR exists)', () => {
    const deps = makeDeps({ score: 50, openPRs: 1 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 50, needsRefactor: false })
  })

  it('should skip when last merged PR has ai-refactor label (loop prevention)', () => {
    const deps = makeDeps({ score: 50, lastMergeIsRefactor: true })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 50, needsRefactor: false })
  })

  it('should not call checkLastMergeLabel when Healing Lock is active', () => {
    const deps = makeDeps({ score: 50, openPRs: 1, lastMergeIsRefactor: true })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 50, needsRefactor: false })
    expect(deps.checkLastMergeLabel).not.toHaveBeenCalled()
  })

  it('should return needsRefactor=false when score is 0 but Healing Lock active', () => {
    const deps = makeDeps({ score: 0, openPRs: 2 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 0, needsRefactor: false })
  })

  it('should handle score of 0 with no locks', () => {
    const deps = makeDeps({ score: 0 })
    const result = evaluateRefactorGate(deps)
    expect(result).toEqual({ score: 0, needsRefactor: true })
  })
})
