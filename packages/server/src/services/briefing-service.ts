import {
  BriefingActionItemDto,
  BriefingConnectionDto,
  BriefingOverviewDto,
  BriefingStatusDto,
  type BriefingConnectionStatus,
  type BriefingPipelineStatus,
} from '../dto/briefing.dto.js'
import { fetchCalendarEvents } from './calendar-fetch-service.js'
import {
  getBriefingCache,
  getBriefingSummary,
  getCalendarEvents,
  isBriefingStale,
  listActionItems,
  saveCalendarEvents,
} from './briefing-store.js'
import { isBriefingRefreshInFlight } from './briefing-generator.js'
import { getGoogleConnection } from './google-connection-store.js'
import {
  isGoogleConnectionExpired,
  isGoogleOAuthConfigured,
} from './google-oauth-service.js'

export function getBriefingOverview(): BriefingOverviewDto {
  const googleConfigured = isGoogleOAuthConfigured()
  const connection = getGoogleConnection()
  const cache = getBriefingCache()
  const actionItems = listActionItems()
  const summary = getBriefingSummary()
  const stale = isBriefingStale()
  const refreshing = isBriefingRefreshInFlight()

  let connectionStatus: BriefingConnectionStatus = 'disconnected'
  if (connection) {
    connectionStatus = isGoogleConnectionExpired() ? 'expired' : 'connected'
  }

  let briefingStatus: BriefingPipelineStatus = 'disconnected'
  let statusMessage: string | null = null
  let lastUpdatedAt = cache?.last_updated_at ?? null

  if (!googleConfigured) {
    statusMessage = 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Workspace.'
  } else if (!connection) {
    statusMessage = 'Connect Google to generate a briefing.'
  } else if (connectionStatus === 'expired') {
    statusMessage = 'Google connection expired. Reconnect to continue.'
  } else if (refreshing) {
    briefingStatus = cache?.pipeline_status === 'ready' ? 'ready' : 'ready'
    statusMessage = 'Refreshing briefing...'
  } else if (cache?.pipeline_status === 'fetch_failed') {
    briefingStatus = summary.length > 0 ? 'stale' : 'fetch_failed'
    statusMessage = cache.last_error ?? 'Failed to fetch Gmail or Calendar data.'
  } else if (cache?.pipeline_status === 'summarization_failed') {
    briefingStatus = summary.length > 0 ? 'stale' : 'summarization_failed'
    statusMessage = cache.last_error ?? 'Cursor agent failed to summarize briefing.'
  } else if (summary.length === 0) {
    briefingStatus = 'ready'
    statusMessage = 'Connected. Refresh to generate your first briefing.'
  } else if (stale) {
    briefingStatus = 'stale'
    statusMessage = 'Briefing is stale. Refresh to update.'
  } else {
    briefingStatus = 'ready'
    statusMessage = null
  }

  return new BriefingOverviewDto(
    new BriefingConnectionDto(
      connectionStatus,
      connection?.email ?? null,
      connection?.connected_at ?? null,
      googleConfigured,
    ),
    new BriefingStatusDto(
      briefingStatus,
      lastUpdatedAt,
      statusMessage,
      summary,
      refreshing,
    ),
    actionItems,
    stale,
    getCalendarEvents(),
  )
}

export function getBriefingActionItems(): BriefingActionItemDto[] {
  return listActionItems()
}

export async function refreshCalendarEvents() {
  const events = await fetchCalendarEvents()
  saveCalendarEvents(events)
  return events
}
