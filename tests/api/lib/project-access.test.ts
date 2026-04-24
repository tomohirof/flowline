import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'
import { getProjectRole, canAccessFlow } from '../../../api/lib/project-access'

describe('getProjectRole', () => {
  let db: ReturnType<typeof Database>
  let d1: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createTestDb()
    d1 = createMockD1(db)
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES
       ('owner-1', 'owner@example.com', 'h', 'Owner'),
       ('editor-1', 'editor@example.com', 'h', 'Editor'),
       ('stranger-1', 'stranger@example.com', 'h', 'Stranger')`,
    ).run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('proj-1', 'owner-1', 'P1')`).run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('proj-1', 'editor-1', 'editor')`,
    ).run()
  })
  afterEach(() => db.close())

  it('returns "owner" for the project owner', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'owner-1')).toBe('owner')
  })
  it('returns "editor" for an added member', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'editor-1')).toBe('editor')
  })
  it('returns null for non-members', async () => {
    expect(await getProjectRole(d1, 'proj-1', 'stranger-1')).toBeNull()
  })
  it('returns null for non-existent project', async () => {
    expect(await getProjectRole(d1, 'proj-none', 'owner-1')).toBeNull()
  })
})

describe('canAccessFlow', () => {
  let db: ReturnType<typeof Database>
  let d1: ReturnType<typeof createMockD1>

  beforeEach(() => {
    db = createTestDb()
    d1 = createMockD1(db)
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES
       ('owner-1', 'owner@example.com', 'h', 'Owner'),
       ('editor-1', 'editor@example.com', 'h', 'Editor'),
       ('stranger-1', 'stranger@example.com', 'h', 'Stranger')`,
    ).run()
    db.prepare(`INSERT INTO projects (id, user_id, name) VALUES ('proj-1', 'owner-1', 'P1')`).run()
    db.prepare(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ('proj-1', 'editor-1', 'editor')`,
    ).run()
    db.prepare(
      `INSERT INTO flows (id, user_id, title, project_id) VALUES ('flow-1', 'owner-1', 'F1', 'proj-1')`,
    ).run()
    db.prepare(`INSERT INTO flows (id, user_id, title) VALUES ('flow-2', 'owner-1', 'F2')`).run()
    db.prepare(
      `INSERT INTO flows (id, user_id, title, project_id, deleted_at) VALUES ('flow-3', 'owner-1', 'F3', 'proj-1', '2026-01-01T00:00:00Z')`,
    ).run()
  })
  afterEach(() => db.close())

  it('grants full access to the flow owner', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'owner-1')).toEqual({ canEdit: true, canDelete: true })
  })
  it('grants edit access but not delete access to project editors', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'editor-1')).toEqual({
      canEdit: true,
      canDelete: false,
    })
  })
  it('denies access to strangers', async () => {
    expect(await canAccessFlow(d1, 'flow-1', 'stranger-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
  it('treats flows without project_id as owner-only', async () => {
    expect(await canAccessFlow(d1, 'flow-2', 'editor-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
    expect(await canAccessFlow(d1, 'flow-2', 'owner-1')).toEqual({ canEdit: true, canDelete: true })
  })
  it('treats soft-deleted flows as not accessible', async () => {
    expect(await canAccessFlow(d1, 'flow-3', 'owner-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
    expect(await canAccessFlow(d1, 'flow-3', 'editor-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
  it('returns no access for non-existent flow', async () => {
    expect(await canAccessFlow(d1, 'flow-none', 'owner-1')).toEqual({
      canEdit: false,
      canDelete: false,
    })
  })
})
