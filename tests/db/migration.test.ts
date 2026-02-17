import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'

describe('D1 Migration', () => {
  let db: ReturnType<typeof Database>

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const sql = readFileSync(resolve(__dirname, '../../migrations/0001_initial.sql'), 'utf-8')
    // Split by semicolons and execute each statement (SQLite exec doesn't handle PRAGMA well in batch)
    const statements = sql.split(';').filter((s) => s.trim())
    for (const stmt of statements) {
      db.exec(stmt + ';')
    }
  })

  afterAll(() => {
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
    db.prepare("DELETE FROM users WHERE id = 'u1'").run()
  })

  it('should cascade delete nodes when lane is deleted', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 'u2@test.com', 'hash', 'User2')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f2', 'u2')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l2', 'f2', 'Lane2', 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f2', 'l2', 0, 0)",
    ).run()

    db.prepare("DELETE FROM lanes WHERE id = 'l2'").run()
    const nodes = db.prepare("SELECT * FROM nodes WHERE lane_id = 'l2'").all()
    expect(nodes).toHaveLength(0)
    db.prepare("DELETE FROM users WHERE id = 'u2'").run()
  })

  it('should cascade delete arrows when node is deleted', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u3', 'u3@test.com', 'hash', 'User3')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f3', 'u3')").run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l3', 'f3', 'Lane3', 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f3', 'l3', 0, 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n3', 'f3', 'l3', 1, 1)",
    ).run()
    db.prepare(
      "INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f3', 'n2', 'n3')",
    ).run()

    db.prepare("DELETE FROM nodes WHERE id = 'n2'").run()
    const arrows = db.prepare("SELECT * FROM arrows WHERE from_node_id = 'n2'").all()
    expect(arrows).toHaveLength(0)
    db.prepare("DELETE FROM users WHERE id = 'u3'").run()
  })

  it('should enforce unique email', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u4', 'dup@test.com', 'hash', 'Test')",
    ).run()
    expect(() => {
      db.prepare(
        "INSERT INTO users (id, email, password_hash, name) VALUES ('u5', 'dup@test.com', 'hash', 'Test2')",
      ).run()
    }).toThrow()
    db.prepare("DELETE FROM users WHERE id = 'u4'").run()
  })

  it('should enforce unique share_token', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u6', 'share@test.com', 'hash', 'Test')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id, share_token) VALUES ('f4', 'u6', 'token123')").run()
    expect(() => {
      db.prepare(
        "INSERT INTO flows (id, user_id, share_token) VALUES ('f5', 'u6', 'token123')",
      ).run()
    }).toThrow()
    db.prepare("DELETE FROM users WHERE id = 'u6'").run()
  })

  it('should allow multiple flows with null share_token', () => {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u7', 'null@test.com', 'hash', 'Test')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f6', 'u7')").run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f7', 'u7')").run()
    const flows = db.prepare("SELECT * FROM flows WHERE user_id = 'u7'").all()
    expect(flows).toHaveLength(2)
    db.prepare("DELETE FROM users WHERE id = 'u7'").run()
  })
})
