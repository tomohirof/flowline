import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const sql = readFileSync(resolve(__dirname, '../../migrations/0001_initial.sql'), 'utf-8')
  const statements = sql.split(';').filter((s) => s.trim())
  for (const stmt of statements) {
    db.exec(stmt + ';')
  }
  return db
}

export function createMockD1(sqliteDb: ReturnType<typeof Database>) {
  return {
    prepare(sql: string) {
      let boundParams: unknown[] = []
      const statement = {
        bind(...params: unknown[]) {
          boundParams = params
          return statement
        },
        async first<T>(colName?: string): Promise<T | null> {
          const row = sqliteDb.prepare(sql).get(...boundParams) as
            | Record<string, unknown>
            | undefined
          if (!row) return null
          if (colName) return (row[colName] as T) ?? null
          return row as T
        },
        async run() {
          const result = sqliteDb.prepare(sql).run(...boundParams)
          return { success: true, meta: { changes: result.changes } }
        },
        async all<T>() {
          const results = sqliteDb.prepare(sql).all(...boundParams) as T[]
          return { results, success: true, meta: {} }
        },
      }
      return statement
    },
  }
}
