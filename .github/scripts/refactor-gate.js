/* global console, process */
import fs from 'fs'
import { execSync } from 'child_process'

const HEALTH_THRESHOLD = 80

/**
 * Core logic for refactor gate decision.
 * Extracted for testability.
 */
export function evaluateRefactorGate({ readScore, countOpenPRs, checkLastMergeLabel }) {
  const score = readScore()
  const openCount = countOpenPRs()
  const lastMergeIsRefactor = checkLastMergeLabel()

  let needsRefactor = false

  if (openCount > 0) {
    console.log('Healing Lock: ai-refactor PR already exists → skip')
  } else if (lastMergeIsRefactor) {
    console.log('Loop prevention: last merged PR is ai-refactor → skip')
  } else if (score < HEALTH_THRESHOLD) {
    console.log(`Health Score ${score} < ${HEALTH_THRESHOLD} → needs refactor`)
    needsRefactor = true
  } else {
    console.log(`Health Score ${score} >= ${HEALTH_THRESHOLD} → healthy`)
  }

  return { score, needsRefactor }
}

// --- Script entry point (only runs when executed directly) ---
if (process.env.GITHUB_ENV) {
  const result = evaluateRefactorGate({
    readScore() {
      try {
        const parsed = parseInt(fs.readFileSync('health-score.txt', 'utf-8').trim(), 10)
        if (!isNaN(parsed)) return parsed
        console.log('Warning: health-score.txt contains non-numeric value, defaulting to 100')
      } catch {
        console.log('health-score.txt missing')
      }
      return 100
    },

    countOpenPRs() {
      if (process.env.MOCK_PR_COUNT !== undefined) {
        const parsed = parseInt(process.env.MOCK_PR_COUNT, 10)
        return isNaN(parsed) ? 0 : parsed
      }
      try {
        const out = execSync(
          'gh pr list --label "ai-refactor" --state open --json number --jq "length"',
          { encoding: 'utf8' },
        ).trim()
        const parsed = parseInt(out, 10)
        if (isNaN(parsed)) {
          console.log('Warning: could not parse PR count, assuming 0')
          return 0
        }
        return parsed
      } catch {
        console.log('Failed to check existing refactor PRs')
        return 0
      }
    },

    checkLastMergeLabel() {
      if (process.env.MOCK_LAST_MERGE_LABEL !== undefined) {
        return process.env.MOCK_LAST_MERGE_LABEL === 'ai-refactor'
      }
      try {
        const labels = execSync(
          'gh pr list --state merged --base main --limit 1 --json labels --jq ".[0].labels[].name"',
          { encoding: 'utf8' },
        ).trim()
        return labels.split('\n').includes('ai-refactor')
      } catch {
        console.log('Failed to check last merged PR labels')
        return false
      }
    },
  })

  fs.appendFileSync(process.env.GITHUB_ENV, `HEALTH_SCORE=${result.score}\n`)
  fs.appendFileSync(
    process.env.GITHUB_ENV,
    `NEEDS_REFACTOR=${result.needsRefactor ? 'true' : 'false'}\n`,
  )
}
