/* global console, process */
import fs from 'fs'
import { execSync } from 'child_process'

const HEALTH_THRESHOLD = 80

if (!process.env.GITHUB_ENV) {
  throw new Error('GITHUB_ENV is not set. This script must run inside GitHub Actions.')
}

// Read health score
let score = 100
try {
  const parsed = parseInt(fs.readFileSync('health-score.txt', 'utf-8').trim(), 10)
  if (!isNaN(parsed)) {
    score = parsed
  } else {
    console.log('Warning: health-score.txt contains non-numeric value, defaulting to 100')
  }
} catch {
  console.log('health-score.txt missing')
}

fs.appendFileSync(process.env.GITHUB_ENV, `HEALTH_SCORE=${score}\n`)

// Check Healing Lock
let openCount = 0
if (process.env.MOCK_PR_COUNT !== undefined) {
  const parsed = parseInt(process.env.MOCK_PR_COUNT, 10)
  openCount = isNaN(parsed) ? 0 : parsed
} else {
  try {
    const result = execSync(
      'gh pr list --label "ai-refactor" --state open --json number --jq "length"',
      { encoding: 'utf8' },
    ).trim()
    const parsed = parseInt(result, 10)
    if (isNaN(parsed)) {
      console.log('Warning: could not parse PR count, assuming 0')
      openCount = 0
    } else {
      openCount = parsed
    }
  } catch {
    console.log('Failed to check existing refactor PRs')
  }
}

if (openCount > 0) {
  console.log('Healing Lock: ai-refactor PR already exists → skip')
  fs.appendFileSync(process.env.GITHUB_ENV, 'NEEDS_REFACTOR=false\n')
} else if (score < HEALTH_THRESHOLD) {
  console.log(`Health Score ${score} < ${HEALTH_THRESHOLD} → needs refactor`)
  fs.appendFileSync(process.env.GITHUB_ENV, 'NEEDS_REFACTOR=true\n')
} else {
  console.log(`Health Score ${score} >= ${HEALTH_THRESHOLD} → healthy`)
  fs.appendFileSync(process.env.GITHUB_ENV, 'NEEDS_REFACTOR=false\n')
}
