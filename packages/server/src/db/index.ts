import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORE_DIR, ensureStore } from '../config.js'
import { migrateDb } from './migrate.js'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    ensureStore()
    const dbPath = join(STORE_DIR, 'agentic.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    const schema = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf-8')
    db.exec(schema)
    migrateDb(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
