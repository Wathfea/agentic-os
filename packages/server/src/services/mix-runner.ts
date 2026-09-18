import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENTIC_ROOT, BRAIN_DIR } from '../config.js'
import { MixOverviewDto, TelegramConnectionDto } from '../dto/mix.dto.js'
import { refreshBriefing } from './briefing-generator.js'
import { getBriefingOverview } from './briefing-service.js'
import { runCursorAgentTask } from './cursor-agent-runner.js'
import { cronMatchesNow } from './cron.js'
import { parseWatchInterestNeedles, resolveKeptVideoIds } from './interest-ranking.js'
import { assembleMixMessage, formatCalendarEventLine, type MixMessageVideo } from './mix-message.js'
import {
  getMixRow,
  getMixStatusDto,
  listEnabledMixSourcesForRun,
  listMixSources,
  listSeenVideoIds,
  markMixRun,
  markMixSourceSeeded,
  markVideosSeen,
} from './mix-store.js'
import { sendTelegramMessage } from './telegram-outbound.js'
import { getTelegramConnection } from './telegram-store.js'
import {
  fetchYouTubeRss,
  parseYouTubeRss,
  selectMixCandidateVideos,
  type YouTubeVideo,
} from './youtube-rss.js'

let mixInFlight: Promise<void> | null = null

export function isMixRunInFlight(): boolean {
  return mixInFlight !== null
}

export function getMixOverview(): MixOverviewDto {
  const telegram = getTelegramConnection()
  return new MixOverviewDto(
    new TelegramConnectionDto(Boolean(telegram), telegram?.chat_id ?? null),
    getMixStatusDto(isMixRunInFlight()),
    listMixSources(),
  )
}

function readWatchInterests(): string {
  const path = join(BRAIN_DIR, 'wiki/concepts/watch-interests.md')
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

async function rankVideos(videos: YouTubeVideo[]): Promise<YouTubeVideo[]> {
  if (!videos.length) return []
  const page = readWatchInterests()
  const needles = parseWatchInterestNeedles(page)
  const prompt = [
    'Rank YouTube videos for a morning digest.',
    'Keep a video only if it matches the watch interests.',
    'Return ONLY JSON: {"keep":["videoId",...]}',
    'Do not invent ids.',
    '',
    'Watch interests:',
    page || needles.join('\n'),
    '',
    'Videos JSON:',
    JSON.stringify(
      videos.map((video) => ({
        videoId: video.videoId,
        title: video.title,
        description: video.description,
      })),
    ),
  ].join('\n')

  try {
    const output = await runCursorAgentTask({
      prompt,
      workspace: AGENTIC_ROOT,
      mode: 'ask',
      onEvent: () => {},
    })
    const kept = new Set(resolveKeptVideoIds(output, videos, needles))
    return videos.filter((video) => kept.has(video.videoId))
  } catch {
    const kept = new Set(resolveKeptVideoIds('', videos, needles))
    return videos.filter((video) => kept.has(video.videoId))
  }
}

async function loadBriefingLines(): Promise<string[]> {
  const overview = getBriefingOverview()
  if (overview.connection.status !== 'connected') {
    return overview.briefing.summary
  }
  try {
    await refreshBriefing()
  } catch {
  }
  return getBriefingOverview().briefing.summary
}

export async function runMorningMix(): Promise<void> {
  if (mixInFlight) return mixInFlight
  mixInFlight = executeMorningMix().finally(() => {
    mixInFlight = null
  })
  return mixInFlight
}

async function executeMorningMix(): Promise<void> {
  const telegram = getTelegramConnection()
  if (!telegram) {
    markMixRun('failed', 'Telegram is not connected')
    throw new Error('Telegram is not connected')
  }

  try {
    const briefingLines = await loadBriefingLines()
    const overview = getBriefingOverview()
    const calendarLines = overview.calendarEvents.map((event) =>
      formatCalendarEventLine(event.title, event.startAt),
    )
    const sources = listEnabledMixSourcesForRun()
    const ranked: MixMessageVideo[] = []
    const newlySeeded: string[] = []

    for (const source of sources) {
      const xml = await fetchYouTubeRss(source.channelId)
      const videos = parseYouTubeRss(xml)
      const seen = listSeenVideoIds(source.id)
      const candidates = selectMixCandidateVideos(videos, seen, source.seeded)
      markVideosSeen(
        source.id,
        videos.map((video) => video.videoId),
      )
      if (!source.seeded) newlySeeded.push(source.id)
      ranked.push(
        ...(await rankVideos(candidates)).map((video) => ({
          title: video.title,
          url: video.url,
          channel: source.title,
        })),
      )
    }

    const text = assembleMixMessage(briefingLines, ranked, {
      calendarLines,
      sourceCount: sources.length,
    })
    if (text) {
      await sendTelegramMessage(telegram.bot_token, telegram.chat_id, text)
    }
    for (const id of newlySeeded) markMixSourceSeeded(id)
    markMixRun('sent', null)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Morning mix failed'
    markMixRun('failed', message)
    throw err
  }
}

export function tickMorningMix(): void {
  const telegram = getTelegramConnection()
  if (!telegram) return
  const row = getMixRow()
  if (row.enabled !== 1) return
  if (isMixRunInFlight()) return
  if (!cronMatchesNow(row.cron)) return
  if (row.last_run_at) {
    const last = new Date(row.last_run_at).getTime()
    if (Number.isFinite(last) && Date.now() - last < 60_000) return
  }
  void runMorningMix().catch(() => {})
}
