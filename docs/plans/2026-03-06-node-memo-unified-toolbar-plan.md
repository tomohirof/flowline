# Node Memo & Unified Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add draggable memo (sticky note) to nodes and unify node/arrow toolbar UI into a shared component.

**Architecture:** Two-phase approach. Phase 1 extracts a reusable `Toolbar` SVG component and wires it for both node and arrow selection. Phase 2 migrates `notes: Record<string, string>` to `memos: Record<string, MemoData>` with `{text, dx, dy}`, adds draggable sticky-note rendering with dashed connectors.

**Tech Stack:** React, TypeScript, SVG, CSS Modules, Vitest, Playwright

---

## Phase 1: Unified Toolbar

### Task 1: Add toolbar theme constants

**Files:**

- Modify: `src/features/editor/types.ts`
- Modify: `src/features/editor/theme-constants.ts`

**Step 1: Add toolbar theme fields to Theme interface**

In `src/features/editor/types.ts`, add to the `Theme` interface after `dangerColor`:

```typescript
toolbarBg: string
toolbarBorder: string
toolbarShadow: string
```

**Step 2: Add toolbar values to all three themes**

In `src/features/editor/theme-constants.ts`, add to each theme:

```typescript
// cloud
toolbarBg: '#fff',
toolbarBorder: '#e8e6f0',
toolbarShadow: '0 4px 16px rgba(0,0,0,0.08)',

// midnight
toolbarBg: '#2A2A38',
toolbarBorder: '#444458',
toolbarShadow: '0 4px 16px rgba(0,0,0,0.3)',

// blueprint
toolbarBg: '#fff',
toolbarBorder: '#D8DDE6',
toolbarShadow: '0 4px 16px rgba(0,0,0,0.08)',
```

**Step 3: Commit**

```bash
git add src/features/editor/types.ts src/features/editor/theme-constants.ts
git commit -m "feat(#281): add toolbar theme constants"
```

---

### Task 2: Create Toolbar component with tests

**Files:**

- Create: `src/features/editor/components/Toolbar.tsx`
- Create: `src/features/editor/components/Toolbar.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/features/editor/components/Toolbar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from './Toolbar'

const defaultTheme = {
  toolbarBg: '#fff',
  toolbarBorder: '#e8e6f0',
  toolbarShadow: '0 4px 16px rgba(0,0,0,0.08)',
  accent: '#7C5CFC',
  dangerColor: '#E06060',
  commentIconColor: '#D09030',
}

const renderInSvg = (ui: React.ReactElement) =>
  render(<svg>{ui}</svg>)

describe('Toolbar', () => {
  it('should render all items', () => {
    const onAction = vi.fn()
    renderInSvg(
      <Toolbar
        x={100}
        y={50}
        items={[
          { icon: 'A', action: 'act-a', color: '#000', hoverBg: '#eee' },
          { icon: 'B', action: 'act-b', color: '#000', hoverBg: '#eee' },
        ]}
        onAction={onAction}
        theme={defaultTheme}
      />,
    )
    expect(screen.getByTestId('toolbar-pill')).toBeInTheDocument()
    expect(screen.getAllByTestId('toolbar-btn')).toHaveLength(2)
  })

  it('should call onAction with correct action string on click', () => {
    const onAction = vi.fn()
    renderInSvg(
      <Toolbar
        x={100}
        y={50}
        items={[
          { icon: 'A', action: 'delete', color: '#E06060', hoverBg: '#FEE' },
        ]}
        onAction={onAction}
        theme={defaultTheme}
      />,
    )
    fireEvent.click(screen.getByTestId('toolbar-btn'))
    expect(onAction).toHaveBeenCalledWith('delete')
  })

  it('should not render when items array is empty', () => {
    renderInSvg(
      <Toolbar x={0} y={0} items={[]} onAction={vi.fn()} theme={defaultTheme} />,
    )
    expect(screen.queryByTestId('toolbar-pill')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/editor/components/Toolbar.test.tsx
```

Expected: FAIL (module not found)

**Step 3: Write Toolbar component**

```typescript
// src/features/editor/components/Toolbar.tsx
import type { ReactNode } from 'react'

export interface ToolbarItem {
  icon: ReactNode
  action: string
  color: string
  hoverBg: string
}

interface ToolbarTheme {
  toolbarBg: string
  toolbarBorder: string
  toolbarShadow: string
}

export interface ToolbarProps {
  x: number
  y: number
  items: ToolbarItem[]
  onAction: (action: string) => void
  theme: ToolbarTheme
}

const BTN_W = 32
const BTN_H = 30
const PAD = 8
const ICON_SIZE = 16

export function Toolbar({ x, y, items, onAction, theme }: ToolbarProps) {
  if (items.length === 0) return null
  const pillW = items.length * BTN_W + PAD * 2
  const pillH = BTN_H + 4
  const pillX = x - pillW / 2
  const pillY = y

  return (
    <g data-testid="toolbar-pill" className="toolbar-enter">
      <rect
        x={pillX}
        y={pillY}
        width={pillW}
        height={pillH}
        rx={pillH / 2}
        fill={theme.toolbarBg}
        stroke={theme.toolbarBorder}
        strokeWidth={0.5}
        style={{ filter: `drop-shadow(${theme.toolbarShadow})` }}
      />
      {items.map((item, i) => {
        const bx = pillX + PAD + i * BTN_W
        return (
          <g
            key={i}
            data-testid="toolbar-btn"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onAction(item.action)
            }}
          >
            <rect
              x={bx}
              y={pillY + 2}
              width={BTN_W}
              height={BTN_H}
              rx={8}
              fill="transparent"
              onMouseEnter={(e) =>
                (e.target as SVGRectElement).setAttribute('fill', item.hoverBg)
              }
              onMouseLeave={(e) =>
                (e.target as SVGRectElement).setAttribute('fill', 'transparent')
              }
            />
            <foreignObject
              x={bx + (BTN_W - ICON_SIZE) / 2}
              y={pillY + 2 + (BTN_H - ICON_SIZE) / 2}
              width={ICON_SIZE}
              height={ICON_SIZE}
            >
              <div
                style={{
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {item.icon}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </g>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/editor/components/Toolbar.test.tsx
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/features/editor/components/Toolbar.tsx src/features/editor/components/Toolbar.test.tsx
git commit -m "feat(#281): add unified Toolbar SVG component with tests"
```

---

### Task 3: Add toolbar CSS animation

**Files:**

- Modify: `src/features/editor/FlowEditor.module.css`

**Step 1: Add toolbar entrance animation**

Append to the CSS module:

```css
.toolbarEnter {
  animation: tbIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes tbIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Step 2: Commit**

```bash
git add src/features/editor/FlowEditor.module.css
git commit -m "feat(#281): add toolbar entrance animation CSS"
```

---

### Task 4: Wire node toolbar into FlowEditor

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

**Step 1: Import Toolbar**

Add import at the top of FlowEditor.tsx:

```typescript
import { Toolbar } from './components/Toolbar'
import type { ToolbarItem } from './components/Toolbar'
```

**Step 2: Add node toolbar SVG icons**

Add SVG icon components (connect, comment, delete) as inline functions near the top of FlowEditor, or import from Toolbar file. Use the same SVG paths as the existing arrow-floating-controls icons.

**Step 3: Add node toolbar rendering**

After the existing connection handles section (`{/* Connection handles on hovered or selected nodes */}`), add the node toolbar rendering:

```typescript
{/* Node Toolbar */}
{selTask && !connectFrom && !dragging && !editing && multiSel.size === 0 && tasks[selTask] && (() => {
  const t = tasks[selTask]
  const li = liMap[t.lid], ri = riMap[t.rid]
  if (li === undefined || ri === undefined) return null
  const c = ct(li, ri)
  const hasMemo = !!notes[selTask]
  return (
    <Toolbar
      x={c.x}
      y={c.y + (t.shape === 'diamond' ? DS : TH / 2) + 8}
      items={[
        { icon: <IconConnect />, action: 'connect', color: T.accent, hoverBg: `${T.accent}10` },
        { icon: <IconComment />, action: 'memo', color: hasMemo ? '#E8A817' : T.commentIconColor, hoverBg: '#FFFDE7' },
        { icon: <IconDelete />, action: 'delete', color: T.dangerColor, hoverBg: '#FEE' },
      ]}
      onAction={(action) => {
        if (action === 'connect') {
          setConnectFrom(selTask)
          setSelTask(null)
        } else if (action === 'memo') {
          if (!notes[selTask]) setNotes((p) => ({ ...p, [selTask]: 'メモ' }))
          setEditNote(selTask)
          setSelTask(null)
        } else if (action === 'delete') {
          setTasks((p) => { const n = { ...p }; delete n[selTask]; return n })
          setArrows((p) => p.filter((a) => a.from !== selTask && a.to !== selTask))
          setNotes((p) => { const n = { ...p }; delete n[selTask]; return n })
          setOrder((p) => p.filter((k) => k !== selTask))
          setSelTask(null)
        }
      }}
      theme={T}
    />
  )
})()}
```

**Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass

**Step 5: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#281): wire node toolbar into FlowEditor"
```

---

### Task 5: Replace arrow floating controls with Toolbar component

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

**Step 1: Replace the existing arrow-floating-controls section**

Replace the inline `{/* Floating arrow controls */}` section (lines ~2684-2790) with the Toolbar component. Keep the same actions (reverse, comment, delete):

```typescript
{/* Arrow Toolbar */}
{selArrow && (() => {
  const ap = arrowPaths.find((x) => x.arrow.id === selArrow)
  if (!ap) return null
  const { mx, my } = ap.path
  const arrow = ap.arrow
  return (
    <Toolbar
      x={mx}
      y={my + 10}
      items={[
        { icon: <IconReverse />, action: 'reverse', color: T.accent, hoverBg: `${T.accent}10` },
        { icon: <IconComment />, action: 'comment', color: arrow.comment ? '#E8A817' : T.commentIconColor, hoverBg: '#FFFDE7' },
        { icon: <IconDelete />, action: 'delete', color: T.dangerColor, hoverBg: '#FEE' },
      ]}
      onAction={(action) => {
        if (action === 'reverse') {
          setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)))
        } else if (action === 'comment') {
          setEditArrowComment(selArrow)
          setSelArrow(null)
        } else if (action === 'delete') {
          setArrows((p) => p.filter((a) => a.id !== selArrow))
          setSelArrow(null)
        }
      }}
      theme={T}
    />
  )
})()}
```

**Step 2: Verify existing arrow toolbar tests still pass**

```bash
npm test
```

Expected: all tests pass (the data-testid changes from "arrow-floating-controls" to "toolbar-pill" — update any test that references the old testid)

**Step 3: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "refactor(#281): replace arrow floating controls with Toolbar component"
```

---

### Task 6: Visual verification of Phase 1

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Verify via Playwright or chrome-devtools**

- Create a flow with multiple nodes and arrows
- Click a node -> toolbar appears with 3 buttons (connect, memo, delete)
- Click an arrow -> toolbar appears with 3 buttons (reverse, comment, delete)
- Test each button action works correctly
- Take screenshots

**Step 3: Fix any visual issues found**

---

## Phase 2: Draggable Memo (Sticky Note)

### Task 7: Add MemoData type and memo theme constants

**Files:**

- Modify: `src/features/editor/types.ts`
- Modify: `src/features/editor/theme-constants.ts`

**Step 1: Add MemoData interface**

In `src/features/editor/types.ts`:

```typescript
export interface MemoData {
  text: string
  dx: number
  dy: number
}
```

Update `EditorSnapshot`:

```typescript
export interface EditorSnapshot {
  tasks: Record<string, TaskData>
  order: string[]
  arrows: InternalArrow[]
  memos: Record<string, MemoData>
  lanes: InternalLane[]
  rows: RowData[]
}
```

**Step 2: Add memo theme fields to Theme interface**

```typescript
memoBg: string
memoBorder: string
memoBorderHover: string
memoText: string
memoConnector: string
```

**Step 3: Add memo theme values**

```typescript
// cloud
memoBg: '#FFFDE7',
memoBorder: '#EED94E',
memoBorderHover: '#E8C840',
memoText: '#6D4C41',
memoConnector: '#E8D44D',

// midnight
memoBg: '#3A3520',
memoBorder: '#5A5030',
memoBorderHover: '#7A6A30',
memoText: '#D4C090',
memoConnector: '#8A7A30',

// blueprint
memoBg: '#FFFDE7',
memoBorder: '#EED94E',
memoBorderHover: '#E8C840',
memoText: '#6D4C41',
memoConnector: '#E8D44D',
```

**Step 4: Commit**

```bash
git add src/features/editor/types.ts src/features/editor/theme-constants.ts
git commit -m "feat(#281): add MemoData type and memo theme constants"
```

---

### Task 8: Add memo parsing utility with tests

**Files:**

- Create: `src/features/editor/memo-utils.ts`
- Create: `src/features/editor/memo-utils.test.ts`

**Step 1: Write failing tests**

```typescript
// src/features/editor/memo-utils.test.ts
import { describe, it, expect } from 'vitest'
import { parseNote, serializeMemo, measureMemoHeight } from './memo-utils'
import type { MemoData } from './types'

describe('parseNote', () => {
  it('should parse plain string as text with default offsets', () => {
    expect(parseNote('hello', 0, 4)).toEqual({ text: 'hello', dx: 50, dy: 46 })
  })

  it('should parse plain string with right-side lane offset', () => {
    expect(parseNote('hello', 3, 4)).toEqual({ text: 'hello', dx: -50, dy: 46 })
  })

  it('should parse JSON MemoData', () => {
    const json = '{"text":"note","dx":30,"dy":60}'
    expect(parseNote(json, 0, 4)).toEqual({ text: 'note', dx: 30, dy: 60 })
  })

  it('should return null for null/empty input', () => {
    expect(parseNote(null, 0, 4)).toBeNull()
    expect(parseNote('', 0, 4)).toBeNull()
  })
})

describe('serializeMemo', () => {
  it('should serialize MemoData to JSON string', () => {
    const memo: MemoData = { text: 'test', dx: 50, dy: 46 }
    const result = serializeMemo(memo)
    expect(JSON.parse(result)).toEqual(memo)
  })

  it('should return null for empty text', () => {
    expect(serializeMemo({ text: '', dx: 50, dy: 46 })).toBeNull()
  })
})

describe('measureMemoHeight', () => {
  it('should return minimum height for empty text', () => {
    expect(measureMemoHeight('', 152)).toBe(30)
  })

  it('should return minimum height for short text', () => {
    expect(measureMemoHeight('hi', 152)).toBe(30)
  })

  it('should grow height for multiline text', () => {
    const longText = 'a'.repeat(100)
    expect(measureMemoHeight(longText, 152)).toBeGreaterThan(30)
  })
})
```

**Step 2: Run test to verify failure**

```bash
npx vitest run src/features/editor/memo-utils.test.ts
```

**Step 3: Implement memo-utils**

```typescript
// src/features/editor/memo-utils.ts
import type { MemoData } from './types'

export function parseNote(
  note: string | null,
  laneIndex: number,
  totalLanes: number,
): MemoData | null {
  if (!note) return null
  if (note.startsWith('{')) {
    try {
      const parsed = JSON.parse(note)
      if (typeof parsed.text === 'string' && typeof parsed.dx === 'number') {
        return parsed as MemoData
      }
    } catch {
      // fall through to plain text
    }
  }
  const dx = laneIndex < totalLanes / 2 ? 50 : -50
  return { text: note, dx, dy: 46 }
}

export function serializeMemo(memo: MemoData): string | null {
  if (!memo.text) return null
  return JSON.stringify(memo)
}

export const MEMO_W = 152

export function measureMemoHeight(text: string, width: number): number {
  if (!text) return 30
  const cpl = Math.floor((width - 16) / 11)
  const lines = text
    .split('\n')
    .reduce((a, l) => a + Math.max(1, Math.ceil((l.length || 1) / cpl)), 0)
  return Math.max(30, lines * 17 + 14)
}
```

**Step 4: Run test to verify pass**

```bash
npx vitest run src/features/editor/memo-utils.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/editor/memo-utils.ts src/features/editor/memo-utils.test.ts
git commit -m "feat(#281): add memo parsing/serialization utilities with tests"
```

---

### Task 9: Migrate notes to memos in FlowEditor

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

This is a large change. Key modifications:

**Step 1: Update flowToInternalState**

Replace `notes[key] = n.note` with:

```typescript
if (n.note) {
  const memo = parseNote(n.note, liMap[n.laneId], lanes.length)
  if (memo) memos[key] = memo
}
```

Return `memos` instead of `notes`.

**Step 2: Update internalStateToPayload**

Replace `note: notes[k] || null` with:

```typescript
note: memos[k] ? serializeMemo(memos[k]) : null,
```

**Step 3: Rename state**

```typescript
// Replace:
const [notes, setNotes] = useState<Record<string, string>>(initState.notes)
const [editNote, setEditNote] = useState<string | null>(null)

// With:
const [memos, setMemos] = useState<Record<string, MemoData>>(initState.memos)
const [editingMemo, setEditingMemo] = useState<string | null>(null)
```

**Step 4: Update all notes references**

Replace all `notes` -> `memos`, `setNotes` -> `setMemos`, `editNote` -> `editingMemo`, `setEditNote` -> `setEditingMemo` throughout the file. Update string operations to use `.text` property.

**Step 5: Update swap/move logic**

In `flow-engine.ts`, update `SwapResult` to use `memos: Record<string, MemoData>`. Update `swapKeys` function to swap `MemoData` objects instead of strings.

**Step 6: Update RightPanel**

Change `notes[selTask]` to `memos[selTask]?.text` and update the `onChange` handler.

**Step 7: Remove old inline note display**

Remove the old note display code (the 16px yellow rect below nodes, lines ~2390-2444).

**Step 8: Run all tests**

```bash
npm test
```

Fix any failures from the rename.

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor(#281): migrate notes to memos (MemoData with dx/dy)"
```

---

### Task 10: Add draggable memo rendering with tests

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

**Step 1: Add memo-related state**

```typescript
const [draggingMemo, setDraggingMemo] = useState<{
  key: string
  startX: number
  startY: number
  origDx: number
  origDy: number
} | null>(null)
const [hoveredMemo, setHoveredMemo] = useState<string | null>(null)
```

**Step 2: Add memo drag handlers**

Add `onMemoMouseDown`, `onSvgMouseMove` (memo drag part), `onSvgMouseUp` (memo drag part) following the demo JSX pattern. Integrate into existing SVG mouse event handlers.

**Step 3: Add memo rendering**

After arrows and nodes, add the memo rendering layer. For each memo entry:

1. Dashed connector line from node bottom to memo top
2. Endpoint dots (r=2.5)
3. Memo rect (yellow bg, rx=7, width=MEMO_W)
4. Text display (foreignObject) or textarea (editing mode)
5. Grip dots on hover (6-dot pattern)

Use `measureMemoHeight` from `memo-utils.ts` for dynamic height.

**Step 4: Update node toolbar memo action**

When "memo" action is triggered from node toolbar:

```typescript
if (action === 'memo') {
  if (!memos[selTask]) {
    const t = tasks[selTask]
    const li = liMap[t.lid]
    const dx = li < lanes.length / 2 ? 50 : -50
    setMemos((p) => ({ ...p, [selTask]: { text: '', dx, dy: 46 } }))
  }
  setEditingMemo(selTask)
  setSelTask(null)
}
```

**Step 5: Handle memo text empty on blur**

```typescript
onBlur={() => {
  if (!memos[key]?.text) {
    setMemos((p) => { const n = { ...p }; delete n[key]; return n })
  }
  setEditingMemo(null)
}}
```

**Step 6: Run all tests**

```bash
npm test
```

**Step 7: Commit**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#281): add draggable memo rendering with connectors"
```

---

### Task 11: Update SharedFlowViewer for new memo format

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx`

**Step 1: Replace old note display with sticky-note memo**

Replace the inline note rect (16px below node) with the same sticky-note rendering as FlowEditor, but read-only (no drag, no edit).

Use `parseNote` to convert `node.note` to `MemoData`, then render:

- Dashed connector
- Yellow memo rect with text
- No interaction handlers

**Step 2: Run tests**

```bash
npm test
```

**Step 3: Commit**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#281): update SharedFlowViewer with sticky-note memo display"
```

---

### Task 12: Update existing tests for memos migration

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/lib/flow-engine.test.ts`
- Modify: `src/features/shared/SharedFlowViewer.test.tsx`

**Step 1: Update FlowEditor tests**

Replace `notes` references with `memos` in test fixtures. Update any `arrow-floating-controls` testid references to `toolbar-pill`.

**Step 2: Update flow-engine tests**

Update `swapKeys` test to use `MemoData` objects instead of strings.

**Step 3: Update SharedFlowViewer tests**

Update note-related assertions for the new memo format.

**Step 4: Run all tests**

```bash
npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "test(#281): update all tests for memos migration"
```

---

### Task 13: Visual verification of Phase 2

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Verify via Playwright or chrome-devtools**

- Click node -> toolbar -> memo button -> empty memo appears
- Type text in memo -> blur -> memo saved
- Drag memo -> position updates, connector follows
- Click memo (no drag) -> edit mode
- Clear all text -> blur -> memo auto-deleted
- Hover memo -> border emphasis + grip dots
- Shared view shows memos read-only with connectors
- Old plain-text notes auto-converted on load
- Take screenshots

**Step 3: Fix any visual issues found**

---

### Task 14: Final test run and cleanup

**Step 1: Run full test suite**

```bash
npm test
```

All tests must pass.

**Step 2: Verify no unused code**

Check that the old `editNote`, `noteEditInput` CSS class, and inline note rendering code are fully removed.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore(#281): cleanup unused note code"
```
