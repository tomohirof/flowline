/* global Buffer, console */
/**
 * Render the fixed swimlane preview SVG to PNG for OGP image embedding.
 * Usage: node scripts/render-ogp-preview.mjs
 * Output: workers/ogp/src/preview-base64.ts
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Initialize resvg WASM
const wasmPath = resolve(root, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')
await initWasm(readFileSync(wasmPath))

// The swimlane SVG from the reference design template
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="490" viewBox="0 0 760 490">
  <style>
    text { font-family: 'Helvetica Neue', Arial, sans-serif; }
  </style>

  <!-- Lane backgrounds -->
  <rect x="10" y="32" width="178" height="440" rx="8" fill="#F8F0EC" opacity="0.4"/>
  <rect x="196" y="32" width="178" height="440" rx="8" fill="#ECF0F8" opacity="0.4"/>
  <rect x="382" y="32" width="178" height="440" rx="8" fill="#F0ECF8" opacity="0.4"/>
  <rect x="568" y="32" width="178" height="440" rx="8" fill="#ECF8F0" opacity="0.4"/>

  <!-- Lane headers -->
  <circle cx="22" cy="16" r="4.5" fill="#E8985A"/>
  <text x="32" y="20" font-size="11" font-weight="700" fill="#1a1a2e">企業</text>
  <circle cx="208" cy="16" r="4.5" fill="#5B8EC9"/>
  <text x="218" y="20" font-size="11" font-weight="700" fill="#1a1a2e">システム</text>
  <circle cx="394" cy="16" r="4.5" fill="#9B6BC9"/>
  <text x="404" y="20" font-size="11" font-weight="700" fill="#1a1a2e">事務局</text>
  <circle cx="580" cy="16" r="4.5" fill="#5AC98A"/>
  <text x="590" y="20" font-size="11" font-weight="700" fill="#1a1a2e">ユーザー</text>

  <!-- Color bars -->
  <rect x="10" y="28" width="178" height="2.5" rx="1.25" fill="#E8985A" opacity="0.35"/>
  <rect x="196" y="28" width="178" height="2.5" rx="1.25" fill="#5B8EC9" opacity="0.35"/>
  <rect x="382" y="28" width="178" height="2.5" rx="1.25" fill="#9B6BC9" opacity="0.35"/>
  <rect x="568" y="28" width="178" height="2.5" rx="1.25" fill="#5AC98A" opacity="0.35"/>

  <!-- Row 1 -->
  <rect x="26" y="46" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="31" y="51" width="32" height="11" rx="2.5" fill="#FDE8D8"/>
  <text x="47" y="57" text-anchor="middle" font-size="6" font-weight="700" fill="#C07830">企業</text>
  <text x="99" y="74" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">申請作成</text>

  <rect x="212" y="46" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="217" y="51" width="45" height="11" rx="2.5" fill="#D8E8F8"/>
  <text x="240" y="57" text-anchor="middle" font-size="6" font-weight="700" fill="#3070A0">システム</text>
  <text x="285" y="74" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">自動受付</text>

  <!-- Row 2 -->
  <rect x="212" y="106" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="217" y="111" width="45" height="11" rx="2.5" fill="#D8E8F8"/>
  <text x="240" y="117" text-anchor="middle" font-size="6" font-weight="700" fill="#3070A0">システム</text>
  <text x="285" y="134" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">データ検証</text>

  <rect x="398" y="106" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="403" y="111" width="38" height="11" rx="2.5" fill="#E8D8F8"/>
  <text x="422" y="117" text-anchor="middle" font-size="6" font-weight="700" fill="#7040A0">事務局</text>
  <text x="471" y="134" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">審査</text>

  <!-- Row 3 -->
  <rect x="398" y="166" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="403" y="171" width="38" height="11" rx="2.5" fill="#E8D8F8"/>
  <text x="422" y="177" text-anchor="middle" font-size="6" font-weight="700" fill="#7040A0">事務局</text>
  <text x="471" y="194" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">承認判定</text>

  <rect x="584" y="166" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="589" y="171" width="46" height="11" rx="2.5" fill="#D8F0E8"/>
  <text x="612" y="177" text-anchor="middle" font-size="6" font-weight="700" fill="#308050">ユーザー</text>
  <text x="657" y="194" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">書類準備</text>

  <!-- Row 4 -->
  <rect x="26" y="226" width="146" height="42" rx="7" fill="#EEF5FF" stroke="#B8D0F0" stroke-width="0.7"/>
  <rect x="31" y="231" width="32" height="11" rx="2.5" fill="#FDE8D8"/>
  <text x="47" y="237" text-anchor="middle" font-size="6" font-weight="700" fill="#C07830">企業</text>
  <text x="99" y="254" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">内容確認</text>

  <rect x="212" y="226" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="217" y="231" width="45" height="11" rx="2.5" fill="#D8E8F8"/>
  <text x="240" y="237" text-anchor="middle" font-size="6" font-weight="700" fill="#3070A0">システム</text>
  <text x="285" y="254" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">見積作成</text>

  <!-- Row 5 -->
  <rect x="212" y="286" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="217" y="291" width="45" height="11" rx="2.5" fill="#D8E8F8"/>
  <text x="240" y="297" text-anchor="middle" font-size="6" font-weight="700" fill="#3070A0">システム</text>
  <text x="285" y="314" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">発行処理</text>

  <rect x="398" y="286" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="403" y="291" width="38" height="11" rx="2.5" fill="#E8D8F8"/>
  <text x="422" y="297" text-anchor="middle" font-size="6" font-weight="700" fill="#7040A0">事務局</text>
  <text x="471" y="314" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">通知送信</text>

  <rect x="584" y="286" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7"/>
  <rect x="589" y="291" width="46" height="11" rx="2.5" fill="#D8F0E8"/>
  <text x="612" y="297" text-anchor="middle" font-size="6" font-weight="700" fill="#308050">ユーザー</text>
  <text x="657" y="314" text-anchor="middle" font-size="11" font-weight="600" fill="#1a1a2e">完了記録</text>

  <!-- Fading rows -->
  <rect x="26" y="346" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7" opacity="0.4"/>
  <rect x="212" y="346" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7" opacity="0.4"/>
  <rect x="398" y="346" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7" opacity="0.25"/>
  <rect x="212" y="406" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7" opacity="0.15"/>
  <rect x="398" y="406" width="146" height="42" rx="7" fill="#fff" stroke="#D0CED8" stroke-width="0.7" opacity="0.1"/>

  <!-- Arrows -->
  <defs>
    <marker id="am" markerWidth="6" markerHeight="5" refX="5.5" refY="2.5" orient="auto">
      <polygon points="0 0.4,6 2.5,0 4.6" fill="#8A889A"/>
    </marker>
  </defs>
  <line x1="172" y1="67" x2="210" y2="67" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="285" y1="88" x2="285" y2="104" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="358" y1="127" x2="396" y2="127" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="471" y1="148" x2="471" y2="164" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="544" y1="187" x2="582" y2="187" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <path d="M398 187 L262 187 L262 210 L174 226" stroke="#8A889A" stroke-width="1.2" fill="none" marker-end="url(#am)"/>
  <line x1="172" y1="247" x2="210" y2="247" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="285" y1="268" x2="285" y2="284" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="358" y1="307" x2="396" y2="307" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
  <line x1="544" y1="307" x2="582" y2="307" stroke="#8A889A" stroke-width="1.2" marker-end="url(#am)"/>
</svg>`

const resvg = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 760 },
})
const pngData = resvg.render()
const pngBuffer = pngData.asPng()

const base64 = Buffer.from(pngBuffer).toString('base64')
const outputPath = resolve(root, 'workers/ogp/src/preview-base64.ts')

writeFileSync(
  outputPath,
  `// Auto-generated by scripts/render-ogp-preview.mjs\n// Pre-rendered swimlane preview PNG (760x490) as base64 data URI\nexport const PREVIEW_PNG_DATA_URI = 'data:image/png;base64,${base64}'\n`,
)

console.log(`Generated: ${outputPath}`)
console.log(`PNG size: ${pngBuffer.length} bytes (${(base64.length / 1024).toFixed(1)} KB base64)`)
