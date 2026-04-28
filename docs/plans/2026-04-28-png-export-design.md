# PNG エクスポート機能 設計書

- Issue: [#310 feat: フロー全体を PNG 画像として保存できるボタンを追加](https://github.com/tomohirof/flowline/issues/310)
- 作成日: 2026-04-28
- スコープ: エディタ画面（作成者のみ）`src/features/editor/FlowEditor.tsx`
- スコープ外: 共有ビュー（`SharedFlowViewer.tsx`）

## 1. 目的

各フローを PNG 画像として保存できるようにする。プレゼン・Slack 投稿などのユースケースで「Mermaid コードや JSON ではなく、見た目そのまま」を持ち出せる手段を提供する。

## 2. 仕様サマリ

| 項目 | 値 |
|---|---|
| 保存形式 | PNG のみ |
| 保存範囲 | フロー全体（スクロール外も含む。現在のズーム値は無視） |
| 背景 | 現在のテーマの `T.canvasBg` を SVG 内 `<rect>` に焼き込み |
| ドットグリッド | `editorSettings.showDotGrid` が true のとき含める（SVG `<pattern>`） |
| 解像度 | 既定 2x DPR。長辺が 8000px を超える場合は 1x にフォールバックし Info Toast |
| 中止条件 | 1x でも長辺 8000px 超過 → 生成中止 + Error Toast |
| ファイル名 | `flowline-{sanitized-title}-{YYYYMMDDhhmmss}.png` |
| ボタン配置 | 右パネル「エクスポート」セクション、Mermaid コピー / JSON ダウンロードの下 |
| ボタン状態 | idle → generating（disabled）→ done（1.5 秒）→ idle |

## 3. アーキテクチャ

### 3.1 モジュール境界

| 単位 | 場所 | 責務 |
|---|---|---|
| `downloadPng()` | `FlowEditor.tsx`（既存 `downloadJSON` の隣） | 状態管理、Blob 作成、ダウンロード起動、Toast 通知 |
| `buildExportSvg()` | 新規 `src/features/editor/png-export.ts` | SVG クローン、背景 rect・ドット pattern 挿入、画面外マウント |
| `pickPixelRatio()` | 同上 `png-export.ts` | 長辺と DPR から安全な解像度を決定 |
| ボタン UI | `RightPanel.tsx` のエクスポートセクション末尾 | 状態に応じてラベル切替、disabled 制御 |

`png-export.ts` を分離する理由:
- `FlowEditor.tsx` は既に 3100 行超（God Component）。新規 100 行をこれ以上太らせない
- `pickPixelRatio` などの純粋関数は単体テストが容易

### 3.2 データフロー

```
[クリック]
  ↓
pngState = 'generating', ボタン disabled
  ↓
pickPixelRatio(svgW, svgH)
  ├─ abort=true  → Error Toast → idle (return)
  └─ abort=false → 続行
  ↓
buildExportSvg(svgRef.current, T, svgW, svgH, showDotGrid)
  → cloneSvg + cleanup()
  ↓
htmlToImage.toPng(cloneSvg, { pixelRatio, embedCss: true })
  ├─ reject → Error Toast → idle
  └─ resolve dataUrl
  ↓
fetch(dataUrl).blob() → URL.createObjectURL → <a download>.click()
  ↓
revokeObjectURL
  ↓
downgraded なら Info Toast
  ↓
pngState = 'done' → 1.5s 後 idle
  ↓
finally: cleanup() で一時 DOM 削除
```

## 4. 実装詳細

### 4.1 `buildExportSvg`

```ts
function buildExportSvg(
  src: SVGSVGElement,
  T: ThemeColors,
  fullW: number,    // svgW (zoom=1 換算の実寸)
  fullH: number,    // svgH (zoom=1 換算の実寸)
  showDotGrid: boolean,
): { node: SVGSVGElement; cleanup: () => void }
```

処理ステップ:

1. `src.cloneNode(true)` で deep clone
2. クローンの属性を上書き:
   - `width = fullW`, `height = fullH`
   - `viewBox = "0 -30 fullW fullH"`（既存の `0 -30` Y オフセットを維持）
   - インラインスタイルから `min-width` / `min-height` を除去
3. 背景 rect を `<svg>` の **最初の子** として挿入: `<rect x="0" y="-30" width={fullW} height={fullH} fill={T.canvasBg} />`
4. `showDotGrid === true` のとき:
   - `<defs>` に `<pattern id="flowline-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="0.5" fill={T.dotGrid} /></pattern>` を追加
   - 背景 rect の直後に `<rect x="0" y="-30" width={fullW} height={fullH} fill="url(#flowline-dots)" />` を挿入
   - 既存 CSS の `radial-gradient(circle, var(--theme-dot-grid) 0.5px, transparent 0.5px)` 相当を SVG で再現（半径 0.5、間隔 20）
5. 一時 div (`position: fixed; left: -99999px; top: 0; pointer-events: none;`) を `document.body.appendChild` し、その中にクローンを入れる
6. `{ node: clone, cleanup: () => tempDiv.remove() }` を返す

注: 背景・ドットグリッドを SVG 内に焼き込む方針は、CSS 依存（`var(--theme-canvas-bg)`、`radial-gradient`）の再現がブラウザ・`html-to-image` 双方の実装に依存することを避け、再現性を確定的にするため。

### 4.2 `pickPixelRatio`

```ts
const MAX_LONG_EDGE = 8000

function pickPixelRatio(w: number, h: number): {
  pixelRatio: number
  downgraded: boolean
  abort: boolean
}
```

| longEdge | pixelRatio | downgraded | abort | 挙動 |
|---|---|---|---|---|
| ≤ 4000 | 2 | false | false | 通常（2x 高品質） |
| 4001 〜 8000 | 1 | true | false | 1x で続行 + Info Toast |
| > 8000 | 1 | false | true | 中止 + Error Toast |

### 4.3 `downloadPng()`（FlowEditor.tsx）

```ts
const [pngState, setPngState] = useState<'idle' | 'generating' | 'done'>('idle')
const pngTimerRef = useRef<number | null>(null)

const downloadPng = async (): Promise<void> => {
  if (!svgRef.current) return
  const decision = pickPixelRatio(svgW, svgH)
  if (decision.abort) {
    addErrorToast({ messageKey: 'rightPanel.imagePngTooLarge' })
    return
  }
  setPngState('generating')
  const { node, cleanup } = buildExportSvg(
    svgRef.current,
    T,
    svgW,
    svgH,
    editorSettings.showDotGrid,
  )
  try {
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: decision.pixelRatio,
      embedCss: true,
    })
    const blob = await (await fetch(dataUrl)).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const sanitized = title.replace(/[^a-zA-Z0-9\u3040-\u9FFF_-]/g, '_').slice(0, 50)
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    a.href = url
    a.download = `flowline-${sanitized}-${ts}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
    if (decision.downgraded) {
      addInfoToast({ messageKey: 'rightPanel.imagePngLowRes' })
    }
    setPngState('done')
    if (pngTimerRef.current) clearTimeout(pngTimerRef.current)
    pngTimerRef.current = window.setTimeout(() => setPngState('idle'), 1500)
  } catch {
    addErrorToast({ messageKey: 'rightPanel.imagePngFailed' })
    setPngState('idle')
  } finally {
    cleanup()
  }
}
```

### 4.4 RightPanel ボタン

`<PanelSection label={t('rightPanel.exportSection')}>` 内に 3 つ目の `PanelBtn`:

```tsx
<PanelBtn
  label={
    pngState === 'generating'
      ? t('rightPanel.imagePngGenerating')
      : pngState === 'done'
        ? t('rightPanel.imagePngDownloaded')
        : t('rightPanel.imagePngDownload')
  }
  color={T.accent}
  disabled={pngState === 'generating'}
  onClick={downloadPng}
  full
/>
```

`PanelBtn` が現状 `disabled` を受け取らない場合は props 拡張する（既存 onClick の前で early return しても動作はするが、視覚的な disabled 表示のため拡張するのが望ましい）。

## 5. i18n キー追加

`src/locales/ja/editor.json` および `src/locales/en/editor.json` の `rightPanel` セクションに追加:

| key | ja | en |
|---|---|---|
| `imagePngDownload` | 画像 (PNG) を保存 | Download as PNG |
| `imagePngGenerating` | 生成中… | Generating… |
| `imagePngDownloaded` | ✓ 保存しました | ✓ Saved |
| `imagePngLowRes` | フローが大きいため低解像度（1x）で保存しました | Saved at 1x because the flow is large |
| `imagePngTooLarge` | フローが大きすぎて画像化できません | Flow is too large to export as image |
| `imagePngFailed` | 画像の生成に失敗しました | Failed to generate image |

## 6. Toast 拡張（必要に応じて）

`useToast` に `addInfoToast` が無ければ追加。実装は `addSuccessToast` と同形式で variant: `'info'`。`Toast.tsx` の variant スタイルに `info`（青系）を追加。

`addInfoToast` 追加が困難な場合のフォールバック: `addSuccessToast` を流用してメッセージで表現する（実装段階で判断）。

## 7. エラーハンドリング

| ケース | 検出 | 表示 |
|---|---|---|
| `svgRef.current === null` | 関数冒頭ガード | 何もせず return（通常起きない） |
| `longEdge > 8000` | `pickPixelRatio` (abort=true) | Error Toast: `imagePngTooLarge` |
| `longEdge > 4000` | `pickPixelRatio` (downgraded=true) | Info Toast: `imagePngLowRes` |
| `htmlToImage.toPng` reject | try/catch | Error Toast: `imagePngFailed` |
| ボタン二度押し | `disabled={pngState === 'generating'}` | UI で抑止 |

## 8. テスト

### 8.1 ユニット

**`src/features/editor/png-export.test.ts`（新規）**:

`pickPixelRatio`:
- 100×100 → `pixelRatio=2, downgraded=false, abort=false`
- 5000×3000 → `pixelRatio=1, downgraded=true, abort=false`
- 9000×100 → `pixelRatio=1, downgraded=false, abort=true`
- 4000×4000（境界） → `pixelRatio=2, downgraded=false, abort=false`

`buildExportSvg`:
- 戻り値の `node` が `SVGSVGElement` であること
- `node` の最初の子要素が `<rect fill={T.canvasBg}>` であること
- `showDotGrid=true` のとき `<defs>` に `<pattern id="flowline-dots">` がある
- `showDotGrid=false` のとき `<pattern>` が存在しない
- `node.getAttribute('viewBox')` が `0 -30 W H` の形式
- `cleanup()` 呼び出しで一時 div が `document.body` から消える

**`src/features/editor/components/RightPanel.test.tsx`（既存 + 拡張）**:
- 「画像 (PNG) を保存」ボタンが表示される
- props に `onPngDownload`, `pngState` を追加してビルドを通す

**`src/features/editor/FlowEditor.test.tsx`（既存 + 拡張）**:
- `vi.mock('html-to-image', () => ({ toPng: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=') }))`
- ボタンクリック → `toPng` が `pixelRatio: 2`, `embedCss: true` で呼ばれる
- ラベル遷移 idle → generating（disabled）→ done → idle（`vi.useFakeTimers` で 1.5 秒進める）
- abort 経路: モック svgW/svgH を 9000 にして Error Toast、`toPng` 未呼び出しを検証

### 8.2 E2E（Playwright）

**新規ケース（既存 e2e ファイルへの追加で可）**:
- ログイン → 既存サンプルフローを開く → 「画像 (PNG) を保存」クリック
- `page.waitForEvent('download')` で Download 取得
- ファイル名が `/^flowline-.*-\d{14}\.png$/` に合致
- `download.path()` のファイルサイズが `> 1KB`

画像中身（背景色やノード描画の正しさ）の検証はしない。

## 9. 影響範囲

### 変更
- `src/features/editor/FlowEditor.tsx`: `downloadPng`、`pngState`、`pngTimerRef` を追加。RightPanel に props 経由で渡す
- `src/features/editor/components/RightPanel.tsx`: `PanelBtn` 追加、props 拡張（`onPngDownload`, `pngState`）
- `src/features/editor/components/RightPanel.test.tsx`: 既存テストに props を追加
- `src/locales/ja/editor.json`, `src/locales/en/editor.json`: i18n キー追加
- `src/features/editor/hooks/useToast.ts`: 必要なら `addInfoToast` 追加
- `src/features/editor/components/Toast.tsx` / `Toast.module.css`: 必要なら `info` variant 追加
- `package.json`: `html-to-image` を dependencies に追加

### 新規
- `src/features/editor/png-export.ts`
- `src/features/editor/png-export.test.ts`
- E2E: `tests/e2e/png-export.spec.ts`（または既存 e2e ファイルに 1 ケース追加）

### 変更なし
- `src/features/shared/SharedFlowViewer.tsx`（スコープ外）
- 矢印ルーティング、テーマ定数、その他既存ロジック

## 10. Done の定義

- [ ] 右パネル「エクスポート」内に「画像 (PNG) を保存」ボタンが表示される
- [ ] クリックで `flowline-{title}-{timestamp}.png` がダウンロードされる
- [ ] フロー全体（スクロール外含む）が含まれる
- [ ] 現テーマの背景色が塗られている
- [ ] ドットグリッドが含まれる（`showDotGrid` 設定に従う）
- [ ] 巨大フローでブラウザがクラッシュしない（pixelRatio 自動降格 + abort）
- [ ] ja/en 両方の i18n が揃っている
- [ ] 生成中はボタンが disabled になり「生成中…」表示
- [ ] エラー時は Error Toast が出て idle に戻る
- [ ] `npm test` が全通過、`gh pr checks` が全 pass
- [ ] E2E でダウンロードイベント発火を確認
