export type MixMessageVideo = {
  title: string
  url: string
  channel?: string
}

const UNREAD_RX = /^(\d+)\s+unread emails? need attention\.?$/i
const MIX_MESSAGE_VIDEO_CAP = 8

export function stripMailAddress(text: string): string {
  let result = text.replace(/\s*<[^<>]+@[^<>]+>/g, '')
  result = result.replace(/"([^"]+)"/g, '$1')
  result = result.replace(/^\s*—\s*/, '')
  result = result.replace(/\s+—\s*$/g, '')
  result = result.replace(/\s{2,}/g, ' ')
  return result.trim()
}

export function formatCalendarEventLine(
  title: string,
  startAt: string | null,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  if (!startAt) return title
  const start = new Date(startAt)
  if (!Number.isFinite(start.getTime())) return title
  const when = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(start)
  return `${when}  ${title}`
}

export function assembleMixMessage(
  briefingLines: string[],
  videos: MixMessageVideo[],
  extras?: {
    calendarLines?: string[]
    sourceCount?: number
  },
): string | null {
  const calendarFromExtras = (extras?.calendarLines ?? []).filter(Boolean)
  const mailLines: string[] = []
  const calendarFromBriefing: string[] = []
  let unreadLabel: string | null = null

  for (const raw of briefingLines) {
    const line = stripMailAddress(raw)
    if (!line) continue
    const unread = line.match(UNREAD_RX)
    if (unread) {
      unreadLabel = `${unread[1]} unread`
      continue
    }
    if (/^Next event:/i.test(line)) {
      calendarFromBriefing.push(line.replace(/^Next event:\s*/i, ''))
      continue
    }
    mailLines.push(line)
  }

  const calendarLines = calendarFromExtras.length > 0 ? calendarFromExtras : calendarFromBriefing
  const videoLines = videos.slice(0, MIX_MESSAGE_VIDEO_CAP)
  const sourceCount = extras?.sourceCount ?? 0
  const parts: string[] = []

  if (unreadLabel || mailLines.length) {
    parts.push('**Email**')
    if (unreadLabel) parts.push(unreadLabel)
    for (const line of mailLines) parts.push(`• ${line}`)
  }

  if (calendarLines.length) {
    if (parts.length) parts.push('')
    parts.push('**Calendar**')
    for (const line of calendarLines) parts.push(`• ${line}`)
  }

  if (videoLines.length) {
    if (parts.length) parts.push('')
    parts.push('**Videos**')
    for (const video of videoLines) {
      const title = video.title.replace(/\[/g, '(').replace(/\]/g, ')')
      parts.push(`• [${title}](${video.url})${video.channel ? ` — ${video.channel}` : ''}`)
    }
  } else if (sourceCount > 0) {
    if (parts.length) parts.push('')
    parts.push('**Videos**', 'None new.')
  }

  if (!parts.length) return null
  return ['**Morning mix**', '', ...parts].join('\n')
}
