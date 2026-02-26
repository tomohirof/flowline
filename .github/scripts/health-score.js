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

// Status indicator: green (80+), yellow (60-79), red (<60)
const indicator = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴'

// Progress bar (20 chars wide)
const filled = Math.round(score / 5)
const empty = 20 - filled
const bar = '█'.repeat(filled) + '░'.repeat(empty)

const lines = [
  '## 🏥 リポジトリ健康診断',
  '',
  `${indicator} **スコア: ${score} / 100**`,
  '',
  `\`${bar}\``,
  '',
]

const total = categories.files + categories.dependencies + categories.exports + categories.types

if (!knipAvailable) {
  lines.push('> ⚠️ knip の結果を取得できませんでした')
} else if (total > 0) {
  lines.push('| 項目 | 件数 | 減点 |')
  lines.push('|---|:---:|:---:|')
  if (categories.files > 0)
    lines.push(`| 📄 未使用ファイル | ${categories.files} | -${categories.files * 5} |`)
  if (categories.dependencies > 0)
    lines.push(
      `| 📦 未使用パッケージ | ${categories.dependencies} | -${categories.dependencies * 5} |`,
    )
  if (categories.exports > 0)
    lines.push(`| 📤 未使用エクスポート | ${categories.exports} | -${categories.exports * 5} |`)
  if (categories.types > 0)
    lines.push(`| 🏷️ 未使用の型定義 | ${categories.types} | -${categories.types * 5} |`)
  lines.push('')
  lines.push(
    `> 💡 **ヒント:** \`npm run knip\` で詳細を確認し、不要なコードを削除するとスコアが上がります`,
  )
} else {
  lines.push('🎉 問題は見つかりませんでした！コードはきれいな状態です。')
}

lines.push('')

fs.writeFileSync('health-report.md', lines.join('\n'))
