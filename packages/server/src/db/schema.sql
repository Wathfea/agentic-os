CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  alias TEXT NOT NULL UNIQUE,
  graph_status TEXT NOT NULL DEFAULT 'pending',
  graph_node_count INTEGER NOT NULL DEFAULT 0,
  last_built_at TEXT,
  hooks_installed INTEGER NOT NULL DEFAULT 0,
  auto_rebuild INTEGER NOT NULL DEFAULT 1,
  rebuild_interval_hours INTEGER,
  last_scheduled_at TEXT,
  total_tokens_saved INTEGER NOT NULL DEFAULT 0,
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  total_cost_saved_usd REAL NOT NULL DEFAULT 0,
  total_cost_used_usd REAL NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'local',
  github_url TEXT,
  github_branch TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS graph_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  log_tail TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  llm_used INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_saved INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  cost_saved_usd REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_jobs_project ON graph_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_jobs_status ON graph_jobs(status);

CREATE TABLE IF NOT EXISTS google_workspace_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT,
  email TEXT,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS briefing_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  summary_json TEXT NOT NULL DEFAULT '[]',
  calendar_json TEXT NOT NULL DEFAULT '[]',
  last_updated_at TEXT,
  last_fetch_at TEXT,
  last_error TEXT,
  pipeline_status TEXT NOT NULL DEFAULT 'disconnected'
);

CREATE TABLE IF NOT EXISTS briefing_action_items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_action_items_status ON briefing_action_items(status);

CREATE TABLE IF NOT EXISTS telegram_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS morning_mix (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cron TEXT NOT NULL DEFAULT '30 7 * * *',
  enabled INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  last_error TEXT,
  last_status TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS mix_sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'youtube',
  channel_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  handle TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  seeded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mix_seen_videos (
  source_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_id, video_id)
);
