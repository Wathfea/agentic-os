import type Database from 'better-sqlite3'

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

export function migrateDb(db: Database.Database): void {
  if (!columnExists(db, 'projects', 'rebuild_interval_hours')) {
    db.exec('ALTER TABLE projects ADD COLUMN rebuild_interval_hours INTEGER')
  }
  if (!columnExists(db, 'projects', 'last_scheduled_at')) {
    db.exec('ALTER TABLE projects ADD COLUMN last_scheduled_at TEXT')
  }
  if (!columnExists(db, 'projects', 'total_tokens_saved')) {
    db.exec('ALTER TABLE projects ADD COLUMN total_tokens_saved INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'projects', 'total_tokens_used')) {
    db.exec('ALTER TABLE projects ADD COLUMN total_tokens_used INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'projects', 'total_cost_saved_usd')) {
    db.exec('ALTER TABLE projects ADD COLUMN total_cost_saved_usd REAL NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'projects', 'total_cost_used_usd')) {
    db.exec('ALTER TABLE projects ADD COLUMN total_cost_used_usd REAL NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'graph_jobs', 'llm_used')) {
    db.exec('ALTER TABLE graph_jobs ADD COLUMN llm_used INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'graph_jobs', 'tokens_used')) {
    db.exec('ALTER TABLE graph_jobs ADD COLUMN tokens_used INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'graph_jobs', 'tokens_saved')) {
    db.exec('ALTER TABLE graph_jobs ADD COLUMN tokens_saved INTEGER NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'graph_jobs', 'cost_usd')) {
    db.exec('ALTER TABLE graph_jobs ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'graph_jobs', 'cost_saved_usd')) {
    db.exec('ALTER TABLE graph_jobs ADD COLUMN cost_saved_usd REAL NOT NULL DEFAULT 0')
  }
  if (!columnExists(db, 'projects', 'source_type')) {
    db.exec("ALTER TABLE projects ADD COLUMN source_type TEXT NOT NULL DEFAULT 'local'")
  }
  if (!columnExists(db, 'projects', 'github_url')) {
    db.exec('ALTER TABLE projects ADD COLUMN github_url TEXT')
  }
  if (!columnExists(db, 'projects', 'github_branch')) {
    db.exec('ALTER TABLE projects ADD COLUMN github_branch TEXT')
  }
  if (!columnExists(db, 'briefing_cache', 'calendar_json')) {
    db.exec("ALTER TABLE briefing_cache ADD COLUMN calendar_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!columnExists(db, 'mix_sources', 'seeded')) {
    db.exec('ALTER TABLE mix_sources ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0')
  }
}
