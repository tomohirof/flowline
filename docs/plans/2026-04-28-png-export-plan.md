# PNG エクスポート機能 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エディタ画面の右パネル「エクスポート」セクションに「画像 (PNG) を保存」ボタンを追加し、現在のフロー全体を PNG ファイルとしてダウンロードできるようにする。

**Architecture:** クライアント完結。`html-to-image` を使い、SVG をクローン → 背景・ドットグリッドを SVG 内 `<rect>` に焼き込み → 画面外 DOM にマウント → PNG 化 → ブラウザのダウンロードイベント発火。純粋関数 (`pickPixelRatio`, `buildExportSvg`) は新規 `src/features/editor/png-export.ts` に切り出し、God Component の `FlowEditor.tsx` をこれ以上太らせない。

**Tech Stack:** React 19, TypeScript, Vite, Vitest (vitest-environment: jsdom for UI tests), `html-to-image` (新規追加), i18next, react-i18next。

**Reference:** [設計書](./2026-04-28-png-export-design.md), [Issue #310](https://github.com/tomohirof/flowline/issues/310)

**Branch:** `feat/png-export-310`
**Worktree:** `.worktrees/feat-png-export-310`

---

## File Structure

### 新規

| Path | 責務 |
|---|---|
| `src/features/editor/png-export.ts` | 純粋ロジック: `pickPixelRatio`, `buildExportSvg` |
| `src/features/editor/png-export.test.ts` | 上記の単体テスト |

### 変更

| Path | 変更内容 |
|---|---|
| `package.json` | `html-to-image` を dependencies に追加 |
| `src/features/editor/FlowEditor.tsx` | `downloadPng` 関数追加、`pngState`/`pngTimerRef` state、`addInfoToast` 取得、RightPanel に props 経由で渡す |
| `src/features/editor/components/RightPanel.tsx` | Props 拡張（`downloadPng`, `pngState`）、エクスポートセクションに 3 つ目の `PanelBtn` 追加 |
| `src/features/editor/components/PanelParts.tsx` | `PanelBtn` に `disabled` prop 追加 |
| `src/features/editor/hooks/useToast.ts` | `addInfoToast` を追加、`ToastData['type']` に `'info'` を追加 |
| `src/features/editor/components/Toast.tsx` | `info` variant のアイコン・スタイル分岐 |
| `src/features/editor/components/Toast.module.css` | `.iconInfo` スタイル追加 |
| `src/features/editor/components/Toast.test.tsx` | info variant のレンダリングテスト追加 |
| `src/features/editor/components/RightPanel.test.tsx`（既存があれば） | PNG ボタン props 追加 |
| `src/features/editor/FlowEditor.test.tsx`（既存があれば） | downloadPng のモックテスト追加 |
| `src/locales/ja/editor.json` | i18n キー 6 個追加 |
| `src/locales/en/editor.json` | i18n キー 6 個追加 |

### 設計書との差分

設計書 8.2 で予定していた **Playwright による軽量 E2E テストは省略**する。プロジェクトに Playwright が未導入であり、テストフレームワーク追加は今回のスコープ外。代わりに **Task 11 でブラウザ実機での手動検証** を行う（CLAUDE.md workflow Step 6 と整合）。

設計書の `addInfoToast({ messageKey: ... })` / `addErrorToast({ messageKey: ... })` は誤りで、実際の API は `({ message: t(...) })` 形式。プラン側で正しい形式を採用する。

---

## Tasks

### Task 1: html-to-image を依存に追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: html-to-image を dependencies にインストール**

Run（worktree 内で）:
```bash
npm install html-to-image@^1.11.13
```

Expected: `package.json` の `dependencies` に `"html-to-image": "^1.11.13"` が追加され、`package-lock.json` が更新される。

- [ ] **Step 2: 既存テストが壊れていないことを確認**

Run:
```bash
npm test -- --run
```

Expected: 全テスト pass（既存と同じ）

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore(#310): add html-to-image dependency for PNG export"
```

---

### Task 2: png-export.ts に `pickPixelRatio` を TDD で実装

**Files:**
- Create: `src/features/editor/png-export.ts`
- Create: `src/features/editor/png-export.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/features/editor/png-export.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pickPixelRatio } from './png-export'

describe('pickPixelRatio', () => {
  it('returns pixelRatio=2 and downgraded=false for small flows (≤4000 long edge)', () => {
    expect(pickPixelRatio(100, 100)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('returns pixelRatio=2 at the 4000px boundary', () => {
    expect(pickPixelRatio(4000, 4000)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('downgrades to pixelRatio=1 when 2x would exceed 8000 long edge', () => {
    expect(pickPixelRatio(5000, 3000)).toEqual({
      pixelRatio: 1,
      downgraded: true,
      abort: false,
    })
  })

  it('aborts when 1x already exceeds 8000 long edge', () => {
    expect(pickPixelRatio(9000, 100)).toEqual({
      pixelRatio: 1,
      downgraded: false,
      abort: true,
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
npm test -- --run src/features/editor/png-export.test.ts
```

Expected: FAIL — `Cannot find module './png-export'` または import エラー

- [ ] **Step 3: 最小実装を書く**

Create `src/features/editor/png-export.ts`:

```ts
const MAX_LONG_EDGE = 8000

export interface PixelRatioDecision {
  pixelRatio: number
  downgraded: boolean
  abort: boolean
}

export function pickPixelRatio(width: number, height: number): PixelRatioDecision {
  const longEdge = Math.max(width, height)
  if (longEdge * 2 <= MAX_LONG_EDGE) {
    return { pixelRatio: 2, downgraded: false, abort: false }
  }
  if (longEdge <= MAX_LONG_EDGE) {
    return { pixelRatio: 1, downgraded: true, abort: false }
  }
  return { pixelRatio: 1, downgraded: false, abort: true }
}
```

- [ ] **Step 4: テストが pass することを確認**

Run:
```bash
npm test -- --run src/features/editor/png-export.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/png-export.ts src/features/editor/png-export.test.ts
git commit -m "feat(#310): add pickPixelRatio for PNG resolution fallback"
```

---

### Task 3: png-export.ts に `buildExportSvg` を TDD で実装

**Files:**
- Modify: `src/features/editor/png-export.ts`
- Modify: `src/features/editor/png-export.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

Append to `src/features/editor/png-export.test.ts`:

```ts
import { buildExportSvg } from './png-export'

const SVG_NS = 'http://www.w3.org/2000/svg'

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '500')
  svg.setAttribute('height', '300')
  svg.setAttribute('viewBox', '0 -30 250 150')
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', '10')
  rect.setAttribute('y', '10')
  svg.appendChild(rect)
  return svg
}

describe('buildExportSvg', () => {
  it('returns a cloned SVG with width/height set to fullW/fullH and viewBox using full size', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 800, 600, false)

    expect(node).not.toBe(src)
    expect(node.getAttribute('width')).toBe('800')
    expect(node.getAttribute('height')).toBe('600')
    expect(node.getAttribute('viewBox')).toBe('0 -30 800 600')

    cleanup()
  })

  it('inserts a background rect with canvasBg color as the first child', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#1A1A24', '#666', 200, 200, false)

    const first = node.firstChild as SVGElement
    expect(first.tagName.toLowerCase()).toBe('rect')
    expect(first.getAttribute('fill')).toBe('#1A1A24')
    expect(first.getAttribute('width')).toBe('200')
    expect(first.getAttribute('height')).toBe('200')

    cleanup()
  })

  it('does NOT add a dot-pattern when showDotGrid is false', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 200, 200, false)

    expect(node.querySelector('#flowline-dots')).toBeNull()

    cleanup()
  })

  it('adds a <pattern id="flowline-dots"> in <defs> when showDotGrid is true', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#888', 200, 200, true)

    const pattern = node.querySelector('#flowline-dots')
    expect(pattern).not.toBeNull()
    expect(pattern?.tagName.toLowerCase()).toBe('pattern')
    const circle = pattern?.querySelector('circle')
    expect(circle?.getAttribute('fill')).toBe('#888')

    cleanup()
  })

  it('cleanup() removes the temporary off-screen container from document.body', () => {
    const src = makeSvg()
    const { node, cleanup } = buildExportSvg(src, '#EAEAF2', '#000', 200, 200, false)

    const parent = node.parentElement
    expect(parent).not.toBeNull()
    expect(parent?.parentElement).toBe(document.body)

    cleanup()

    expect(node.parentElement).toBeNull()
    expect(document.body.contains(parent!)).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
npm test -- --run src/features/editor/png-export.test.ts
```

Expected: FAIL — `buildExportSvg is not a function`

- [ ] **Step 3: `buildExportSvg` を実装**

Append to `src/features/editor/png-export.ts`:

```ts
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface BuildExportSvgResult {
  node: SVGSVGElement
  cleanup: () => void
}

export function buildExportSvg(
  src: SVGSVGElement,
  canvasBg: string,
  dotGridColor: string,
  fullW: number,
  fullH: number,
  showDotGrid: boolean,
): BuildExportSvgResult {
  const clone = src.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(fullW))
  clone.setAttribute('height', String(fullH))
  clone.setAttribute('viewBox', `0 -30 ${fullW} ${fullH}`)
  clone.style.removeProperty('min-width')
  clone.style.removeProperty('min-height')

  // Background rect (insert as first child so it sits behind everything)
  const bg = document.createElementNS(SVG_NS, 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '-30')
  bg.setAttribute('width', String(fullW))
  bg.setAttribute('height', String(fullH))
  bg.setAttribute('fill', canvasBg)
  clone.insertBefore(bg, clone.firstChild)

  // Dot grid pattern (optional)
  if (showDotGrid) {
    let defs = clone.querySelector('defs')
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs')
      clone.insertBefore(defs, clone.firstChild)
    }
    const pattern = document.createElementNS(SVG_NS, 'pattern')
    pattern.setAttribute('id', 'flowline-dots')
    pattern.setAttribute('width', '20')
    pattern.setAttribute('height', '20')
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    const dot = document.createElementNS(SVG_NS, 'circle')
    dot.setAttribute('cx', '0.5')
    dot.setAttribute('cy', '0.5')
    dot.setAttribute('r', '0.5')
    dot.setAttribute('fill', dotGridColor)
    pattern.appendChild(dot)
    defs.appendChild(pattern)

    const gridRect = document.createElementNS(SVG_NS, 'rect')
    gridRect.setAttribute('x', '0')
    gridRect.setAttribute('y', '-30')
    gridRect.setAttribute('width', String(fullW))
    gridRect.setAttribute('height', String(fullH))
    gridRect.setAttribute('fill', 'url(#flowline-dots)')
    // Insert directly after the background rect
    bg.parentNode?.insertBefore(gridRect, bg.nextSibling)
  }

  // Mount off-screen so html-to-image can compute layout
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.pointerEvents = 'none'
  host.appendChild(clone)
  document.body.appendChild(host)

  return {
    node: clone,
    cleanup: () => {
      if (host.parentNode) host.parentNode.removeChild(host)
    },
  }
}
```

- [ ] **Step 4: テストが pass することを確認**

Run:
```bash
npm test -- --run src/features/editor/png-export.test.ts
```

Expected: PASS — 9 tests (4 + 5)

- [ ] **Step 5: コミット**

```bash
git add src/features/editor/png-export.ts src/features/editor/png-export.test.ts
git commit -m "feat(#310): add buildExportSvg to clone SVG with background and dot grid"
```

---

### Task 4: i18n キーを ja/en に追加

**Files:**
- Modify: `src/locales/ja/editor.json`
- Modify: `src/locales/en/editor.json`

- [ ] **Step 1: ja の `rightPanel` セクション末尾の前に 6 個追加**

Edit `src/locales/ja/editor.json` の `rightPanel` 内、`"jsonDownloaded": "✓ ダウンロードしました",` の直後に追加:

```json
    "imagePngDownload": "画像 (PNG) を保存",
    "imagePngGenerating": "生成中…",
    "imagePngDownloaded": "✓ 保存しました",
    "imagePngLowRes": "フローが大きいため低解像度（1x）で保存しました",
    "imagePngTooLarge": "フローが大きすぎて画像化できません",
    "imagePngFailed": "画像の生成に失敗しました",
```

- [ ] **Step 2: en も同様に追加**

Edit `src/locales/en/editor.json` の `rightPanel` 内、`"jsonDownloaded": "✓ Downloaded",` の直後に追加:

```json
    "imagePngDownload": "Download as PNG",
    "imagePngGenerating": "Generating…",
    "imagePngDownloaded": "✓ Saved",
    "imagePngLowRes": "Saved at 1x because the flow is large",
    "imagePngTooLarge": "Flow is too large to export as image",
    "imagePngFailed": "Failed to generate image",
```

- [ ] **Step 3: JSON が valid であることを確認**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ja/editor.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/en/editor.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja/editor.json src/locales/en/editor.json
git commit -m "feat(#310): add i18n keys for PNG export button and toasts"
```

---

### Task 5: useToast に `addInfoToast` を TDD で追加

**Files:**
- Modify: `src/features/editor/hooks/useToast.ts`
- Create: `src/features/editor/hooks/useToast.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/features/editor/hooks/useToast.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './useToast'

afterEach(() => {
  vi.useRealTimers()
})

describe('useToast.addInfoToast', () => {
  it('adds an info-typed toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addInfoToast({ message: 'Saved at 1x' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('info')
    expect(result.current.toasts[0].message).toBe('Saved at 1x')
  })

  it('auto-dismisses info toasts after 3 seconds (same as success)', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addInfoToast({ message: 'hello' })
    })
    expect(result.current.toasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(result.current.toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
npm test -- --run src/features/editor/hooks/useToast.test.ts
```

Expected: FAIL — `addInfoToast is not a function`

- [ ] **Step 3: useToast に `addInfoToast` を実装**

Edit `src/features/editor/hooks/useToast.ts`:

3a. `ToastData['type']` 共用体に `'info'` を追加:

```ts
export interface ToastData {
  id: string
  type: 'confirm' | 'success' | 'error' | 'info'
  // ... rest unchanged
}
```

3b. auto-dismiss を info にも適用:

`successToastIds` のロジックを `autoDismissIds` に書き換え:

```ts
const autoDismissIds = toasts
  .filter((t) => t.type === 'success' || t.type === 'info')
  .map((t) => t.id)
  .join(',')

useEffect(() => {
  if (!autoDismissIds) return
  const ids = new Set(autoDismissIds.split(','))
  const timer = setTimeout(() => {
    setToasts((prev) => prev.filter((t) => !ids.has(t.id)))
  }, 3000)
  return () => clearTimeout(timer)
}, [autoDismissIds])
```

3c. `addInfoToast` を追加（`addSuccessToast` の直後）:

```ts
const addInfoToast = useCallback((toast: Pick<ToastData, 'message' | 'detail'>): void => {
  setToasts((prev) => [...prev, { ...toast, id: uid(), type: 'info' as const }])
}, [])
```

3d. return オブジェクトに `addInfoToast` を追加:

```ts
return {
  toasts,
  addConfirmToast,
  addSuccessToast,
  addInfoToast,
  addErrorToast,
  dismissToast,
  dismissToastByType,
  confirmToast,
}
```

- [ ] **Step 4: テストが pass することを確認**

Run:
```bash
npm test -- --run src/features/editor/hooks/useToast.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: 既存テストが壊れていないことを確認**

Run:
```bash
npm test -- --run
```

Expected: 全テスト pass（既存 success toast の auto-dismiss も継続動作）

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/hooks/useToast.ts src/features/editor/hooks/useToast.test.ts
git commit -m "feat(#310): add addInfoToast to useToast for low-resolution notice"
```

---

### Task 6: Toast.tsx と CSS に `info` variant を追加

**Files:**
- Modify: `src/features/editor/components/Toast.tsx`
- Modify: `src/features/editor/components/Toast.module.css`
- Modify: `src/features/editor/components/Toast.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

Edit `src/features/editor/components/Toast.test.tsx`、既存の describe 内（または新規 describe）に追加:

```tsx
import { render, screen } from '@testing-library/react'
import { ToastList } from './Toast'

it('renders an info toast with the ℹ icon and the info-styled background', () => {
  render(
    <ToastList
      toasts={[{ id: 'i1', type: 'info', message: 'Saved at 1x' }]}
      onDismiss={() => {}}
      onConfirm={() => {}}
    />,
  )
  const toast = screen.getByTestId('toast-info')
  expect(toast).toBeInTheDocument()
  expect(toast.textContent).toContain('Saved at 1x')
  expect(toast.textContent).toContain('ℹ')
})
```

注: 既存ファイルに `import { ToastList }` が既にあれば再 import 不要。`screen.getByTestId('toast-info')` を成立させるため、`ToastList` の `data-testid` パターン `toast-${type}` をそのまま活用する（既存実装そのまま）。

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
npm test -- --run src/features/editor/components/Toast.test.tsx
```

Expected: FAIL — `Unable to find an element by: [data-testid="toast-info"]` または icon の文字が `ℹ` ではない

- [ ] **Step 3: Toast.tsx の icon 分岐に info を追加**

Edit `src/features/editor/components/Toast.tsx`、`<div className={...}>` の icon 部分:

既存:
```tsx
<div
  className={`${styles.icon}${toast.type === 'error' ? ` ${styles.iconError}` : ''}`}
>
  {toast.type === 'confirm' ? '↻' : toast.type === 'error' ? '⚠' : '✓'}
</div>
```

を以下に置き換え:

```tsx
<div
  className={`${styles.icon}${
    toast.type === 'error'
      ? ` ${styles.iconError}`
      : toast.type === 'info'
        ? ` ${styles.iconInfo}`
        : ''
  }`}
>
  {toast.type === 'confirm'
    ? '↻'
    : toast.type === 'error'
      ? '⚠'
      : toast.type === 'info'
        ? 'ℹ'
        : '✓'}
</div>
```

- [ ] **Step 4: CSS に `.iconInfo` を追加**

Edit `src/features/editor/components/Toast.module.css`、`.iconError` 定義の直後に追加:

```css
.iconInfo {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}
```

- [ ] **Step 5: テストが pass することを確認**

Run:
```bash
npm test -- --run src/features/editor/components/Toast.test.tsx
```

Expected: PASS — 既存テスト + 新規 info テスト

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/components/Toast.tsx src/features/editor/components/Toast.module.css src/features/editor/components/Toast.test.tsx
git commit -m "feat(#310): add info variant to Toast component"
```

---

### Task 7: PanelBtn に `disabled` prop を追加

**Files:**
- Modify: `src/features/editor/components/PanelParts.tsx`

- [ ] **Step 1: PanelBtn の型と実装を更新**

Edit `src/features/editor/components/PanelParts.tsx` の `PanelBtn`:

```tsx
export const PanelBtn = ({
  label,
  color,
  bg,
  onClick,
  full,
  disabled,
}: {
  label: string
  color: string
  bg?: string
  onClick: () => void
  full?: boolean
  disabled?: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${styles.panelBtn} ${full ? styles.panelBtnFull : styles.panelBtnAuto}`}
    style={{
      border: `1px solid ${color}30`,
      background: bg || `${color}10`,
      color,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    {label}
  </button>
)
```

- [ ] **Step 2: 既存テストが壊れていないことを確認**

Run:
```bash
npm test -- --run
```

Expected: 全テスト pass

- [ ] **Step 3: コミット**

```bash
git add src/features/editor/components/PanelParts.tsx
git commit -m "feat(#310): add disabled prop to PanelBtn"
```

---

### Task 8: RightPanel に PNG ボタンと props を追加

**Files:**
- Modify: `src/features/editor/components/RightPanel.tsx`

- [ ] **Step 1: RightPanelProps に props を追加**

Edit `src/features/editor/components/RightPanel.tsx` の `RightPanelProps` 末尾（`downloadJSON: () => void` の後）に追加:

```ts
  downloadPng: () => void
  pngState: 'idle' | 'generating' | 'done'
```

- [ ] **Step 2: コンポーネント引数の destructure に追加**

`export const RightPanel = ({ ... downloadJSON, ... })` の destructure に `downloadPng, pngState,` を追加。

- [ ] **Step 3: エクスポートセクションに PanelBtn を追加**

`<PanelSection label={t('rightPanel.exportSection')}>` 内、JSON ダウンロードボタンの直後（`/>` の後、`</PanelSection>` の前）に追加:

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

- [ ] **Step 4: TypeScript ビルドが通ることを確認**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30
```

Expected: 一時的に FlowEditor.tsx 側で `Property 'downloadPng' is missing` エラー（次の Task 9 で解消）。RightPanel 単体としては型整合済み。

- [ ] **Step 5: 一時コミット（FlowEditor 側を含む完了は次 Task）**

このタスクの変更はビルド未通過のため単独コミットしない。Task 9 とまとめて 1 コミットにする。

---

### Task 9: FlowEditor に `downloadPng` を実装し、RightPanel に渡す

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx`

- [ ] **Step 1: import 追加**

`src/features/editor/FlowEditor.tsx` の上部 import 群に追加:

```ts
import * as htmlToImage from 'html-to-image'
import { pickPixelRatio, buildExportSvg } from './png-export'
```

- [ ] **Step 2: `useToast` の destructure に `addInfoToast` を追加**

`useToast()` の destructure に追加:

```ts
const {
  toasts,
  addConfirmToast,
  addSuccessToast,
  addInfoToast,
  addErrorToast,
  dismissToast,
  dismissToastByType,
  confirmToast,
} = useToast()
```

- [ ] **Step 3: `pngState` と `pngTimerRef` の state を追加**

`downloadJSON` の定義より前（`useState` 群が並んでいるあたり）に追加:

```ts
const [pngState, setPngState] = useState<'idle' | 'generating' | 'done'>('idle')
const pngTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

(既存の `useRef` import 済み)

- [ ] **Step 4: `downloadPng` 関数を `downloadJSON` の直後に追加**

```ts
const downloadPng = async (): Promise<void> => {
  if (!svgRef.current) return
  const decision = pickPixelRatio(svgW, svgH)
  if (decision.abort) {
    addErrorToast({ message: t('rightPanel.imagePngTooLarge') })
    return
  }
  setPngState('generating')
  const T = THEMES[themeId]
  const { node, cleanup } = buildExportSvg(
    svgRef.current,
    T.canvasBg,
    T.dotGrid,
    svgW,
    svgH,
    editorSettings.showDotGrid,
  )
  try {
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: decision.pixelRatio,
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
      addInfoToast({ message: t('rightPanel.imagePngLowRes') })
    }
    setPngState('done')
    if (pngTimerRef.current) clearTimeout(pngTimerRef.current)
    pngTimerRef.current = setTimeout(() => setPngState('idle'), 1500)
  } catch {
    addErrorToast({ message: t('rightPanel.imagePngFailed') })
    setPngState('idle')
  } finally {
    cleanup()
  }
}
```

注:
- 設計書には `embedCss: true` と記載していたが、SVG 内に背景・パターンを直接焼き込んでおり、CSS 依存はないため `embedCss` は省略可能。html-to-image のデフォルトで動作する。
- `THEMES` import は既にある（既存の theme 切替で使用）。なければ `import { THEMES } from './theme-constants'` を追加。

- [ ] **Step 5: RightPanel への呼び出しに `downloadPng` と `pngState` を渡す**

`<RightPanel ... downloadJSON={downloadJSON}` を以下に変更:

```tsx
<RightPanel
  // ...existing props...
  downloadJSON={downloadJSON}
  downloadPng={downloadPng}
  pngState={pngState}
/>
```

- [ ] **Step 6: TypeScript ビルドが通ることを確認**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 0 errors

- [ ] **Step 7: 既存テストが壊れていないことを確認**

Run:
```bash
npm test -- --run
```

Expected: 全テスト pass

- [ ] **Step 8: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/components/RightPanel.tsx
git commit -m "feat(#310): wire PNG download button into FlowEditor and RightPanel"
```

---

### Task 10: FlowEditor の downloadPng に対するインタラクションテストを追加

**Files:**
- Create or Modify: `src/features/editor/FlowEditor.test.tsx`（既存ファイルがあればケース追加、なければ新規作成 — 新規の場合はテンプレート最小化）

> **既存 `FlowEditor.test.tsx` の有無を最初に確認:** `ls src/features/editor/FlowEditor.test.tsx`
>
> 存在しない場合は **このタスクはスキップ可**（理由: God Component の包括的レンダーテストはスコープ外。`png-export.test.ts` と `useToast.test.ts` で純粋ロジックは網羅済み。手動検証 Task 11 で挙動を確認）。
> 存在する場合は以下を追加。

- [ ] **Step 1: 既存 FlowEditor.test.tsx の有無を確認**

Run:
```bash
ls src/features/editor/FlowEditor.test.tsx 2>&1
```

A) ファイルが**ない**場合: このタスクをスキップし Task 11 へ。
B) ファイルが**ある**場合: 以下に進む。

- [ ] **Step 2: html-to-image をモックして downloadPng のテストを追加**

既存ファイル先頭付近（既存 vi.mock 群と同じスコープ）に追加:

```ts
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  ),
}))
```

新規 describe ブロックを追加（既存の最後に append）:

```tsx
describe('PNG export button', () => {
  it('renders the PNG button in the export section', async () => {
    // 既存のレンダーヘルパに合わせる。例: renderEditor()
    renderEditor()
    expect(await screen.findByText(/画像 \(PNG\) を保存|Download as PNG/)).toBeInTheDocument()
  })

  it('calls html-to-image.toPng when the button is clicked', async () => {
    const user = userEvent.setup()
    renderEditor()
    const btn = await screen.findByText(/画像 \(PNG\) を保存|Download as PNG/)
    await user.click(btn)
    const { toPng } = await import('html-to-image')
    await waitFor(() => {
      expect(toPng).toHaveBeenCalled()
    })
  })
})
```

注: `renderEditor`/`screen`/`userEvent` の名前と import は既存テストファイルの慣例に揃える。本プランでは具体名を仮置きしている。既存テストが `// @vitest-environment jsdom` を使っていることを確認し、新規テストも同条件で動かす。

- [ ] **Step 3: テストを実行**

Run:
```bash
npm test -- --run src/features/editor/FlowEditor.test.tsx
```

Expected: PASS — 既存 + 新規 2 ケース

- [ ] **Step 4: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test(#310): cover PNG export button rendering and click in FlowEditor"
```

---

### Task 11: 全テスト + lint + 手動ブラウザ検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト通過を確認**

Run:
```bash
npm test -- --run
```

Expected: 全 pass、FAIL 0

- [ ] **Step 2: lint 通過を確認**

Run:
```bash
npm run lint
```

Expected: 0 errors

- [ ] **Step 3: 開発サーバ起動**

Run（別ターミナルで）:
```bash
npm run dev:frontend
```

ブラウザで `http://localhost:5173`（または vite が表示する URL）を開く。

- [ ] **Step 4: 手動検証チェックリスト**

ログイン情報は `.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` を使用。

ライト/ダーク両テーマで以下を確認:

- [ ] 右パネル「エクスポート」セクションに「画像 (PNG) を保存」/「Download as PNG」ボタンが表示される
- [ ] 通常サイズのフローでクリックすると、`flowline-{title}-{timestamp}.png` がダウンロードされる
- [ ] ダウンロードした PNG を開き、フロー全体（スクロール外含む）が含まれている
- [ ] 背景がテーマの色（cloud: 薄グレー、midnight: 紺、blueprint: 薄青）で塗られている
- [ ] ドットグリッドが含まれる（`showDotGrid` ON のとき）
- [ ] `showDotGrid` を OFF にしてもう一度保存 → ドットグリッドなしの PNG が出る
- [ ] 生成中に「生成中…」表示、ボタンが半透明（disabled）
- [ ] 完了後 1.5 秒間「✓ 保存しました」表示、その後通常ラベルに復帰
- [ ] ノード/コメント/メモ/レーン名（foreignObject 内 HTML）が崩れず描画されている

ブラウザ DevTools で以下も確認:

- [ ] LCP（Largest Contentful Paint）が 1 秒以内（CLAUDE.md 基準）
- [ ] PNG ダウンロード時にコンソールエラーが出ていない

- [ ] **Step 5: 検証で問題が見つかった場合**

問題があれば該当 Task に戻って修正。修正後は `npm test`, `npm run lint`, ブラウザ再検証を再実行。

- [ ] **Step 6: PR 作成（コミット済みの全変更を push）**

Run:
```bash
git push -u origin feat/png-export-310
gh pr create --title "feat(#310): add PNG export button to editor" --body "$(cat <<'EOF'
## Summary
- 右パネル「エクスポート」セクションに「画像 (PNG) を保存」ボタンを追加
- フロー全体（スクロール外含む）を PNG として保存
- 解像度自動降格（長辺 8000px ルール）と巨大フローの abort
- 進捗フィードバック（生成中… → ✓ 保存しました）
- ja/en i18n キー追加、`addInfoToast` を `useToast` に追加

Closes #310

## Test plan
- [x] `npm test` 全 pass
- [x] `npm run lint` 0 errors
- [x] ブラウザ実機でダウンロードイベント確認（cloud/midnight/blueprint テーマ）
- [x] foreignObject（タイトル/コメント/メモ/レーン名）の描画確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done Definition (final check)

- [ ] 右パネル「エクスポート」内に「画像 (PNG) を保存」ボタンが表示される
- [ ] クリックで `flowline-{title}-{timestamp}.png` がダウンロードされる
- [ ] フロー全体（スクロール外含む）が含まれる
- [ ] 現テーマの背景色が塗られている
- [ ] `showDotGrid` 設定に従いドットグリッドが含まれる
- [ ] 巨大フローでも abort により安全に中止される（クラッシュなし）
- [ ] ja/en 両方の i18n が揃っている
- [ ] 生成中はボタンが disabled「生成中…」、完了で「✓ 保存しました」1.5 秒
- [ ] エラー時は Error Toast が出て idle に戻る
- [ ] 1x 降格時は Info Toast が出る
- [ ] `npm test` 全通過、`npm run lint` 0 errors
- [ ] ブラウザ実機検証 OK
- [ ] PR 作成 + CI 全 pass
