# Node Memo & Unified Toolbar Design

Issue: #281

## Overview

Introduce draggable memo (sticky note) functionality for nodes and a unified toolbar UI shared between nodes and arrows. Implementation follows a two-phase approach to minimize PR size and risk.

## Phase 1: Unified Toolbar

### Toolbar Component

New file: `src/features/editor/components/Toolbar.tsx`

```typescript
interface ToolbarItem {
  icon: ReactNode
  action: string
  color: string
  hoverBg: string
}

interface ToolbarProps {
  x: number
  y: number
  items: ToolbarItem[]
  onAction: (action: string) => void
}
```

- SVG `<g>` element with pill-shaped background (`rx={bh/2}`)
- Entrance animation: CSS `@keyframes tbIn` (scale + opacity)
- Replaces existing `arrow-floating-controls` inline code

### Node Toolbar (on selTask)

| Button | Action | Behavior |
|--------|--------|----------|
| Connect | `connect` | Set `connectFrom`, enter connection mode |
| Memo | `memo` | Add/edit memo (sticky note in Phase 2) |
| Delete | `delete` | Delete node + related arrows + memo |

### Arrow Toolbar (on selArrow)

| Button | Action | Behavior |
|--------|--------|----------|
| Reverse | `reverse` | Swap from/to |
| Comment | `comment` | Inline comment edit |
| Delete | `delete` | Delete arrow |

### Theme Additions

Add to `theme-constants.ts`:

```typescript
toolbarBg: string
toolbarBorder: string
toolbarShadow: string
```

## Phase 2: Draggable Memo (Sticky Note)

### Data Structure Migration

Current: `notes: Record<string, string>`
New: `memos: Record<string, MemoData>`

```typescript
interface MemoData {
  text: string
  dx: number  // X offset from node center
  dy: number  // Y offset from node center
}
```

### DB Compatibility

Store JSON in existing `nodes.note` column (TEXT). No schema migration needed.

Read-time detection:
- Old format: `"plain text"` -> `{ text: "plain text", dx: default, dy: 46 }`
- New format: `'{"text":"...","dx":50,"dy":46}'` -> parse as-is

### Initial Placement

- Left-half lanes (`li < lanes.length / 2`): `dx: +50` (offset right)
- Right-half lanes: `dx: -50` (offset left)
- `dy: 46` always (below node bottom)

### Rendering

- Memo body: `#FFFDE7` background, border, `rx=7`, width 152px
- Dashed connector: node bottom -> memo top, `strokeDasharray="4,3"`, endpoint dots (r=2.5)
- Text: multi-line via `<textarea>` in `<foreignObject>`, `wordBreak: break-all`
- Overflow OK: row height (RH) is fixed, memos may overlap nodes below

### Drag Behavior

- State: `draggingMemo: { key, startX, startY, origDx, origDy } | null`
- Handle via SVG `onMouseMove` / `onMouseUp`
- Click vs drag: movement < 3px = click (edit mode), >= 3px = drag (reposition)

### Hover UI

- Border: 0.7px -> 1.2px emphasis
- Grip dots: 6-dot pattern (2 cols x 3 rows) at top-right

### Deletion Rules

- Empty text on blur -> auto-delete memo
- Node deletion -> associated memo deleted

### Theme Additions

```typescript
memoBg: string
memoBorder: string
memoBorderHover: string
memoText: string
memoConnector: string
```

## Affected Files

| File | Phase | Changes |
|------|-------|---------|
| `src/features/editor/components/Toolbar.tsx` | 1 | New component |
| `src/features/editor/FlowEditor.tsx` | 1+2 | Toolbar integration, notes->memos migration, memo rendering/drag |
| `src/features/editor/components/RightPanel.tsx` | 2 | Update to `memos[selTask]?.text` |
| `src/features/shared/SharedFlowViewer.tsx` | 2 | Sticky note + connector read-only display |
| `src/features/editor/theme-constants.ts` | 1+2 | Toolbar + memo theme colors |
| `src/lib/flow-engine.ts` | 2 | `SwapResult.notes` -> `SwapResult.memos` type change |
| `src/features/editor/types.ts` | 2 | `MemoData` interface |

## Deprecations

- Remove inline note display (16px rect below node)
- Remove `editNote` state and `inputRef`-based inline editing
- Remove hover "memo add" text click handler
