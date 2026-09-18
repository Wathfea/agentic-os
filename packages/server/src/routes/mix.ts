import { Hono } from 'hono'
import { isValidCronShape } from '../services/cron.js'
import { getMixOverview, runMorningMix } from '../services/mix-runner.js'
import {
  addMixSource,
  deleteMixSource,
  findSourceByChannelId,
  updateMixConfig,
} from '../services/mix-store.js'
import { sendTelegramMessage } from '../services/telegram-outbound.js'
import {
  clearTelegramConnection,
  getTelegramConnection,
  saveTelegramConnection,
} from '../services/telegram-store.js'
import {
  extractChannelId,
  extractHandle,
  fetchChannelHtml,
  fetchYouTubeRss,
  parseYouTubeChannelTitle,
  resolveChannelIdFromHtml,
} from '../services/youtube-rss.js'

export const mixRoutes = new Hono()

function overviewJson() {
  return { mix: getMixOverview().toJSON() }
}

mixRoutes.get('/mix', (c) => {
  return c.json(overviewJson())
})

mixRoutes.post('/mix', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { cron?: string; enabled?: boolean }
  if (body.cron !== undefined && !isValidCronShape(body.cron)) {
    return c.json({ error: 'Invalid cron expression' }, 400)
  }
  updateMixConfig({
    cron: typeof body.cron === 'string' ? body.cron.trim() : undefined,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
  })
  return c.json(overviewJson())
})

mixRoutes.post('/mix/telegram', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { botToken?: string; chatId?: string }
  const botToken = body.botToken?.trim() ?? ''
  const chatId = body.chatId?.trim() ?? ''
  if (!botToken || !chatId) {
    return c.json({ error: 'botToken and chatId are required' }, 400)
  }
  saveTelegramConnection(botToken, chatId)
  return c.json(overviewJson())
})

mixRoutes.delete('/mix/telegram', (c) => {
  clearTelegramConnection()
  return c.json(overviewJson())
})

mixRoutes.post('/mix/telegram/test', async (c) => {
  const telegram = getTelegramConnection()
  if (!telegram) {
    return c.json({ error: 'Telegram is not connected' }, 400)
  }
  try {
    await sendTelegramMessage(telegram.bot_token, telegram.chat_id, '**Agentic OS** connected. Morning mix will use this chat.')
    return c.json(overviewJson())
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Telegram test failed', mix: getMixOverview().toJSON() },
      502,
    )
  }
})

mixRoutes.post('/mix/run', async (c) => {
  const telegram = getTelegramConnection()
  if (!telegram) {
    return c.json({ error: 'Telegram is not connected' }, 400)
  }
  try {
    await runMorningMix()
    return c.json(overviewJson())
  } catch (err) {
    return c.json(
      {
        error: err instanceof Error ? err.message : 'Morning mix failed',
        mix: getMixOverview().toJSON(),
      },
      502,
    )
  }
})

mixRoutes.post('/mix/sources', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { url?: string }
  const url = body.url?.trim() ?? ''
  if (!url) {
    return c.json({ error: 'url is required' }, 400)
  }

  let channelId = extractChannelId(url)
  const handle = extractHandle(url)
  if (!channelId && handle) {
    try {
      const html = await fetchChannelHtml(handle)
      channelId = resolveChannelIdFromHtml(html)
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Could not resolve YouTube handle' },
        502,
      )
    }
  }
  if (!channelId) {
    return c.json({ error: 'Need a channel id (UC…) or a youtube.com/channel/… or @handle URL' }, 400)
  }
  if (findSourceByChannelId(channelId)) {
    return c.json({ error: 'That channel is already added' }, 409)
  }

  let title = handle ? `@${handle}` : channelId
  try {
    const xml = await fetchYouTubeRss(channelId)
    title = parseYouTubeChannelTitle(xml) || title
  } catch {
  }

  addMixSource({ channelId, title, handle })
  return c.json(overviewJson())
})

mixRoutes.delete('/mix/sources/:id', (c) => {
  const ok = deleteMixSource(c.req.param('id'))
  if (!ok) return c.json({ error: 'Source not found' }, 404)
  return c.json(overviewJson())
})
