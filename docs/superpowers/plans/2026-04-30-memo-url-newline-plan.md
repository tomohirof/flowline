# Memo URL/Newline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メモ吹き出し内の `https?://` URL を別タブで開けるリンクに自動変換し、改行をそのまま表示・入力に反映する。

**Architecture:** 表示ロジックは新設の `MemoText` コンポーネントに集約（FlowEditor 通常表示・SharedFlowViewer の 2 か所で使う）。URL 検出は新設の純粋関数 `splitTextWithUrls` に分離。右パネルは既存 `PanelTextarea` を `submitOnEnter` オプション付きに拡張して再利用。永続化形式（`MemoData.text`）と高さ計算（`measureMemoHeight`）は無改修。

**Tech Stack:** React (TypeScript) / Vite / Vitest / @testing-library/react / Playwright / Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-04-30-memo-url-newline-design.md`
**Issue:** https://github.com/tomohirof/flowline/issues/331

---

## File Structure

| Path                                                 | Action | Responsibility                                                        |
| ---------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `src/features/editor/memo-utils.ts`                  | Modify | `splitTextWithUrls` と型 `MemoTextSegment` を追加                     |
| `src/features/editor/memo-utils.test.ts`             | Modify | `splitTextWithUrls` の単体テストを追加                                |
| `src/features/editor/components/MemoText.tsx`        | Create | 改行＋URL クリッカブル化を担うプレゼンテーショナルコンポーネント      |
| `src/features/editor/components/MemoText.test.tsx`   | Create | `MemoText` の単体テスト                                               |
| `src/features/editor/components/PanelParts.tsx`      | Modify | `PanelTextarea` に `submitOnEnter` オプション追加                     |
| `src/features/editor/components/PanelParts.test.tsx` | Create | `PanelTextarea` の挙動テスト                                          |
| `src/features/editor/FlowEditor.tsx`                 | Modify | 通常表示メモ（3487-3503）を `MemoText` に置換                         |
| `src/features/shared/SharedFlowViewer.tsx`           | Modify | 共有ビューのメモ（471-486）を `MemoText` に置換                       |
| `src/features/editor/components/RightPanel.tsx`      | Modify | メモ欄の `PanelInput` を `PanelTextarea (submitOnEnter=false)` に置換 |
| `src/features/editor/FlowEditor.test.tsx`            | Modify | 右パネル `<textarea>`／改行表示／URLリンク化の統合テストを追加        |

---

## Pre-flight: Worktree, Cleanup, Issue Label

### Task 0: 作業ブランチ準備

**Files:** （リポジトリ運用のみ）

- [ ] **Step 0-1: 既存プロセスをクリーンアップ**

Run: `pkill -f 'vite|wrangler|esbuild|workerd' 2>/dev/null; true`

- [ ] **Step 0-2: issue に「作業開始」ラベルを付与**

```bash
gh label list --json name | jq -r '.[].name' | grep -q '^作業開始$' || gh label create "作業開始" --color "E11D48"
gh issue edit 331 --add-label "作業開始"
```

- [ ] **Step 0-3: main を最新化（必須・ff-only）**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

ff-only が通らなかったら **作業を中断して報告**。

- [ ] **Step 0-4: worktree 作成と .env シンボリックリンク**

```bash
git worktree add .worktrees/feat-memo-url-newline-331 -b feat/memo-url-newline-331
cd .worktrees/feat-memo-url-newline-331
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

- [ ] **Step 0-5: 依存関係を確認**

Run: `npm ci --no-audit --no-fund` （既に node_modules がリンクされていればスキップ可）
Expected: 成功して `npm test --silent -- --run --reporter=dot` が動く状態。

- [ ] **Step 0-6: テストルールを読込**

Run: `cat ~/.claude/rules/testing.md`
Expected: 振る舞いベース／網羅すべきエッジケースのチェックリストが頭に入る。

---

## Task 1: `splitTextWithUrls` の TDD

**Files:**

- Modify: `src/features/editor/memo-utils.test.ts`（末尾に追記）
- Modify: `src/features/editor/memo-utils.ts`（末尾に追記）

- [ ] **Step 1-1: 失敗テストを追加**

`src/features/editor/memo-utils.test.ts` の最終行（`MEMO_W` describe の後）に以下を追記:

```ts
import { splitTextWithUrls } from './memo-utils'

describe('splitTextWithUrls', () => {
  it('returns single text segment when input has no URLs', () => {
    expect(splitTextWithUrls('hello world')).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('returns empty array for empty string', () => {
    expect(splitTextWithUrls('')).toEqual([])
  })

  it('detects a single https URL in the middle of text', () => {
    expect(splitTextWithUrls('see https://example.com here')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: ' here' },
    ])
  })

  it('detects http and multiple URLs in order', () => {
    expect(splitTextWithUrls('a http://a.com b https://b.com c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'url', value: 'http://a.com' },
      { type: 'text', value: ' b ' },
      { type: 'url', value: 'https://b.com' },
      { type: 'text', value: ' c' },
    ])
  })

  it('preserves query and fragment', () => {
    const url = 'https://example.com/path?q=1&r=2#frag'
    expect(splitTextWithUrls(`x ${url} y`)).toEqual([
      { type: 'text', value: 'x ' },
      { type: 'url', value: url },
      { type: 'text', value: ' y' },
    ])
  })

  it('excludes trailing punctuation from the URL', () => {
    expect(splitTextWithUrls('see https://example.com.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '.' },
    ])
    expect(splitTextWithUrls('(https://example.com)')).toEqual([
      { type: 'text', value: '(' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: ')' },
    ])
  })

  it('does NOT match dangerous schemes', () => {
    expect(splitTextWithUrls('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ])
    expect(splitTextWithUrls('data:text/html,foo')).toEqual([
      { type: 'text', value: 'data:text/html,foo' },
    ])
    expect(splitTextWithUrls('file:///etc/passwd')).toEqual([
      { type: 'text', value: 'file:///etc/passwd' },
    ])
  })

  it('does not match scheme-only without host', () => {
    expect(splitTextWithUrls('http://')).toEqual([{ type: 'text', value: 'http://' }])
  })

  it('does not span URL across newlines', () => {
    expect(splitTextWithUrls('see https://example.com\nnext line')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '\nnext line' },
    ])
  })

  it('treats full-width spaces and tabs as separators', () => {
    expect(splitTextWithUrls('a\thttps://example.com\tb')).toEqual([
      { type: 'text', value: 'a\t' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '\tb' },
    ])
  })
})
```

- [ ] **Step 1-2: テストを走らせて失敗を確認**

Run: `npx vitest run src/features/editor/memo-utils.test.ts`
Expected: `splitTextWithUrls` を export していないため import エラーで失敗する（または `is not a function`）。

- [ ] **Step 1-3: 最小実装**

`src/features/editor/memo-utils.ts` の末尾に以下を追記:

```ts
export type MemoTextSegment = { type: 'text' | 'url'; value: string }

const URL_REGEX = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g

export function splitTextWithUrls(text: string): MemoTextSegment[] {
  if (!text) return []
  const segments: MemoTextSegment[] = []
  let last = 0
  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index ?? 0
    if (start > last) {
      segments.push({ type: 'text', value: text.slice(last, start) })
    }
    segments.push({ type: 'url', value: match[0] })
    last = start + match[0].length
  }
  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) })
  }
  return segments
}
```

- [ ] **Step 1-4: テストが pass するか確認**

Run: `npx vitest run src/features/editor/memo-utils.test.ts`
Expected: すべて pass（既存 parseNote / serializeMemo / measureMemoHeight も引き続き pass）。

- [ ] **Step 1-5: コミット**

```bash
git add src/features/editor/memo-utils.ts src/features/editor/memo-utils.test.ts
git commit -m "feat(#331): add splitTextWithUrls util for memo URL detection"
```

---

## Task 2: `MemoText` コンポーネントの TDD

**Files:**

- Create: `src/features/editor/components/MemoText.tsx`
- Create: `src/features/editor/components/MemoText.test.tsx`

- [ ] **Step 2-1: 失敗テストを作成**

`src/features/editor/components/MemoText.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MemoText } from './MemoText'

describe('MemoText', () => {
  it('renders plain text without anchor when no URL is present', () => {
    const { container, queryByRole } = render(<MemoText text="just plain text" color="#000" />)
    expect(queryByRole('link')).toBeNull()
    expect(container.textContent).toBe('just plain text')
  })

  it('renders an anchor for an https URL', () => {
    const { getByRole } = render(<MemoText text="visit https://example.com" color="#000" />)
    const link = getByRole('link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('sets target=_blank and a strict rel', () => {
    const { getByRole } = render(<MemoText text="https://example.com" color="#000" />)
    const link = getByRole('link') as HTMLAnchorElement
    expect(link.getAttribute('target')).toBe('_blank')
    const rel = link.getAttribute('rel') ?? ''
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
    expect(rel).toContain('nofollow')
  })

  it('makes the anchor pointer-interactive even though container is non-interactive', () => {
    const { container, getByRole } = render(<MemoText text="https://example.com" color="#000" />)
    const root = container.firstChild as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
    expect(root.style.userSelect).toBe('none')

    const link = getByRole('link') as HTMLAnchorElement
    expect(link.style.pointerEvents).toBe('auto')
    expect(link.style.userSelect).toBe('auto')
  })

  it('uses pre-wrap whiteSpace so newlines are preserved', () => {
    const { container } = render(<MemoText text={'line1\nline2'} color="#000" />)
    const root = container.firstChild as HTMLElement
    expect(root.style.whiteSpace).toBe('pre-wrap')
  })

  it('does NOT linkify dangerous schemes', () => {
    const { queryByRole, container } = render(
      <MemoText text="javascript:alert(1) data:text/html,x" color="#000" />,
    )
    expect(queryByRole('link')).toBeNull()
    expect(container.textContent).toBe('javascript:alert(1) data:text/html,x')
  })

  it('stops mousedown and click propagation on the anchor', () => {
    const onParentMouseDown = vi.fn()
    const onParentClick = vi.fn()
    const { getByRole } = render(
      <div onMouseDown={onParentMouseDown} onClick={onParentClick}>
        <MemoText text="https://example.com" color="#000" />
      </div>,
    )
    const link = getByRole('link') as HTMLAnchorElement
    fireEvent.mouseDown(link)
    fireEvent.click(link)
    expect(onParentMouseDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('renders nothing visible for empty text', () => {
    const { container } = render(<MemoText text="" color="#000" />)
    expect(container.textContent).toBe('')
  })
})
```

- [ ] **Step 2-2: テスト走らせて失敗を確認**

Run: `npx vitest run src/features/editor/components/MemoText.test.tsx`
Expected: `MemoText` を import できず失敗。

- [ ] **Step 2-3: 実装を作成**

`src/features/editor/components/MemoText.tsx` を新規作成:

```tsx
import { Fragment } from 'react'
import { splitTextWithUrls } from '../memo-utils'

type Props = {
  text: string
  color: string
  linkColor?: string
}

export function MemoText({ text, color, linkColor }: Props) {
  const segments = splitTextWithUrls(text)
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: '1.55',
        color,
        fontFamily: 'inherit',
        padding: '5px 8px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {segments.map((seg, i) =>
        seg.type === 'url' ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              color: linkColor ?? color,
              textDecoration: 'underline',
              pointerEvents: 'auto',
              userSelect: 'auto',
              overflowWrap: 'anywhere',
            }}
          >
            {seg.value}
          </a>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </div>
  )
}
```

- [ ] **Step 2-4: テストが pass するか確認**

Run: `npx vitest run src/features/editor/components/MemoText.test.tsx`
Expected: 全テスト pass。

- [ ] **Step 2-5: コミット**

```bash
git add src/features/editor/components/MemoText.tsx src/features/editor/components/MemoText.test.tsx
git commit -m "feat(#331): add MemoText component with URL/newline rendering"
```

---

## Task 3: `PanelTextarea` の `submitOnEnter` 拡張

**Files:**

- Modify: `src/features/editor/components/PanelParts.tsx`
- Create: `src/features/editor/components/PanelParts.test.tsx`

- [ ] **Step 3-1: 失敗テストを作成**

`src/features/editor/components/PanelParts.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PanelTextarea } from './PanelParts'

describe('PanelTextarea', () => {
  it('blurs on Enter when submitOnEnter is unset (default true)', () => {
    const onChange = vi.fn()
    const { container } = render(<PanelTextarea value="" onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    expect(document.activeElement).toBe(ta)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(document.activeElement).not.toBe(ta)
  })

  it('does NOT blur on Enter when submitOnEnter is false', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PanelTextarea value="" onChange={onChange} submitOnEnter={false} />,
    )
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    expect(document.activeElement).toBe(ta)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(document.activeElement).toBe(ta)
  })

  it('does not blur during IME composition even when submitOnEnter is true', () => {
    const onChange = vi.fn()
    const { container } = render(<PanelTextarea value="" onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.focus()
    fireEvent.keyDown(ta, { key: 'Enter', isComposing: true })
    expect(document.activeElement).toBe(ta)
  })
})
```

- [ ] **Step 3-2: テスト走らせて失敗を確認**

Run: `npx vitest run src/features/editor/components/PanelParts.test.tsx`
Expected: 「does NOT blur on Enter when submitOnEnter is false」が失敗（現実装では submitOnEnter プロパティが存在しない＝既定で blur してしまう）。

- [ ] **Step 3-3: `PanelTextarea` を改修**

`src/features/editor/components/PanelParts.tsx` の `PanelTextarea` を以下に置換:

```tsx
export const PanelTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 2,
  submitOnEnter = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  submitOnEnter?: boolean
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={styles.panelTextarea}
    onKeyDown={(e) => {
      if (e.nativeEvent.isComposing) return
      if (!submitOnEnter) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ;(e.currentTarget as HTMLTextAreaElement).blur()
      }
    }}
  />
)
```

- [ ] **Step 3-4: テストが pass するか確認**

Run: `npx vitest run src/features/editor/components/PanelParts.test.tsx`
Expected: 全テスト pass。

- [ ] **Step 3-5: コミット**

```bash
git add src/features/editor/components/PanelParts.tsx src/features/editor/components/PanelParts.test.tsx
git commit -m "feat(#331): add submitOnEnter option to PanelTextarea"
```

---

## Task 4: FlowEditor 通常表示を `MemoText` に置換

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`（3487-3503）

- [ ] **Step 4-1: 既存メモ表示の `<foreignObject>` ＋ `<div>` を `MemoText` に置換**

`src/features/editor/FlowEditor.tsx` の以下のブロック（line 3487-3503 周辺、`{m.text ? (` の foreignObject 内 `<div>...</div>`）:

```tsx
{m.text ? (
  <foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
    <div
      style={{
        fontSize: 11,
        lineHeight: '1.55',
        color: T.memoText,
        fontFamily: 'inherit',
        padding: '5px 8px',
        wordBreak: 'break-all' as const,
        pointerEvents: 'none',
        userSelect: 'none' as const,
      }}
    >
      {m.text}
    </div>
  </foreignObject>
) : (
```

を以下に置換:

```tsx
{m.text ? (
  <foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
    <MemoText text={m.text} color={T.memoText} />
  </foreignObject>
) : (
```

- [ ] **Step 4-2: import を追加**

ファイル先頭の import 群（既存 `import` の塊）に以下を追記:

```ts
import { MemoText } from './components/MemoText'
```

- [ ] **Step 4-3: 既存 FlowEditor テスト群が pass することを確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全 pass（特に `textarea[placeholder="memoPlaceholder"]` セレクタの既存テスト＝インライン編集 textarea は無改修なので影響なし）。

- [ ] **Step 4-4: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "refactor(#331): use MemoText for editor memo display"
```

---

## Task 5: SharedFlowViewer を `MemoText` に置換

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx`（471-486）

- [ ] **Step 5-1: 既存メモ表示の `<foreignObject>` ＋ `<div>` を `MemoText` に置換**

`src/features/shared/SharedFlowViewer.tsx` の以下のブロック:

```tsx
<foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
  <div
    style={{
      fontSize: 11,
      lineHeight: '1.55',
      color: T.memoText,
      fontFamily: 'inherit',
      padding: '5px 8px',
      wordBreak: 'break-all',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  >
    {memo.text}
  </div>
</foreignObject>
```

を以下に置換:

```tsx
<foreignObject x={mx} y={my} width={MEMO_W} height={mh}>
  <MemoText text={memo.text} color={T.memoText} />
</foreignObject>
```

- [ ] **Step 5-2: import を追加**

`SharedFlowViewer.tsx` の先頭 import 群に以下を追記:

```ts
import { MemoText } from '../editor/components/MemoText'
```

- [ ] **Step 5-3: 既存テストが pass することを確認**

Run: `npx vitest run src/features/shared`
Expected: 全 pass。

- [ ] **Step 5-4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "refactor(#331): use MemoText for shared viewer memo display"
```

---

## Task 6: 右パネルのメモ入力を `PanelTextarea` に置換

**Files:**

- Modify: `src/features/editor/components/RightPanel.tsx`（368 周辺）

- [ ] **Step 6-1: `PanelInput` を `PanelTextarea(submitOnEnter=false, rows=3)` に置換**

`src/features/editor/components/RightPanel.tsx` の以下のブロック:

```tsx
<PanelSection label={t('rightPanel.memo')}>
  <PanelInput
    value={memos[selTask]?.text || ''}
    placeholder={t('rightPanel.memoPlaceholder')}
    onChange={(v: string) =>
      setMemos((p2) => {
        if (!v) {
          const n = { ...p2 }
          delete n[selTask]
          return n
        }
        return {
          ...p2,
          [selTask]: { ...(p2[selTask] || { dx: 50, dy: 46 }), text: v },
        }
      })
    }
```

を以下に置換（閉じタグの位置は元のまま、`PanelInput` を `PanelTextarea` に変えて `submitOnEnter={false}` `rows={3}` を追加するだけ）:

```tsx
<PanelSection label={t('rightPanel.memo')}>
  <PanelTextarea
    value={memos[selTask]?.text || ''}
    placeholder={t('rightPanel.memoPlaceholder')}
    submitOnEnter={false}
    rows={3}
    onChange={(v: string) =>
      setMemos((p2) => {
        if (!v) {
          const n = { ...p2 }
          delete n[selTask]
          return n
        }
        return {
          ...p2,
          [selTask]: { ...(p2[selTask] || { dx: 50, dy: 46 }), text: v },
        }
      })
    }
```

(import 文 5 行目はすでに `PanelTextarea` を含むので追加不要)

- [ ] **Step 6-2: 関連テストが pass することを確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全 pass。

- [ ] **Step 6-3: コミット**

```bash
git add src/features/editor/components/RightPanel.tsx
git commit -m "feat(#331): make right panel memo input multi-line"
```

---

## Task 7: 統合テスト追加（FlowEditor）

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 7-1: 統合テストを追加**

`src/features/editor/FlowEditor.test.tsx` 末尾の最後の `describe` ブロック直後（最終 `})` 直前）に以下の `describe` を追加:

```tsx
describe('memo URL/newline rendering (#331)', () => {
  function makeFlowWithNode() {
    const flow = createMinimalFlow()
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
    ]
    return flow
  }

  function addMemoText(container: HTMLElement, text: string) {
    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    expect(nodeRect).toBeTruthy()
    fireEvent.click(nodeRect!)

    const toolbarBtns = container.querySelectorAll('[data-testid="toolbar-btn"]')
    expect(toolbarBtns.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(toolbarBtns[1])

    const textarea = container.querySelector('textarea[placeholder="memoPlaceholder"]')
    expect(textarea).toBeTruthy()
    fireEvent.change(textarea!, { target: { value: text } })
    fireEvent.blur(textarea!)
  }

  it('renders newline in memo text using whiteSpace pre-wrap', () => {
    const flow = makeFlowWithNode()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    addMemoText(container, 'line1\nline2')

    // Re-render shows MemoText container with whiteSpace pre-wrap
    const memoNote = container.querySelector('[data-testid="memo-note"]')!
    const memoDiv = memoNote.querySelector('foreignObject > div') as HTMLElement
    expect(memoDiv).toBeTruthy()
    expect(memoDiv.style.whiteSpace).toBe('pre-wrap')
    expect(memoDiv.textContent).toContain('line1')
    expect(memoDiv.textContent).toContain('line2')
  })

  it('renders an anchor element for https URL inside memo', () => {
    const flow = makeFlowWithNode()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    addMemoText(container, 'click https://example.com please')

    const memoNote = container.querySelector('[data-testid="memo-note"]')!
    const link = memoNote.querySelector('a[href="https://example.com"]') as HTMLAnchorElement
    expect(link).toBeTruthy()
    expect(link.getAttribute('target')).toBe('_blank')
    const rel = link.getAttribute('rel') ?? ''
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
  })

  it('right panel memo input is a textarea (multi-line)', () => {
    const flow = makeFlowWithNode()
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)

    const nodeRects = container.querySelectorAll('rect[rx="10"]')
    const nodeRect = Array.from(nodeRects).find((r) => r.getAttribute('width') === '152')
    fireEvent.click(nodeRect!)

    const memoTextarea = container.querySelector(
      'textarea[placeholder="rightPanel.memoPlaceholder"]',
    )
    expect(memoTextarea).toBeTruthy()
    expect((memoTextarea as HTMLTextAreaElement).tagName).toBe('TEXTAREA')
  })
})
```

- [ ] **Step 7-2: 全テスト走らせて pass を確認**

Run: `npm test -- --run`
Expected: 全 pass（FAILが1つでもあれば次に進まない）。

- [ ] **Step 7-3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test(#331): add integration tests for memo URL/newline"
```

---

## Task 8: 全体回帰確認 & 本番ビルド

**Files:** （ビルド／確認のみ）

- [ ] **Step 8-1: lint と型チェック**

Run: `npm run lint && npx tsc --noEmit`
Expected: エラーなし。エラーが出たら **修正してから次へ**。

- [ ] **Step 8-2: 全テストを最終実行**

Run: `npm test -- --run`
Expected: 全 pass（FAIL ゼロ）。

- [ ] **Step 8-3: 本番ビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 8-4: 本番プレビュー（preview skill）**

Skill: `~/.claude/skills/preview/SKILL.md` の手順に従って起動し、以下を Playwright（または手動）で確認:

- エディタを開く → ノード選択 → 右パネル「メモ」欄に複数行＋URL を入力 → メモ吹き出しに改行とリンクが反映される
- リンククリック → 別タブで開く・ドラッグ／編集モードが起動しない
- 共有ビュー（公開リンク）でも改行・リンクが表示される
- LCP 1 秒以内（preview skill の計測手順に従う）

スクリーンショットは `.screenshots/` に保存。

不具合があれば Task 1〜7 のいずれかに戻り修正。

---

## Task 9: 最新 main 同期 → PR

**Files:** （ブランチ運用のみ）

- [ ] **Step 9-1: 最新 main にリベース**

```bash
git pull origin main --rebase
npm test -- --run
```

Expected: 全 pass。コンフリクトがあれば解決して再テスト。

- [ ] **Step 9-2: push と PR 作成**

```bash
git push -u origin feat/memo-url-newline-331
gh pr create --title "feat(#331): make memo URLs clickable and reflect newlines" --body "$(cat <<'EOF'
## Summary
- メモ吹き出し内の `https?://` URL を別タブリンクに自動変換
- メモの改行が表示・入力に反映されるように
- 右パネルのメモ欄を複数行入力 (`PanelTextarea(submitOnEnter=false)`) に変更

Closes #331

## Test plan
- [x] `splitTextWithUrls` の単体テスト（複数 URL／句読点除外／危険スキーム除外／改行）
- [x] `MemoText` の単体テスト（`<a target=_blank rel=noopener noreferrer nofollow>`／pointer-events／whiteSpace pre-wrap／stopPropagation）
- [x] `PanelTextarea` の `submitOnEnter` 切替テスト
- [x] FlowEditor 統合テスト（改行表示・URL リンク化・右パネル textarea）
- [x] 既存メモ関連テスト全 pass
- [ ] Playwright 実画面確認（エディタ通常表示・共有ビュー・右パネル入力）
EOF
)"
```

- [ ] **Step 9-3: CI を待機**

Run: `gh pr checks --watch`
Expected: 全 pass。Fail があれば修正 → push → 再 watch。

- [ ] **Step 9-4: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 9-5: レビュー結果に応じて修正ループ（最大10回）**

CLAUDE.md の Step 9 に従う。**[C:承認OK]** が出るまで `sleep 60` → `gh pr view --json comments` → 修正 → push を繰り返す。

---

## Task 10: Merge & Deploy 確認 & クリーンアップ

**Files:** （Merge ／クリーンアップのみ）

- [ ] **Step 10-1: Merge**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 10-2: Deploy 確認**

`~/.claude/skills/deploy/SKILL.md` の手順を実行。

- [ ] **Step 10-3: worktree 削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/feat-memo-url-newline-331
git branch -d feat/memo-url-newline-331
git worktree list
```

残骸が無いことを確認。

---

## 受け入れ条件（Spec 由来チェックリスト）

- [ ] メモ内の `https?://...` がリンク表示になり、別タブで開く（Task 2/4/5/7 でカバー）
- [ ] メモ内の改行が表示に反映される（エディタ通常表示・共有ビュー）（Task 2/4/5/7）
- [ ] リンククリックでドラッグ・編集モードが起動しない（Task 2/8）
- [ ] 右パネルの「メモ」欄で改行入力できる（Task 3/6/7）
- [ ] エディタ通常表示・インライン編集後の表示・共有ビューの全てで動作（Task 4/5/8）
- [ ] `parseNote` / `measureMemoHeight` の既存テストが通る（Task 1 で回帰確認、Task 8 で最終確認）
- [ ] `MemoText` / `splitTextWithUrls` の単体テストを追加（Task 1/2）
