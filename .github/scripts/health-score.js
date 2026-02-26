import fs from 'fs'

let score = 100
let knipAvailable = false
const categories = {
  files: 0,
  dependencies: 0,
  exports: 0,
  types: 0,
}

try {
  const knip = JSON.parse(fs.readFileSync('knip-output.json', 'utf-8'))
  knipAvailable = true

  categories.files = knip.files?.length || 0

  if (Array.isArray(knip.issues)) {
    for (const issue of knip.issues) {
      categories.dependencies +=
        (issue.dependencies?.length || 0) +
        (issue.devDependencies?.length || 0) +
        (issue.unlisted?.length || 0)
      categories.exports += issue.exports?.length || 0
      categories.types += issue.types?.length || 0
    }
  }

  const total = categories.files + categories.dependencies + categories.exports + categories.types

  score -= total * 5
} catch {
  // knip-output.json not found or invalid
}

if (score < 0) score = 0

const status = score >= 80 ? '✅' : '❌'

const lines = ['## 🤖 Repository Health', '', `Health Score: ${score} ${status}`, '']

const total = categories.files + categories.dependencies + categories.exports + categories.types

if (!knipAvailable) {
  lines.push('knip result unavailable')
} else if (total > 0) {
  if (categories.files > 0) lines.push(`Unused files: ${categories.files}`)
  if (categories.dependencies > 0) lines.push(`Unused dependencies: ${categories.dependencies}`)
  if (categories.exports > 0) lines.push(`Unused exports: ${categories.exports}`)
  if (categories.types > 0) lines.push(`Unused types: ${categories.types}`)
} else {
  lines.push('No issues found 🎉')
}

lines.push('')

fs.writeFileSync('health-report.md', lines.join('\n'))
