import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const sql = readFileSync(resolve(__dirname, '../../migrations/0001_initial.sql'), 'utf-8')
  const statements = sql.split(';').filter((s) => s.trim())
  for (const stmt of statements) {
    db.exec(stmt + ';')
  }
  return db
}

describe('D1 Migration', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  it('should create all 5 tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)
    expect(names).toContain('users')
    expect(names).toContain('flows')
    expect(names).toContain('lanes')
    expect(names).toContain('nodes')
    expect(names).toContain('arrows')
  })

  it('should enforce foreign key on flows.user_id', () => {
    expect(() => {
      db.prepare(
        "INSERT INTO flows (id, user_id, title) VALUES ('f_bad', 'nonexistent', 'test')",
      ).run()
    }).toThrow()
  })

  it('should cascade delete lanes when flow is deleted', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'u1@test.com', 'hash', 'User1')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'Lane1', 0)",
    ).run()

    db.prepare("DELETE FROM flows WHERE id = 'f1'").run()
    const lanes = db.prepare("SELECT * FROM lanes WHERE flow_id = 'f1'").all()
    expect(lanes).toHaveLength(0)
  })

  it('should cascade delete nodes when lane is deleted', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'u1@test.com', 'hash', 'User1')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'Lane1', 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f1', 'l1', 0, 0)",
    ).run()

    db.prepare("DELETE FROM lanes WHERE id = 'l1'").run()
    const nodes = db.prepare("SELECT * FROM nodes WHERE lane_id = 'l1'").all()
    expect(nodes).toHaveLength(0)
  })

  it('should cascade delete arrows when node is deleted', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'u1@test.com', 'hash', 'User1')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'Lane1', 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f1', 'l1', 0, 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f1', 'l1', 1, 1)",
    ).run()
    db.prepare(
      "INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f1', 'n1', 'n2')",
    ).run()

    db.prepare("DELETE FROM nodes WHERE id = 'n1'").run()
    const arrows = db.prepare("SELECT * FROM arrows WHERE from_node_id = 'n1'").all()
    expect(arrows).toHaveLength(0)
  })

  it('should enforce unique email', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'dup@test.com', 'hash', 'Test')",
    ).run()
    expect(() => {
      db.prepare(
        "INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 'dup@test.com', 'hash', 'Test2')",
      ).run()
    }).toThrow()
  })

  it('should enforce unique share_token', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'share@test.com', 'hash', 'Test')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id, share_token) VALUES ('f1', 'u1', 'token123')").run()
    expect(() => {
      db.prepare(
        "INSERT INTO flows (id, user_id, share_token) VALUES ('f2', 'u1', 'token123')",
      ).run()
    }).toThrow()
  })

  it('should allow multiple flows with null share_token', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'null@test.com', 'hash', 'Test')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f2', 'u1')").run()
    const flows = db.prepare("SELECT * FROM flows WHERE user_id = 'u1'").all()
    expect(flows).toHaveLength(2)
  })

  it('should have created_at and updated_at on all tables', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'ts@test.com', 'hash', 'Test')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'Lane1', 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f1', 'l1', 0, 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f1', 'l1', 1, 1)",
    ).run()
    db.prepare(
      "INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f1', 'n1', 'n2')",
    ).run()

    const user = db.prepare("SELECT created_at, updated_at FROM users WHERE id = 'u1'").get() as {
      created_at: string
      updated_at: string
    }
    const flow = db.prepare("SELECT created_at, updated_at FROM flows WHERE id = 'f1'").get() as {
      created_at: string
      updated_at: string
    }
    const lane = db.prepare("SELECT created_at, updated_at FROM lanes WHERE id = 'l1'").get() as {
      created_at: string
      updated_at: string
    }
    const node = db.prepare("SELECT created_at, updated_at FROM nodes WHERE id = 'n1'").get() as {
      created_at: string
      updated_at: string
    }
    const arrow = db.prepare("SELECT created_at, updated_at FROM arrows WHERE id = 'a1'").get() as {
      created_at: string
      updated_at: string
    }

    for (const record of [user, flow, lane, node, arrow]) {
      expect(record.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      expect(record.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    }
  })
})
