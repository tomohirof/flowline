# 共有ビュー ティーザーモーダル + ボトムCTAバー Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 共有URL（`/shared/:token`）にティーザーモーダルとボトムCTAバーを追加し、閲覧者のサービス認知と新規登録への導線を提供する。

**Architecture:** TeaserModal と BottomCTABar を独立コンポーネントとして作成し、SharedFlowViewer.tsx に状態管理（showModal / showBottomBar）とblur制御を追加して統合する。

**Tech Stack:** React, CSS Modules, Vitest, @testing-library/react

---

## Task 1: TeaserModal コンポーネント

**Files:**
- Create: `src/features/shared/TeaserModal.tsx`
- Create: `src/features/shared/TeaserModal.module.css`
- Create: `src/features/shared/TeaserModal.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/shared/TeaserModal.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeaserModal } from './TeaserModal'

describe('TeaserModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render modal overlay with testid', () => {
    render(
      <TeaserModal
        flowTitle="Test Flow"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 1, 2]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
  })

  it('should display flow title', () => {
    render(
      <TeaserModal
        flowTitle="My Business Flow"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 1, 2]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('My Business Flow')).toBeInTheDocument()
  })

  it('should display Flowline logo text', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={4}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Flowline')).toBeInTheDocument()
  })

  it('should display lane and node count metadata', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={4}
        nodeCount={8}
        laneColors={[0, 1, 2, 3]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/4 レーン/)).toBeInTheDocument()
    expect(screen.getByText(/8 ノード/)).toBeInTheDocument()
  })

  it('should render lane color dots matching laneColors count', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={3}
        nodeCount={5}
        laneColors={[0, 2, 4]}
        onClose={vi.fn()}
      />,
    )
    const dots = screen.getAllByTestId('lane-dot')
    expect(dots).toHaveLength(3)
  })

  it('should render CTA button "フロー図を表示する"', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'フロー図を表示する' })).toBeInTheDocument()
  })

  it('should call onClose when CTA button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={onClose}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'フロー図を表示する' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should display free access text', () => {
    render(
      <TeaserModal
        flowTitle="Test"
        laneCount={2}
        nodeCount={3}
        laneColors={[0, 1]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('閲覧は無料 · ログイン不要')).toBeInTheDocument()
  })

  it('should render with zero lanes and nodes', () => {
    render(
      <TeaserModal
        flowTitle="Empty Flow"
        laneCount={0}
        nodeCount={0}
        laneColors={[]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
    expect(screen.getByText(/0 レーン/)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/shared/TeaserModal.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write TeaserModal component**

```tsx
// src/features/shared/TeaserModal.tsx
import { PALETTES } from '../editor/theme-constants'
import styles from './TeaserModal.module.css'

interface TeaserModalProps {
  flowTitle: string
  laneCount: number
  nodeCount: number
  laneColors: number[]
  onClose: () => void
}

export function TeaserModal({ flowTitle, laneCount, nodeCount, laneColors, onClose }: TeaserModalProps) {
  return (
    <div className={styles.overlay} data-testid="teaser-modal">
      <div className={styles.content}>
        <div className={styles.logo}>F</div>
        <div className={styles.brandName}>Flowline</div>
        <h2 className={styles.flowTitle}>{flowTitle}</h2>
        <p className={styles.subtitle}>Flowline で作成されたフロー</p>
        <div className={styles.meta}>
          {laneColors.map((colorIndex, i) => (
            <div
              key={i}
              data-testid="lane-dot"
              className={styles.laneDot}
              style={{ background: PALETTES[colorIndex % PALETTES.length].dot }}
            />
          ))}
          <span className={styles.metaText}>
            {laneCount} レーン · {nodeCount} ノード
          </span>
        </div>
        <button className={styles.ctaButton} onClick={onClose}>
          フロー図を表示する
        </button>
        <p className={styles.freeText}>閲覧は無料 · ログイン不要</p>
      </div>
    </div>
  )
}
```

```css
/* src/features/shared/TeaserModal.module.css */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.8) 100%
  );
  animation: overlayIn 0.3s ease both;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: linear-gradient(135deg, #7c5cfc, #5b8def);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 900;
  color: #fff;
  box-shadow: 0 2px 8px rgba(124, 92, 252, 0.25);
}

.brandName {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a2e;
  margin-top: 8px;
  letter-spacing: -0.02em;
}

.flowTitle {
  font-size: 18px;
  font-weight: 800;
  color: #1a1a2e;
  margin: 14px 0 4px;
  letter-spacing: -0.03em;
  text-align: center;
}

.subtitle {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 22px;
}

.laneDot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
}

.metaText {
  font-size: 10px;
  color: #bbb;
  margin-left: 4px;
}

.ctaButton {
  height: 44px;
  padding: 0 32px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c5cfc, #6246ea);
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.3);
  margin-bottom: 10px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.ctaButton:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124, 92, 252, 0.4);
}

.freeText {
  font-size: 10px;
  color: #ccc;
}

@keyframes overlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/shared/TeaserModal.test.tsx`
Expected: ALL PASS (9 tests)

**Step 5: Commit**

```bash
git add src/features/shared/TeaserModal.tsx src/features/shared/TeaserModal.module.css src/features/shared/TeaserModal.test.tsx
git commit -m "feat: add TeaserModal component for shared view #106"
```

---

## Task 2: BottomCTABar コンポーネント

**Files:**
- Create: `src/features/shared/BottomCTABar.tsx`
- Create: `src/features/shared/BottomCTABar.module.css`
- Create: `src/features/shared/BottomCTABar.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/shared/BottomCTABar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomCTABar } from './BottomCTABar'

describe('BottomCTABar', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render bar when visible is true', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('bottom-cta-bar')).toBeInTheDocument()
  })

  it('should not render bar when visible is false', () => {
    render(<BottomCTABar visible={false} onClose={vi.fn()} />)
    expect(screen.queryByTestId('bottom-cta-bar')).not.toBeInTheDocument()
  })

  it('should display Flowline logo', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('should display CTA heading text', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText('Flowline でフロー図を作成')).toBeInTheDocument()
  })

  it('should display sub text', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByText('無料で始める · チームで共有 · Mermaid対応')).toBeInTheDocument()
  })

  it('should have CTA link pointing to /?auth=register', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: '無料で試す →' })
    expect(link).toHaveAttribute('href', '/?auth=register')
  })

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<BottomCTABar visible={true} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('bottom-cta-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should have aria-label on close button for accessibility', () => {
    render(<BottomCTABar visible={true} onClose={vi.fn()} />)
    expect(screen.getByTestId('bottom-cta-close')).toHaveAttribute('aria-label', '閉じる')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/shared/BottomCTABar.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write BottomCTABar component**

```tsx
// src/features/shared/BottomCTABar.tsx
import styles from './BottomCTABar.module.css'

interface BottomCTABarProps {
  visible: boolean
  onClose: () => void
}

export function BottomCTABar({ visible, onClose }: BottomCTABarProps) {
  if (!visible) return null

  return (
    <div className={styles.wrapper} data-testid="bottom-cta-bar">
      <div className={styles.bar}>
        <div className={styles.logo}>F</div>
        <div className={styles.textBlock}>
          <div className={styles.heading}>Flowline でフロー図を作成</div>
          <div className={styles.subText}>無料で始める · チームで共有 · Mermaid対応</div>
        </div>
        <a href="/?auth=register" className={styles.ctaLink}>
          無料で試す →
        </a>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          data-testid="bottom-cta-close"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

```css
/* src/features/shared/BottomCTABar.module.css */
.wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.bar {
  margin: 0 20px 20px;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.logo {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: linear-gradient(135deg, #7c5cfc, #5b8def);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(124, 92, 252, 0.25);
}

.textBlock {
  flex: 1;
  min-width: 0;
}

.heading {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}

.subText {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.ctaLink {
  height: 38px;
  padding: 0 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c5cfc, #6246ea);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(124, 92, 252, 0.4);
  text-decoration: none;
  display: flex;
  align-items: center;
  transition: transform 0.15s, box-shadow 0.15s;
}

.ctaLink:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.5);
}

.closeBtn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.closeBtn:hover {
  background: rgba(255, 255, 255, 0.18);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/shared/BottomCTABar.test.tsx`
Expected: ALL PASS (8 tests)

**Step 5: Commit**

```bash
git add src/features/shared/BottomCTABar.tsx src/features/shared/BottomCTABar.module.css src/features/shared/BottomCTABar.test.tsx
git commit -m "feat: add BottomCTABar component for shared view #106"
```

---

## Task 3: SharedFlowViewer にモーダル + バーを統合

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`
- Modify: `src/features/shared/SharedFlowViewer.module.css`
- Modify: `src/features/shared/SharedFlowPage.test.tsx`

**Step 1: Write the failing tests**

以下のテストを `SharedFlowPage.test.tsx` の最後の `describe` ブロックの後に追加:

```tsx
  // ========================================
  // Teaser modal + Bottom CTA bar
  // ========================================
  describe('Teaser modal and bottom CTA bar', () => {
    it('should show teaser modal on initial load', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

      renderSharedPage()

      await waitFor(() => {
        expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
      })
    })

    it('should apply blur to canvas when modal is shown', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

      renderSharedPage()

      await waitFor(() => {
        expect(screen.getByTestId('shared-flow-canvas')).toHaveClass(/blurred/)
      })
    })

    it('should hide teaser modal and remove blur after CTA click', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

      renderSharedPage()

      await waitFor(() => {
        expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'フロー図を表示する' }))

      expect(screen.queryByTestId('teaser-modal')).not.toBeInTheDocument()
      expect(screen.getByTestId('shared-flow-canvas')).not.toHaveClass(/blurred/)
    })

    it('should show bottom CTA bar 3 seconds after modal close', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

      renderSharedPage()

      await waitFor(() => {
        expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'フロー図を表示する' }))

      expect(screen.queryByTestId('bottom-cta-bar')).not.toBeInTheDocument()

      vi.advanceTimersByTime(3000)

      await waitFor(() => {
        expect(screen.getByTestId('bottom-cta-bar')).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should hide bottom CTA bar when close button is clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

      renderSharedPage()

      await waitFor(() => {
        expect(screen.getByTestId('teaser-modal')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByRole('button', { name: 'フロー図を表示する' }))

      vi.advanceTimersByTime(3000)

      await waitFor(() => {
        expect(screen.getByTestId('bottom-cta-bar')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('bottom-cta-close'))

      expect(screen.queryByTestId('bottom-cta-bar')).not.toBeInTheDocument()

      vi.useRealTimers()
    })

    it('should pass correct lane colors to teaser modal', async () => {
      const multiLaneFlow: Flow = {
        ...mockSharedFlow,
        lanes: [
          { id: 'l1', name: 'Lane A', colorIndex: 0, position: 0 },
          { id: 'l2', name: 'Lane B', colorIndex: 2, position: 1 },
        ],
      }
      mockApiFetch.mockResolvedValueOnce({ flow: multiLaneFlow })

      renderSharedPage()

      await waitFor(() => {
        const dots = screen.getAllByTestId('lane-dot')
        expect(dots).toHaveLength(2)
      })
    })
  })
```

`userEvent` の import が必要:
```tsx
import userEvent from '@testing-library/user-event'
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/shared/SharedFlowPage.test.tsx`
Expected: FAIL (teaser-modal not found, shared-flow-canvas not found, etc.)

**Step 3: Modify SharedFlowViewer.tsx**

SharedFlowViewer.tsx に以下の変更を加える:

1. import追加:
```tsx
import { TeaserModal } from './TeaserModal'
import { BottomCTABar } from './BottomCTABar'
```

2. 状態管理追加（`const [zoom, setZoom] = useState(1)` の後に）:
```tsx
const [showModal, setShowModal] = useState(true)
const [showBottomBar, setShowBottomBar] = useState(false)

const closeModal = () => {
  setShowModal(false)
  setTimeout(() => setShowBottomBar(true), 3000)
}
```

3. canvas div に data-testid と blur制御追加:
```tsx
<div
  ref={containerRef}
  className={`${styles.canvas}${showModal ? ` ${styles.canvasBlurred}` : ''}`}
  data-testid="shared-flow-canvas"
  style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
>
```

4. フッターの後に TeaserModal と BottomCTABar を追加:
```tsx
{showModal && (
  <TeaserModal
    flowTitle={flow.title}
    laneCount={sortedLanes.length}
    nodeCount={flow.nodes.length}
    laneColors={sortedLanes.map((l) => l.colorIndex)}
    onClose={closeModal}
  />
)}
<BottomCTABar visible={showBottomBar} onClose={() => setShowBottomBar(false)} />
```

**Step 4: Modify SharedFlowViewer.module.css**

canvasクラスに transition を追加し、canvasBlurred クラスを新設:

```css
.canvas {
  flex: 1;
  overflow: auto;
  background: var(--theme-canvas-bg);
  background-image: radial-gradient(circle, var(--theme-dot-grid) 0.5px, transparent 0.5px);
  padding: 40px;
  transition: filter 0.4s, opacity 0.4s, transform 0.4s;
  position: relative;
}

.canvasBlurred {
  filter: blur(6px);
  opacity: 0.4;
  transform: scale(1.05);
  overflow: hidden;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/shared/SharedFlowPage.test.tsx`
Expected: ALL PASS

Run: `npm test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.module.css src/features/shared/SharedFlowPage.test.tsx
git commit -m "feat: integrate TeaserModal and BottomCTABar into SharedFlowViewer #106"
```

---

## Task 4: ブラウザ目視確認 + PR作成

**Step 1: Prettier check**

Run: `npx prettier --write src/features/shared/`

**Step 2: Full test run**

Run: `npm test`
Expected: ALL PASS

**Step 3: ブラウザ目視確認**

- dev サーバー起動: `npm run dev`
- 既存の共有URLにアクセスして以下を確認:
  - ティーザーモーダルが表示される（ロゴ・フロー名・レーンドット・CTAボタン）
  - 背景がblur(6px)で表示される
  - 「フロー図を表示する」クリックでモーダルが閉じblurが解除される(0.4s transition)
  - 3秒後にボトムCTAバーがslideUpで表示される
  - ✕ボタンでバーが閉じる
  - 「無料で試す →」が `/?auth=register` にリンクしている

**Step 4: rebase & push & PR**

```bash
git pull origin main --rebase
npm test
git push -u origin feat/shared-teaser-cta
gh pr create --title "feat: 共有ビューにティーザーモーダル + ボトムCTAバーを追加 #106"
```

**Step 5: CI確認 → レビュー依頼**

```bash
gh pr checks --watch
gh pr comment --body '@claude PRをレビューして。結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```
