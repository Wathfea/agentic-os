import { Hono } from 'hono'
import { BriefingConnectDto } from '../dto/briefing.dto.js'
import { refreshBriefing } from '../services/briefing-generator.js'
import { getBriefingOverview, refreshCalendarEvents } from '../services/briefing-service.js'
import { clearBriefingData, getCalendarEvents, setActionItemStatus } from '../services/briefing-store.js'
import {
  buildGoogleAuthUrl,
  createOAuthState,
  disconnectGoogleWorkspace,
  exchangeAuthorizationCode,
  isGoogleOAuthConfigured,
  validateOAuthCallback,
} from '../services/google-oauth-service.js'

const DASHBOARD_ORIGIN = process.env.AGENTIC_DASHBOARD_ORIGIN ?? 'http://localhost:5173'

export const briefingRoutes = new Hono()

briefingRoutes.get('/briefing/status', (c) => {
  return c.json({ briefing: getBriefingOverview().toJSON() })
})

briefingRoutes.get('/briefing/calendar', async (c) => {
  const overview = getBriefingOverview()
  if (overview.connection.status !== 'connected') {
    return c.json({ calendarEvents: overview.calendarEvents.map((event) => event.toJSON()) })
  }
  try {
    const events = await refreshCalendarEvents()
    return c.json({ calendarEvents: events.map((event) => event.toJSON()) })
  } catch {
    return c.json({ calendarEvents: getCalendarEvents().map((event) => event.toJSON()) })
  }
})

briefingRoutes.post('/briefing/refresh', async (c) => {
  const overview = getBriefingOverview().toJSON()
  if (overview.connection.status !== 'connected') {
    return c.json({ error: 'Google Workspace is not connected' }, 400)
  }

  try {
    await refreshBriefing()
    return c.json({ briefing: getBriefingOverview().toJSON() })
  } catch (err) {
    return c.json(
      {
        error: err instanceof Error ? err.message : 'Briefing refresh failed',
        briefing: getBriefingOverview().toJSON(),
      },
      502,
    )
  }
})

briefingRoutes.post('/briefing/action-items/:id/done', (c) => {
  const ok = setActionItemStatus(c.req.param('id'), 'done')
  if (!ok) return c.json({ error: 'Action item not found' }, 404)
  return c.json({ briefing: getBriefingOverview().toJSON() })
})

briefingRoutes.post('/briefing/action-items/:id/dismiss', (c) => {
  const ok = setActionItemStatus(c.req.param('id'), 'dismissed')
  if (!ok) return c.json({ error: 'Action item not found' }, 404)
  return c.json({ briefing: getBriefingOverview().toJSON() })
})

briefingRoutes.get('/briefing/connect', (c) => {
  if (!isGoogleOAuthConfigured()) {
    return c.json({ error: 'Google OAuth is not configured on the server' }, 503)
  }

  const state = createOAuthState()
  const authUrl = buildGoogleAuthUrl(state)
  return c.json({ connect: new BriefingConnectDto(authUrl).toJSON() })
})

briefingRoutes.get('/briefing/oauth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.redirect(`${DASHBOARD_ORIGIN}/?briefing=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code || !state || !validateOAuthCallback(state)) {
    return c.redirect(`${DASHBOARD_ORIGIN}/?briefing=error&reason=invalid_callback`)
  }

  try {
    await exchangeAuthorizationCode(code)
    return c.redirect(`${DASHBOARD_ORIGIN}/?briefing=connected`)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'token_exchange_failed'
    return c.redirect(`${DASHBOARD_ORIGIN}/?briefing=error&reason=${encodeURIComponent(reason)}`)
  }
})

briefingRoutes.post('/briefing/disconnect', async (c) => {
  await disconnectGoogleWorkspace()
  clearBriefingData()
  return c.json({ briefing: getBriefingOverview().toJSON() })
})
