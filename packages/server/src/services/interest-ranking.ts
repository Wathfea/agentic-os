import type { YouTubeVideo } from './youtube-rss.js'

const STOP = new Set([
  'new',
  'based',
  'and',
  'the',
  'in',
  'of',
  'for',
  'with',
  'a',
  'an',
  'to',
  'on',
])

export function parseWatchInterestNeedles(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
}

export function needleTokens(needles: string[]): string[] {
  const tokens = new Set<string>()
  for (const needle of needles) {
    for (const raw of needle.split(/[^a-zA-Z0-9]+/)) {
      const token = raw.trim()
      if (!token) continue
      const lower = token.toLowerCase()
      if (STOP.has(lower)) continue
      if (token.length < 2) continue
      tokens.add(lower)
    }
  }
  return [...tokens]
}

export function videoMatchesNeedles(video: YouTubeVideo, needles: string[]): boolean {
  const hay = `${video.title} ${video.description}`.toLowerCase()
  return needleTokens(needles).some((token) => {
    if (token === 'ai') return /\bai\b/.test(hay)
    return hay.includes(token)
  })
}

function parseKeepJson(output: string): string[] | null {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(output.slice(start, end + 1)) as { keep?: unknown }
    if (!Array.isArray(parsed.keep)) return null
    return parsed.keep.filter((id): id is string => typeof id === 'string')
  } catch {
    return null
  }
}

export function resolveKeptVideoIds(
  agentOutput: string,
  videos: YouTubeVideo[],
  needles: string[],
): string[] {
  const known = new Set(videos.map((video) => video.videoId))
  const parsed = parseKeepJson(agentOutput)
  const kept = parsed?.filter((id) => known.has(id)) ?? []
  if (kept.length > 0) return kept
  return videos.filter((video) => videoMatchesNeedles(video, needles)).map((video) => video.videoId)
}
