# アカウント設定画面 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ユーザーのプロフィール・エディタ設定・表示設定等を管理する設定画面を新規作成し、バックエンドAPIとDBスキーマも追加する。

**Architecture:** 設定画面は `/settings` ルートで、左サイドバー（6カテゴリ）+右コンテンツのレイアウト。設定データは users テーブルの `settings TEXT` 列にJSON形式で保存。フロントエンドは `useSettings` フックで API と通信し、ページ内 state で設定を管理する。

**Tech Stack:** React 19 + TypeScript + CSS Modules (frontend), Hono + D1/SQLite (backend), Vitest + Testing Library (tests)

---

### Task 1: DBマイグレーション + 設定APIルート

**Files:**

- Create: `migrations/0003_user_settings.sql`
- Create: `api/routes/settings.ts`
- Modify: `api/app.ts`
- Test: `api/routes/settings.test.ts` (create)

**Step 1: Write the migration**

`migrations/0003_user_settings.sql`:

```sql
ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}';
```

**Step 2: Write the failing tests**

`api/routes/settings.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock D1 database
function createMockDB(rows: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(rows[0] ?? null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
  }
}

// Import app after mocks
import { app } from '../app'

function createAuthCookie() {
  // Simulate authenticated request by calling /api/auth/me pattern
  return 'auth_token=test-token'
}

describe('Settings API', () => {
  describe('GET /api/settings', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/settings')
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/settings', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showDotGrid: false }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/settings/profile', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/settings/password', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'newpass123' }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/settings/account', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/settings/account', {
        method: 'DELETE',
      })
      expect(res.status).toBe(401)
    })
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run api/routes/settings.test.ts`
Expected: FAIL (file/routes not found)

**Step 4: Implement settings API route**

`api/routes/settings.ts`:

```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../lib/password'
import type { AuthEnv } from '../app'

const settings = new Hono<AuthEnv>()

// All routes require auth
settings.use('/*', authMiddleware)

const DEFAULT_SETTINGS = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  doubleClickToEdit: true,
  defaultArrowStyle: 'solid',
  defaultArrowColor: 'default',
  showDotGrid: true,
  showOrderBadge: true,
  showLaneColorBar: true,
  defaultTheme: 'cloud',
  language: 'ja',
  notifications: true,
}

// GET /api/settings — 設定取得
settings.get('/', async (c) => {
  const userId = c.get('userId')
  const row = await c.env.FLOWLINE_DB.prepare(
    'SELECT settings, name, email FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ settings: string | null; name: string; email: string }>()

  if (!row) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  const parsed = row.settings ? JSON.parse(row.settings) : {}
  return c.json({
    settings: { ...DEFAULT_SETTINGS, ...parsed },
    profile: { name: row.name, email: row.email },
  })
})

// PUT /api/settings — 設定一括更新
settings.put('/', async (c) => {
  const userId = c.get('userId')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  // Only keep known keys
  const allowed = Object.keys(DEFAULT_SETTINGS)
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      filtered[key] = body[key]
    }
  }

  // Merge with existing
  const existing = await c.env.FLOWLINE_DB.prepare('SELECT settings FROM users WHERE id = ?')
    .bind(userId)
    .first<{ settings: string | null }>()

  const current = existing?.settings ? JSON.parse(existing.settings) : {}
  const merged = { ...current, ...filtered }

  await c.env.FLOWLINE_DB.prepare(
    "UPDATE users SET settings = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(JSON.stringify(merged), userId)
    .run()

  return c.json({ settings: { ...DEFAULT_SETTINGS, ...merged } })
})

// PUT /api/settings/profile — プロフィール更新
settings.put('/profile', async (c) => {
  const userId = c.get('userId')
  let body: { name?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: '名前を入力してください' }, 400)
  }

  await c.env.FLOWLINE_DB.prepare(
    "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(body.name.trim(), userId)
    .run()

  return c.json({ profile: { name: body.name.trim() } })
})

// PUT /api/settings/password — パスワード変更
settings.put('/password', async (c) => {
  const userId = c.get('userId')
  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: 'パスワードを入力してください' }, 400)
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: '新しいパスワードは8文字以上で入力してください' }, 400)
  }

  const user = await c.env.FLOWLINE_DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string }>()

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404)
  }

  const valid = await verifyPassword(body.currentPassword, user.password_hash)
  if (!valid) {
    return c.json({ error: '現在のパスワードが正しくありません' }, 400)
  }

  const newHash = await hashPassword(body.newPassword)
  await c.env.FLOWLINE_DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(newHash, userId)
    .run()

  return c.json({ message: 'パスワードを変更しました' })
})

// DELETE /api/settings/account — アカウント削除
settings.delete('/account', async (c) => {
  const userId = c.get('userId')

  // Delete user's flows and related data
  const userFlows = await c.env.FLOWLINE_DB.prepare('SELECT id FROM flows WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string }>()

  if (userFlows.results.length > 0) {
    const flowIds = userFlows.results.map((f) => f.id)
    for (const flowId of flowIds) {
      await c.env.FLOWLINE_DB.prepare('DELETE FROM arrows WHERE flow_id = ?').bind(flowId).run()
      await c.env.FLOWLINE_DB.prepare('DELETE FROM nodes WHERE flow_id = ?').bind(flowId).run()
      await c.env.FLOWLINE_DB.prepare('DELETE FROM lanes WHERE flow_id = ?').bind(flowId).run()
    }
    await c.env.FLOWLINE_DB.prepare('DELETE FROM flows WHERE user_id = ?').bind(userId).run()
  }

  await c.env.FLOWLINE_DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  return c.json({ message: 'アカウントを削除しました' })
})

export { settings }
```

**Step 5: Register route in app.ts**

`api/app.ts` に追加:

```typescript
import { settings } from './routes/settings'
// ... existing routes ...
app.route('/settings', settings)
```

**Step 6: Run tests**

Run: `npx vitest run`
Expected: All tests PASS (既存 + 新規設定APIテスト)

**Step 7: Commit**

```bash
git add migrations/0003_user_settings.sql api/routes/settings.ts api/app.ts api/routes/settings.test.ts
git commit -m "feat: 設定API + DBマイグレーション追加 #71"
```

---

### Task 2: Toggle / Tag / Section / SettingRow 共通コンポーネント

**Files:**

- Create: `src/features/settings/components/Toggle.tsx`
- Create: `src/features/settings/components/Toggle.module.css`
- Create: `src/features/settings/components/Tag.tsx`
- Create: `src/features/settings/components/Tag.module.css`
- Create: `src/features/settings/components/SettingRow.tsx`
- Create: `src/features/settings/components/SettingRow.module.css`
- Create: `src/features/settings/components/Section.tsx`
- Create: `src/features/settings/components/Section.module.css`
- Test: `src/features/settings/components/Toggle.test.tsx`
- Test: `src/features/settings/components/Tag.test.tsx`
- Test: `src/features/settings/components/SettingRow.test.tsx`
- Test: `src/features/settings/components/Section.test.tsx`

**Step 1: Write failing tests for Toggle**

`src/features/settings/components/Toggle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('should render with checked state', () => {
    render(<Toggle checked={true} onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('should render with unchecked state', () => {
    render(<Toggle checked={false} onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onChange when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Write failing tests for Tag**

`src/features/settings/components/Tag.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tag } from './Tag'

describe('Tag', () => {
  it('should render label text', () => {
    render(<Tag label="Cloud" active={false} onClick={vi.fn()} />)
    expect(screen.getByText('Cloud')).toBeInTheDocument()
  })

  it('should apply active style when active', () => {
    render(<Tag label="Cloud" active={true} onClick={vi.fn()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Tag label="Cloud" active={false} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

**Step 3: Write failing tests for Section and SettingRow**

`src/features/settings/components/Section.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from './Section'

describe('Section', () => {
  it('should render title', () => {
    render(<Section title="ノード作成">child</Section>)
    expect(screen.getByText('ノード作成')).toBeInTheDocument()
  })

  it('should render description when provided', () => {
    render(
      <Section title="ノード作成" desc="説明文">
        child
      </Section>,
    )
    expect(screen.getByText('説明文')).toBeInTheDocument()
  })

  it('should render children', () => {
    render(
      <Section title="テスト">
        <span data-testid="child">子要素</span>
      </Section>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
```

`src/features/settings/components/SettingRow.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingRow } from './SettingRow'

describe('SettingRow', () => {
  it('should render label', () => {
    render(
      <SettingRow label="自動接続">
        <span>control</span>
      </SettingRow>,
    )
    expect(screen.getByText('自動接続')).toBeInTheDocument()
  })

  it('should render description when provided', () => {
    render(
      <SettingRow label="自動接続" desc="説明">
        <span>control</span>
      </SettingRow>,
    )
    expect(screen.getByText('説明')).toBeInTheDocument()
  })

  it('should render children as control area', () => {
    render(
      <SettingRow label="自動接続">
        <span data-testid="ctrl">toggle</span>
      </SettingRow>,
    )
    expect(screen.getByTestId('ctrl')).toBeInTheDocument()
  })
})
```

**Step 4: Implement all 4 components**

`src/features/settings/components/Toggle.tsx`:

```tsx
import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: () => void
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`${styles.track} ${checked ? styles.trackOn : ''}`}
    >
      <span className={`${styles.thumb} ${checked ? styles.thumbOn : ''}`} />
    </button>
  )
}
```

`src/features/settings/components/Toggle.module.css`:

```css
.track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  background: #e0e0e8;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s;
  padding: 0;
}
.trackOn {
  background: #7c5cfc;
}
.thumb {
  width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: left 0.2s;
}
.thumbOn {
  left: 20px;
}
```

`src/features/settings/components/Tag.tsx`:

```tsx
import styles from './Tag.module.css'

interface TagProps {
  label: string
  active: boolean
  onClick: () => void
}

export function Tag({ label, active, onClick }: TagProps) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`${styles.tag} ${active ? styles.active : ''}`}
    >
      {label}
    </button>
  )
}
```

`src/features/settings/components/Tag.module.css`:

```css
.tag {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #e0e0e8;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #888;
  font-family: inherit;
  transition: all 0.15s;
}
.active {
  border: 1.5px solid #7c5cfc;
  background: #f5f0ff;
  font-weight: 700;
  color: #7c5cfc;
}
```

`src/features/settings/components/Section.tsx`:

```tsx
import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface SectionProps {
  title: string
  desc?: string
  children: ReactNode
}

export function Section({ title, desc, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.title}>{title}</h3>
      {desc && <p className={styles.desc}>{desc}</p>}
      {!desc && <div className={styles.spacer} />}
      <div className={styles.content}>{children}</div>
    </div>
  )
}
```

`src/features/settings/components/Section.module.css`:

```css
.section {
  margin-bottom: 32px;
}
.title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}
.desc {
  font-size: 12px;
  color: #999;
  margin: 0 0 16px;
  line-height: 1.5;
}
.spacer {
  height: 12px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

`src/features/settings/components/SettingRow.tsx`:

```tsx
import type { ReactNode } from 'react'
import styles from './SettingRow.module.css'

interface SettingRowProps {
  label: string
  desc?: string
  children: ReactNode
}

export function SettingRow({ label, desc, children }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        {desc && <div className={styles.desc}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}
```

`src/features/settings/components/SettingRow.module.css`:

```css
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  transition: background 0.1s;
}
.row:hover {
  background: #fafafd;
}
.info {
  flex: 1;
  min-width: 0;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.desc {
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
  line-height: 1.4;
}
```

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/features/settings/components/
git commit -m "feat: Toggle/Tag/Section/SettingRow 共通コンポーネント追加 #71"
```

---

### Task 3: 6カテゴリのセクションコンポーネント

**Files:**

- Create: `src/features/settings/sections/ProfileSection.tsx`
- Create: `src/features/settings/sections/EditorSection.tsx`
- Create: `src/features/settings/sections/InteractionSection.tsx`
- Create: `src/features/settings/sections/DisplaySection.tsx`
- Create: `src/features/settings/sections/NotificationSection.tsx`
- Create: `src/features/settings/sections/SecuritySection.tsx`
- Create: `src/features/settings/sections/SecuritySection.module.css`
- Create: `src/features/settings/sections/ProfileSection.module.css`
- Test: `src/features/settings/sections/EditorSection.test.tsx`

**Step 1: Write failing test for EditorSection (representative)**

`src/features/settings/sections/EditorSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorSection } from './EditorSection'

const defaultSettings = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  defaultArrowStyle: 'solid' as const,
  defaultTheme: 'cloud' as const,
}

describe('EditorSection', () => {
  it('should render all editor setting rows', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('同じ行にノード作成時、テキストをコピー')).toBeInTheDocument()
    expect(screen.getByText('自動接続')).toBeInTheDocument()
    expect(screen.getByText('最終行で自動行追加')).toBeInTheDocument()
    expect(screen.getByText('作成後すぐに編集')).toBeInTheDocument()
  })

  it('should render arrow style tags', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('実線')).toBeInTheDocument()
    expect(screen.getByText('破線')).toBeInTheDocument()
    expect(screen.getByText('点線')).toBeInTheDocument()
  })

  it('should render theme tags', () => {
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={vi.fn()} />)
    expect(screen.getByText('Cloud')).toBeInTheDocument()
    expect(screen.getByText('Midnight')).toBeInTheDocument()
    expect(screen.getByText('Blueprint')).toBeInTheDocument()
  })

  it('should call onToggle when toggle is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<EditorSection settings={defaultSettings} onToggle={onToggle} onSet={vi.fn()} />)
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    expect(onToggle).toHaveBeenCalledWith('copyLabelOnSameRow')
  })

  it('should call onSet when tag is clicked', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn()
    render(<EditorSection settings={defaultSettings} onToggle={vi.fn()} onSet={onSet} />)
    await user.click(screen.getByText('破線'))
    expect(onSet).toHaveBeenCalledWith('defaultArrowStyle', 'dashed')
  })
})
```

**Step 2: Implement all 6 section components**

各セクションは `settings` オブジェクトと `onToggle(key)` / `onSet(key, value)` コールバックを props で受け取る。参考デザイン `flowline-settings.jsx` の renderContent() 各 case をそのまま React コンポーネント化する。

- `ProfileSection` — アバター表示、名前・メール入力フィールド。props: `name, email, onNameChange, onEmailChange`
- `EditorSection` — 4トグル + 矢印スタイルTag + テーマTag
- `InteractionSection` — 3トグル（ダブルクリック、undo、delete）
- `DisplaySection` — 3トグル（ドットグリッド、バッジ、カラーバー）
- `NotificationSection` — 2トグル（メール、ブラウザ）
- `SecuritySection` — パスワード変更フォーム + 危険ゾーン

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/features/settings/sections/
git commit -m "feat: 6カテゴリのセクションコンポーネント追加 #71"
```

---

### Task 4: SettingsPage メインページ + ルーティング

**Files:**

- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/SettingsPage.module.css`
- Modify: `src/App.tsx` — `/settings` ルート追加、Header非表示追加
- Test: `src/features/settings/SettingsPage.test.tsx`

**Step 1: Write failing tests**

`src/features/settings/SettingsPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { MemoryRouter } from 'react-router-dom'

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com', name: 'テスト' },
    logout: vi.fn(),
  }),
}))

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    settings: {
      copyLabelOnSameRow: false,
      autoConnect: true,
      autoAddRow: true,
      enterEditOnCreate: true,
      doubleClickToEdit: true,
      defaultArrowStyle: 'solid',
      defaultArrowColor: 'default',
      showDotGrid: true,
      showOrderBadge: true,
      showLaneColorBar: true,
      defaultTheme: 'cloud',
      language: 'ja',
      notifications: true,
    },
    profile: { name: 'テスト', email: 'test@example.com' },
  }),
}))

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    cleanup()
  })

  it('should render settings page with sidebar navigation', async () => {
    renderSettings()
    expect(await screen.findByText('設定')).toBeInTheDocument()
    expect(screen.getByText('プロフィール')).toBeInTheDocument()
    expect(screen.getByText('エディタ')).toBeInTheDocument()
    expect(screen.getByText('操作')).toBeInTheDocument()
    expect(screen.getByText('表示')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('セキュリティ')).toBeInTheDocument()
  })

  it('should show profile section by default', async () => {
    renderSettings()
    expect(await screen.findByText('プロフィール')).toBeInTheDocument()
  })

  it('should switch to editor section when nav clicked', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByText('設定')
    await user.click(screen.getByTestId('nav-editor'))
    expect(screen.getByText('ノード作成')).toBeInTheDocument()
  })

  it('should have save button', async () => {
    renderSettings()
    expect(await screen.findByText('保存する')).toBeInTheDocument()
  })

  it('should have back button', async () => {
    renderSettings()
    expect(await screen.findByTestId('settings-back')).toBeInTheDocument()
  })
})
```

**Step 2: Implement SettingsPage**

レイアウト構成:

- トップバー: ←戻る + F + "設定" + 保存ボタン
- ボディ: 左ナビ(200px) + 右コンテンツ
- 6カテゴリのナビゲーション、クリックで右側コンテンツ切替
- `useEffect` で `/api/settings` GET してstate初期化
- 保存ボタンクリックで `/api/settings` PUT
- 保存成功で「✓ 保存済み」ポップ表示（2秒後自動消去）

**Step 3: Add route in App.tsx**

`src/App.tsx` に追加:

```tsx
import { SettingsPage } from './features/settings/SettingsPage'

// Header非表示条件に追加
location.pathname === '/settings' || (
  // Routes内に追加
  <Route
    path="/settings"
    element={
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    }
  />
)
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.module.css src/features/settings/SettingsPage.test.tsx src/App.tsx
git commit -m "feat: 設定ページ + /settings ルーティング追加 #71"
```

---

### Task 5: UserMenuPanel にナビゲーションリンク追加

**Files:**

- Modify: `src/components/UserMenuPanel.tsx` — メニュー項目に onClick ハンドラ追加
- Modify: `src/components/UserMenuPanel.test.tsx` — ナビゲーションテスト追加

**Step 1: Write failing test**

```tsx
it('should navigate to settings when プロフィール設定 is clicked', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <UserMenuPanel {...defaultProps} />
    </MemoryRouter>,
  )
  await user.click(screen.getByText('プロフィール設定'))
  // Verify navigation happened (check MemoryRouter location)
})

it('should navigate to settings when アカウント設定 is clicked', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <UserMenuPanel {...defaultProps} />
    </MemoryRouter>,
  )
  await user.click(screen.getByText('アカウント設定'))
})
```

**Step 2: Add useNavigate to UserMenuPanel**

「プロフィール設定」→ `/settings` (profile タブ)
「アカウント設定」→ `/settings` (profile タブ)
「プランと請求」→ `/settings` (security タブ予定、今は遷移のみ)

menuItems に `path` フィールドを追加し、クリック時に `navigate(path)` + `onClose()` を実行。

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/components/UserMenuPanel.tsx src/components/UserMenuPanel.test.tsx
git commit -m "feat: UserMenuPanel に設定画面へのナビゲーション追加 #71"
```

---

### Task 6: ブラウザ目視確認

**Step 1: Viteデバサーバー起動**

```bash
npx vite --port 5174
```

**Step 2: Playwright スクリプトで設定画面を確認**

確認事項:

- ダッシュボードからアバタークリック → メニューの「プロフィール設定」クリック → `/settings` に遷移
- 設定画面のレイアウト（トップバー、サイドバー、コンテンツ）
- 6カテゴリの切替
- トグルの動作
- Tagの排他選択
- 「保存する」ボタンクリック → 「✓ 保存済み」ポップ
- ← 戻るボタンで `/flows` に戻る

**Step 3: スクリーンショット撮影**

各カテゴリのスクリーンショットを撮影して目視確認。

---

### Task 7: PR作成・CI確認・レビューループ

**Step 1: rebase & test**

```bash
git pull origin main --rebase
npx vitest run
npm run lint
```

**Step 2: push & PR作成**

```bash
git push -u origin feat-settings-page
gh pr create --title "feat: アカウント設定画面の新規作成 #71"
```

**Step 3: CI確認**

```bash
gh pr checks --watch
```

**Step 4: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

**Step 5: レビュー結果に応じて修正ループ**
