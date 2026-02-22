import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const migrationFiles = ['0001_initial.sql', '0002_node_arrow_styles.sql']
  for (const file of migrationFiles) {
    const sql = readFileSync(resolve(__dirname, '../../migrations/', file), 'utf-8')
    const statements = sql.split(';').filter((s) => s.trim())
    for (const stmt of statements) {
      db.exec(stmt + ';')
    }
  }
  return db
}

interface MockStatement {
  _sql: string
  _params: unknown[]
  bind(...params: unknown[]): MockStatement
  first<T>(colName?: string): Promise<T | null>
  run(): Promise<{ success: boolean; meta: { changes: number } }>
  all<T>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>
}

export function createMockD1(sqliteDb: ReturnType<typeof Database>) {
  return {
    prepare(sql: string): MockStatement {
      let boundParams: unknown[] = []
      const statement: MockStatement = {
        _sql: sql,
        _params: boundParams,
        bind(...params: unknown[]) {
          boundParams = params
          statement._params = params
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
    async batch(preparedStatements: MockStatement[]) {
      const results: unknown[] = []
      const fn = sqliteDb.transaction(() => {
        for (const stmt of preparedStatements) {
          const s = sqliteDb.prepare(stmt._sql)
          // SELECT文かどうかで処理を分ける
          const sqlUpper = stmt._sql.trim().toUpperCase()
          if (sqlUpper.startsWith('SELECT')) {
            const rows = s.all(...stmt._params)
            results.push({ results: rows, success: true, meta: {} })
          } else {
            const r = s.run(...stmt._params)
            results.push({ success: true, meta: { changes: r.changes } })
          }
        }
      })
      fn()
      return results
    },
  }
}
