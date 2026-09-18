import { getDb } from '../db/index.js'

export type GoogleConnectionRow = {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  email: string | null
  connected_at: string
  updated_at: string
}

export function getGoogleConnection(): GoogleConnectionRow | null {
  const row = getDb()
    .prepare(
      `SELECT access_token, refresh_token, expires_at, email, connected_at, updated_at
       FROM google_workspace_connection WHERE id = 1`,
    )
    .get() as GoogleConnectionRow | undefined
  return row ?? null
}

export function saveGoogleConnection(input: {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  email: string | null
}): void {
  getDb()
    .prepare(
      `INSERT INTO google_workspace_connection (
        id, access_token, refresh_token, expires_at, email, connected_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, google_workspace_connection.refresh_token),
        expires_at = excluded.expires_at,
        email = COALESCE(excluded.email, google_workspace_connection.email),
        updated_at = datetime('now')`,
    )
    .run(input.accessToken, input.refreshToken, input.expiresAt, input.email)
}

export function clearGoogleConnection(): void {
  getDb().prepare('DELETE FROM google_workspace_connection WHERE id = 1').run()
}

export function saveOAuthState(state: string): void {
  getDb()
    .prepare(`INSERT INTO oauth_states (state) VALUES (?)`)
    .run(state)
  getDb()
    .prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-15 minutes')`)
    .run()
}

export function consumeOAuthState(state: string): boolean {
  const result = getDb().prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state)
  return result.changes > 0
}
