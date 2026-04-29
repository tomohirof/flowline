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

  it('should create invitation_codes table (0009)', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const files = [
      '0001_initial.sql',
      '0002_node_arrow_styles.sql',
      '0003_user_settings.sql',
      '0004_email_verification.sql',
      '0005_soft_delete.sql',
      '0006_ai_admin.sql',
      '0007_node_shape.sql',
      '0008_projects.sql',
      '0009_invitation_codes.sql',
    ]
    for (const f of files) {
      const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
      for (const stmt of sql.split(';').filter((s) => s.trim())) {
        db.exec(stmt + ';')
      }
    }
    const cols = db.prepare('PRAGMA table_info(invitation_codes)').all() as Array<{
      name: string
      type: string
    }>
    const names = cols.map((c) => c.name).sort()
    expect(names).toEqual(['code', 'created_at', 'created_by', 'expires_at', 'id', 'revoked_at'])
    db.close()
  })

  it('should create project_members table and projects.invite_token column (0010)', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const files = [
      '0001_initial.sql',
      '0002_node_arrow_styles.sql',
      '0003_user_settings.sql',
      '0004_email_verification.sql',
      '0005_soft_delete.sql',
      '0006_ai_admin.sql',
      '0007_node_shape.sql',
      '0008_projects.sql',
      '0009_invitation_codes.sql',
      '0010_project_members.sql',
    ]
    for (const f of files) {
      const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
      for (const stmt of sql.split(';').filter((s) => s.trim())) {
        db.exec(stmt + ';')
      }
    }
    const memberCols = db.prepare('PRAGMA table_info(project_members)').all() as Array<{
      name: string
    }>
    expect(memberCols.map((c) => c.name).sort()).toEqual([
      'joined_at',
      'project_id',
      'role',
      'user_id',
    ])
    const projectCols = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
    expect(projectCols.map((c) => c.name)).toContain('invite_token')
    db.close()
  })

  it('should add bidirectional column to arrows (0011)', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const files = [
      '0001_initial.sql',
      '0002_node_arrow_styles.sql',
      '0003_user_settings.sql',
      '0004_email_verification.sql',
      '0005_soft_delete.sql',
      '0006_ai_admin.sql',
      '0007_node_shape.sql',
      '0008_projects.sql',
      '0009_invitation_codes.sql',
      '0010_project_members.sql',
      '0011_arrow_bidirectional.sql',
    ]
    for (const f of files) {
      const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
      for (const stmt of sql.split(';').filter((s) => s.trim())) {
        db.exec(stmt + ';')
      }
    }
    const cols = db.prepare('PRAGMA table_info(arrows)').all() as Array<{
      name: string
      dflt_value: string | null
    }>
    const bidir = cols.find((c) => c.name === 'bidirectional')
    expect(bidir).toBeDefined()
    expect(bidir?.dflt_value).toBe('0')

    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'u1@test.com', 'h', 'U')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()
    db.prepare("INSERT INTO lanes (id, flow_id, name, position) VALUES ('l1', 'f1', 'L', 0)").run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n1', 'f1', 'l1', 0, 0)",
    ).run()
    db.prepare(
      "INSERT INTO nodes (id, flow_id, lane_id, row_index, order_index) VALUES ('n2', 'f1', 'l1', 1, 1)",
    ).run()
    db.prepare(
      "INSERT INTO arrows (id, flow_id, from_node_id, to_node_id) VALUES ('a1', 'f1', 'n1', 'n2')",
    ).run()
    const row = db.prepare("SELECT bidirectional FROM arrows WHERE id = 'a1'").get() as {
      bidirectional: number
    }
    expect(row.bidirectional).toBe(0)
    db.close()
  })

  it('should add group_id and group_role to lanes (0012)', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const files = [
      '0001_initial.sql',
      '0002_node_arrow_styles.sql',
      '0003_user_settings.sql',
      '0004_email_verification.sql',
      '0005_soft_delete.sql',
      '0006_ai_admin.sql',
      '0007_node_shape.sql',
      '0008_projects.sql',
      '0009_invitation_codes.sql',
      '0010_project_members.sql',
      '0011_arrow_bidirectional.sql',
      '0012_lane_groups.sql',
    ]
    for (const f of files) {
      const sql = readFileSync(resolve(__dirname, '../../migrations/', f), 'utf-8')
      for (const stmt of sql.split(';').filter((s) => s.trim())) {
        db.exec(stmt + ';')
      }
    }
    const cols = db.prepare('PRAGMA table_info(lanes)').all() as Array<{
      name: string
      type: string
      notnull: number
    }>
    const groupId = cols.find((c) => c.name === 'group_id')
    const groupRole = cols.find((c) => c.name === 'group_role')
    expect(groupId).toBeDefined()
    expect(groupId?.type).toBe('TEXT')
    expect(groupId?.notnull).toBe(0)
    expect(groupRole).toBeDefined()
    expect(groupRole?.type).toBe('TEXT')
    expect(groupRole?.notnull).toBe(0)

    db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 'g@test.com', 'h', 'U')",
    ).run()
    db.prepare("INSERT INTO flows (id, user_id) VALUES ('f1', 'u1')").run()

    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l1', 'f1', 'L1', 0, 'g1', 'parent')",
    ).run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l2', 'f1', 'L2', 1, 'g1', 'sub')",
    ).run()
    db.prepare(
      "INSERT INTO lanes (id, flow_id, name, position) VALUES ('l3', 'f1', 'L3', 2)",
    ).run()

    // CHECK does not fire on NULL — explicit verification
    expect(() =>
      db
        .prepare(
          "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l4', 'f1', 'L4', 4, 'g3', NULL)",
        )
        .run(),
    ).not.toThrow()

    expect(() =>
      db
        .prepare(
          "INSERT INTO lanes (id, flow_id, name, position, group_id, group_role) VALUES ('l_bad', 'f1', 'Bad', 5, 'g2', 'invalid')",
        )
        .run(),
    ).toThrow()

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'lanes'")
      .all() as Array<{ name: string }>
    expect(indexes.map((i) => i.name)).toContain('idx_lanes_group_id')

    db.close()
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
