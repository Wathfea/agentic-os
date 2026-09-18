import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'
import { MixSourceDto, MixStatusDto } from '../dto/mix.dto.js'
import { computeNextRun, isValidCronShape } from './cron.js'

export const DEFAULT_MIX_CRON = '30 7 * * *'

type MixRow = {
  cron: string
  enabled: number
  last_run_at: string | null
  last_error: string | null
  last_status: string
}

type SourceRow = {
  id: string
  channel_id: string
  title: string
  handle: string | null
  enabled: number
  seeded?: number
}

export type MixSourceRunRow = {
  id: string
  channelId: string
  title: string
  seeded: boolean
}

function ensureMixRow(): MixRow {
  const db = getDb()
  db.prepare(
    `INSERT OR IGNORE INTO morning_mix (id, cron, enabled, last_status)
     VALUES (1, ?, 0, 'idle')`,
  ).run(DEFAULT_MIX_CRON)
  const row = db
    .prepare(`SELECT cron, enabled, last_run_at, last_error, last_status FROM morning_mix WHERE id = 1`)
    .get() as MixRow
  return row
}

export function getMixRow(): MixRow {
  return ensureMixRow()
}

export function getMixStatusDto(running: boolean): MixStatusDto {
  const row = ensureMixRow()
  let nextRunAt: number | null = null
  if (isValidCronShape(row.cron)) {
    try {
      nextRunAt = computeNextRun(row.cron)
    } catch {
      nextRunAt = null
    }
  }
  return new MixStatusDto(
    row.cron,
    row.enabled === 1,
    row.last_status,
    row.last_error,
    row.last_run_at,
    nextRunAt,
    running,
  )
}

export function updateMixConfig(input: { cron?: string; enabled?: boolean }): void {
  ensureMixRow()
  const current = getMixRow()
  const cron = input.cron ?? current.cron
  const enabled = input.enabled ?? current.enabled === 1
  getDb()
    .prepare(`UPDATE morning_mix SET cron = ?, enabled = ? WHERE id = 1`)
    .run(cron, enabled ? 1 : 0)
}

export function markMixRun(status: string, error: string | null): void {
  ensureMixRow()
  getDb()
    .prepare(
      `UPDATE morning_mix
       SET last_status = ?, last_error = ?, last_run_at = ?
       WHERE id = 1`,
    )
    .run(status, error, new Date().toISOString())
}

export function listMixSources(): MixSourceDto[] {
  const rows = getDb()
    .prepare(
      `SELECT id, channel_id, title, handle, enabled FROM mix_sources ORDER BY created_at ASC`,
    )
    .all() as SourceRow[]
  return rows.map(
    (row) => new MixSourceDto(row.id, row.channel_id, row.title, row.handle, row.enabled === 1),
  )
}

export function listEnabledMixSourcesForRun(): MixSourceRunRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, channel_id, title, seeded FROM mix_sources WHERE enabled = 1 ORDER BY created_at ASC`,
    )
    .all() as SourceRow[]
  return rows.map((row) => ({
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    seeded: row.seeded === 1,
  }))
}

export function markMixSourceSeeded(id: string): void {
  getDb().prepare(`UPDATE mix_sources SET seeded = 1 WHERE id = ?`).run(id)
}

export function addMixSource(input: {
  channelId: string
  title: string
  handle: string | null
}): MixSourceDto {
  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO mix_sources (id, kind, channel_id, title, handle, enabled)
       VALUES (?, 'youtube', ?, ?, ?, 1)`,
    )
    .run(id, input.channelId, input.title, input.handle)
  return new MixSourceDto(id, input.channelId, input.title, input.handle, true)
}

export function deleteMixSource(id: string): boolean {
  const db = getDb()
  db.prepare(`DELETE FROM mix_seen_videos WHERE source_id = ?`).run(id)
  const result = db.prepare(`DELETE FROM mix_sources WHERE id = ?`).run(id)
  return result.changes > 0
}

export function listSeenVideoIds(sourceId: string): Set<string> {
  const rows = getDb()
    .prepare(`SELECT video_id FROM mix_seen_videos WHERE source_id = ?`)
    .all(sourceId) as Array<{ video_id: string }>
  return new Set(rows.map((row) => row.video_id))
}

export function markVideosSeen(sourceId: string, videoIds: string[]): void {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO mix_seen_videos (source_id, video_id) VALUES (?, ?)`,
  )
  const db = getDb()
  const tx = db.transaction(() => {
    for (const videoId of videoIds) {
      stmt.run(sourceId, videoId)
    }
  })
  tx()
}

export function findSourceByChannelId(channelId: string): MixSourceDto | null {
  const row = getDb()
    .prepare(`SELECT id, channel_id, title, handle, enabled FROM mix_sources WHERE channel_id = ?`)
    .get(channelId) as SourceRow | undefined
  if (!row) return null
  return new MixSourceDto(row.id, row.channel_id, row.title, row.handle, row.enabled === 1)
}
