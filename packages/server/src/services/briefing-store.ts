import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'
import {
  BriefingActionItemDto,
  BriefingCalendarEventDto,
  type BriefingActionItemSourceType,
  type BriefingActionItemStatus,
  type BriefingGeneratedActionItem,
  type BriefingPipelineStatus,
} from '../dto/briefing.dto.js'

export const BRIEFING_STALE_MINUTES = 30

export type BriefingCacheRow = {
  summary_json: string
  calendar_json: string
  last_updated_at: string | null
  last_fetch_at: string | null
  last_error: string | null
  pipeline_status: BriefingPipelineStatus
}

type ActionItemRow = {
  id: string
  source_type: BriefingActionItemSourceType
  source_id: string
  title: string
  due_at: string | null
  priority: string | null
  status: BriefingActionItemStatus
}

export function getBriefingCache(): BriefingCacheRow | null {
  const row = getDb()
    .prepare(
      `SELECT summary_json, calendar_json, last_updated_at, last_fetch_at, last_error, pipeline_status
       FROM briefing_cache WHERE id = 1`,
    )
    .get() as BriefingCacheRow | undefined
  return row ?? null
}

export function getBriefingSummary(): string[] {
  const cache = getBriefingCache()
  if (!cache) return []
  try {
    const parsed = JSON.parse(cache.summary_json) as unknown
    return Array.isArray(parsed) ? parsed.filter((line) => typeof line === 'string') : []
  } catch {
    return []
  }
}

export function isBriefingStale(): boolean {
  const cache = getBriefingCache()
  if (!cache?.last_updated_at) return true
  const updatedAt = new Date(cache.last_updated_at).getTime()
  return Date.now() - updatedAt > BRIEFING_STALE_MINUTES * 60_000
}

export function getCalendarEvents(): BriefingCalendarEventDto[] {
  const cache = getBriefingCache()
  if (!cache?.calendar_json) return []
  try {
    const parsed = JSON.parse(cache.calendar_json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      if (typeof row.id !== 'string' || typeof row.title !== 'string') return []
      return [
        new BriefingCalendarEventDto(
          row.id,
          row.title,
          typeof row.startAt === 'string' ? row.startAt : null,
          typeof row.endAt === 'string' ? row.endAt : null,
          typeof row.location === 'string' ? row.location : null,
          typeof row.description === 'string' ? row.description : null,
          typeof row.link === 'string' ? row.link : null,
        ),
      ]
    })
  } catch {
    return []
  }
}

export function saveCalendarEvents(calendarEvents: BriefingCalendarEventDto[]): void {
  getDb()
    .prepare(
      `INSERT INTO briefing_cache (
        id, summary_json, calendar_json, last_fetch_at, last_error, pipeline_status
      ) VALUES (1, '[]', ?, datetime('now'), NULL, 'ready')
      ON CONFLICT(id) DO UPDATE SET
        calendar_json = excluded.calendar_json,
        last_fetch_at = datetime('now')`,
    )
    .run(JSON.stringify(calendarEvents.map((event) => event.toJSON())))
}

export function saveBriefingSuccess(summary: string[], calendarEvents: BriefingCalendarEventDto[] = []): void {
  getDb()
    .prepare(
      `INSERT INTO briefing_cache (
        id, summary_json, calendar_json, last_updated_at, last_fetch_at, last_error, pipeline_status
      ) VALUES (1, ?, ?, datetime('now'), datetime('now'), NULL, 'ready')
      ON CONFLICT(id) DO UPDATE SET
        summary_json = excluded.summary_json,
        calendar_json = excluded.calendar_json,
        last_updated_at = datetime('now'),
        last_fetch_at = datetime('now'),
        last_error = NULL,
        pipeline_status = 'ready'`,
    )
    .run(JSON.stringify(summary), JSON.stringify(calendarEvents.map((event) => event.toJSON())))
}

export function saveBriefingFailure(status: BriefingPipelineStatus, error: string): void {
  getDb()
    .prepare(
      `INSERT INTO briefing_cache (
        id, summary_json, calendar_json, last_updated_at, last_fetch_at, last_error, pipeline_status
      ) VALUES (1, '[]', '[]', NULL, datetime('now'), ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_fetch_at = datetime('now'),
        last_error = excluded.last_error,
        pipeline_status = excluded.pipeline_status`,
    )
    .run(error, status)
}

export function markBriefingStale(): void {
  const cache = getBriefingCache()
  if (!cache) return
  getDb()
    .prepare(`UPDATE briefing_cache SET pipeline_status = 'stale' WHERE id = 1`)
    .run()
}

export function listActionItems(): BriefingActionItemDto[] {
  const rows = getDb()
    .prepare(
      `SELECT id, source_type, source_id, title, due_at, priority, status
       FROM briefing_action_items
       WHERE status = 'open'
       ORDER BY
         CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
         due_at ASC,
         updated_at DESC`,
    )
    .all() as ActionItemRow[]

  return rows.map(
    (row) =>
      new BriefingActionItemDto(
        row.id,
        row.title,
        row.source_type,
        row.source_id,
        row.due_at,
        row.priority,
        row.status,
      ),
  )
}

export function mergeGeneratedActionItems(items: BriefingGeneratedActionItem[]): void {
  const db = getDb()
  const insert = db.prepare(
    `INSERT INTO briefing_action_items (
      id, source_type, source_id, title, due_at, priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', datetime('now'), datetime('now'))`,
  )
  const updateOpen = db.prepare(
    `UPDATE briefing_action_items
     SET title = ?, due_at = ?, priority = ?, updated_at = datetime('now')
     WHERE source_type = ? AND source_id = ? AND status = 'open'`,
  )
  const isClosed = db.prepare(
    `SELECT 1 FROM briefing_action_items
     WHERE source_type = ? AND source_id = ? AND status IN ('done', 'dismissed')
     LIMIT 1`,
  )

  const tx = db.transaction((generated: BriefingGeneratedActionItem[]) => {
    for (const item of generated) {
      const closed = isClosed.get(item.sourceType, item.sourceId)
      if (closed) continue

      const updated = updateOpen.run(
        item.title,
        item.dueAt ?? null,
        item.priority ?? null,
        item.sourceType,
        item.sourceId,
      )
      if (updated.changes > 0) continue

      insert.run(
        randomUUID(),
        item.sourceType,
        item.sourceId,
        item.title,
        item.dueAt ?? null,
        item.priority ?? null,
      )
    }
  })

  tx(items)
}

export function setActionItemStatus(id: string, status: BriefingActionItemStatus): boolean {
  const result = getDb()
    .prepare(
      `UPDATE briefing_action_items
       SET status = ?, updated_at = datetime('now')
       WHERE id = ? AND status = 'open'`,
    )
    .run(status, id)
  return result.changes > 0
}

export function clearBriefingData(): void {
  getDb().prepare('DELETE FROM briefing_cache WHERE id = 1').run()
  getDb().prepare('DELETE FROM briefing_action_items').run()
}
