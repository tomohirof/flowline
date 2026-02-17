# D1データベース設計とマイグレーション 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** D1データベースのスキーマを定義し、マイグレーションを適用可能な状態にする

**Architecture:** Cloudflare D1（SQLiteベース）に5テーブル（users, flows, lanes, nodes, arrows）を作成。外部キー制約とCASCADE DELETEで整合性を保証。

**Tech Stack:** Cloudflare D1, wrangler CLI, Vitest

---

### Task 1: マイグレーションSQL作成

**Files:**
- Create: `migrations/0001_initial.sql`

**Step 1: マイグレーションファイル作成**

Create `migrations/0001_initial.sql`:
```sql
-- Enable foreign keys (D1/SQLite requires explicit enable)
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Flows table
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '無題のフロー',
  theme_id TEXT NOT NULL DEFAULT 'cloud',
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Lanes table
CREATE TABLE IF NOT EXISTS lanes (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);

-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  lane_id TEXT NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '作業',
  note TEXT,
  order_index INTEGER NOT NULL
);

-- Arrows table
CREATE TABLE IF NOT EXISTS arrows (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  comment TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_share_token ON flows(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lanes_flow_id ON lanes(flow_id);
CREATE INDEX IF NOT EXISTS idx_nodes_flow_id ON nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_nodes_lane_id ON nodes(lane_id);
CREATE INDEX IF NOT EXISTS idx_arrows_flow_id ON arrows(flow_id);
```

**Step 2: Commit**

```bash
git add migrations/0001_initial.sql
git commit -m "feat: add D1 database migration for initial schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: マイグレーションテスト

**Files:**
- Create: `tests/db/migration.test.ts`

**Step 1: テスト作成**

Create `tests/db/migration.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'

describe('D1 Migration', () => {
  let db: ReturnType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const sql = readFileSync(resolve(__dirname, '../../migrations/0001_initial.sql'), 'utf-8')
    db.exec(sql)
  })

  it('should create users table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all()
    expect(tables).toHaveLength(1)
  })

  it('should create flows table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='flows'").all()
    expect(tables).toHaveLength(1)
  })

  it('should create lanes table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lanes'").all()
    expect(tables).toHaveLength(1)
  })

  it('should create nodes table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'").all()
    expect(tables).toHaveLength(1)
  })

  it('should create arrows table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='arrows'").all()
    expect(tables).toHaveLength(1)
  })

  it('should enforce foreign key on flows.user_id', () => {
    expect(() => {
      db.prepare("INSERT INTO flows (id, user_id, title) VALUES ('f1', 'nonexistent', 'test')").run()
    }).toThrow()
  })

  it('should cascade delete lanes when flow is deleted', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'test@test.com', 'hash', 'Test')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare("INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'Lane1', 0)").run()

    db.prepare("DELETE FROM flows WHERE id = 'f1'").run()

    const lanes = db.prepare("SELECT * FROM lanes WHERE flow_id = 'f1'").all()
    expect(lanes).toHaveLength(0)

    // Cleanup
    db.prepare("DELETE FROM users WHERE id = 'u1'").run()
  })

  it('should cascade delete nodes when lane is deleted', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 'test2@test.com', 'hash', 'Test2')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f2', 'u2')").run()
    db.prepare("INSERT INTO lanes (id, flow_id, name, position) VALUES ('l2', 'f2', 'Lane2', 0)").run()
    db.prepare("INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f2', 'l2', 0, 0)").run()

    db.prepare("DELETE FROM lanes WHERE id = 'l2'").run()

    const nodes = db.prepare("SELECT * FROM nodes WHERE lane_id = 'l2'").all()
    expect(nodes).toHaveLength(0)

    // Cleanup
    db.prepare("DELETE FROM users WHERE id = 'u2'").run()
  })

  it('should cascade delete arrows when node is deleted', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u3', 'test3@test.com', 'hash', 'Test3')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f3', 'u3')").run()
    db.prepare("INSERT INTO lanes (id, flow_id, name, position) VALUES ('l3', 'f3', 'Lane3', 0)").run()
    db.prepare("INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f3', 'l3', 0, 0)").run()
    db.prepare("INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n3', 'f3', 'l3', 1, 1)").run()
    db.prepare("INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f3', 'n2', 'n3')").run()

    db.prepare("DELETE FROM nodes WHERE id = 'n2'").run()

    const arrows = db.prepare("SELECT * FROM arrows WHERE from_node_id = 'n2'").all()
    expect(arrows).toHaveLength(0)

    // Cleanup
    db.prepare("DELETE FROM users WHERE id = 'u3'").run()
  })

  it('should enforce unique email', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u4', 'dup@test.com', 'hash', 'Test')").run()
    expect(() => {
      db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u5', 'dup@test.com', 'hash', 'Test2')").run()
    }).toThrow()
    db.prepare("DELETE FROM users WHERE id = 'u4'").run()
  })

  it('should enforce unique share_token', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u6', 'share@test.com', 'hash', 'Test')").run()
    db.prepare("INSERT INTO flows (id, user_id, share_token) VALUES ('f4', 'u6', 'token123')").run()
    expect(() => {
      db.prepare("INSERT INTO flows (id, user_id, share_token) VALUES ('f5', 'u6', 'token123')").run()
    }).toThrow()
    db.prepare("DELETE FROM users WHERE id = 'u6'").run()
  })

  it('should allow null share_token', () => {
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u7', 'null@test.com', 'hash', 'Test')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f6', 'u7')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f7', 'u7')").run()
    const flows = db.prepare("SELECT * FROM flows WHERE user_id = 'u7'").all()
    expect(flows).toHaveLength(2)
    db.prepare("DELETE FROM users WHERE id = 'u7'").run()
  })
})
```

**Step 2: better-sqlite3をインストール**

```bash
npm install -D better-sqlite3 @types/better-sqlite3
```

**Step 3: テスト実行**

```bash
npm test
```
Expected: 全テストPASS

**Step 4: Commit**

```bash
git add tests/db/migration.test.ts package.json package-lock.json
git commit -m "test: add D1 migration tests with better-sqlite3

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: 最終確認

**Step 1: 全テスト + lint + build**

```bash
npm test
npm run lint
npm run build
```

**Step 2: push**

```bash
git push origin <branch>
```

---

## 完了条件チェックリスト

- [ ] `migrations/0001_initial.sql` が作成されている
- [ ] 5テーブル（users, flows, lanes, nodes, arrows）が定義されている
- [ ] 外部キー制約とCASCADE DELETEが設定されている
- [ ] インデックスが作成されている
- [ ] テストが全て通る
- [ ] `npm run lint` でエラーなし
