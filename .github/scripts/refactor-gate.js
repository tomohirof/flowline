/* global console, process */
import fs from 'fs'
import { execSync } from 'child_process'

const HEALTH_THRESHOLD = 80

// Read health score
let score = 100
try {
  score = parseInt(fs.readFileSync('health-score.txt', 'utf-8').trim(), 10)
} catch {
  console.log('health-score.txt missing')
}

fs.appendFileSync(process.env.GITHUB_ENV, `HEALTH_SCORE=${score}\n`)

// Check Healing Lock
let openCount = 0
if (process.env.MOCK_PR_COUNT !== undefined) {
  openCount = parseInt(process.env.MOCK_PR_COUNT, 10)
} else {
  try {
    const result = execSync(
      'gh pr list --label "ai-refactor" --state open --json number --jq "length"',
      { encoding: 'utf8' },
    ).trim()
    openCount = parseInt(result, 10)
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
