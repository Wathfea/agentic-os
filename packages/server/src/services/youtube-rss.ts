const CHANNEL_ID_RE = /UC[\w-]{20,}/

export function extractChannelId(input: string): string | null {
  const trimmed = input.trim()
  const direct = trimmed.match(new RegExp(`^${CHANNEL_ID_RE.source}$`))
  if (direct) return direct[0]
  const fromPath = trimmed.match(/\/channel\/(UC[\w-]{20,})/)
  if (fromPath) return fromPath[1]
  return null
}

export function extractHandle(input: string): string | null {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/youtube\.com\/@([\w.-]+)/i)
  if (fromUrl) return fromUrl[1]
  const bare = trimmed.match(/^@([\w.-]+)$/)
  if (bare) return bare[1]
  return null
}

export type YouTubeVideo = {
  videoId: string
  title: string
  url: string
  publishedAt: string
  description: string
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function innerTag(block: string, name: string): string {
  const re = new RegExp(`<(?:[\\w]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${name}>`, 'i')
  const match = block.match(re)
  return match ? decodeXml(match[1]) : ''
}

function attr(block: string, name: string, attrName: string): string {
  const re = new RegExp(`<${name}[^>]*${attrName}="([^"]+)"`, 'i')
  const match = block.match(re)
  return match ? match[1] : ''
}

export function parseYouTubeChannelTitle(xml: string): string {
  const match = xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/i)
  return match ? decodeXml(match[1]) : 'YouTube channel'
}

export function parseYouTubeRss(xml: string): YouTubeVideo[] {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return entries.flatMap((entry) => {
    const videoId = innerTag(entry, 'videoId')
    if (!videoId) return []
    const href = attr(entry, 'link', 'href')
    return [
      {
        videoId,
        title: innerTag(entry, 'title') || videoId,
        url: href || `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: innerTag(entry, 'published'),
        description: innerTag(entry, 'description'),
      },
    ]
  })
}

export function pickNewVideos(videos: YouTubeVideo[], seenIds: Set<string>): YouTubeVideo[] {
  return videos.filter((video) => !seenIds.has(video.videoId))
}

export const MIX_VIDEO_LOOKBACK_MS = 48 * 60 * 60 * 1000
export const MIX_FIRST_POLL_PER_SOURCE = 3

export function isRecentVideo(
  video: YouTubeVideo,
  now = Date.now(),
  lookbackMs = MIX_VIDEO_LOOKBACK_MS,
): boolean {
  const published = Date.parse(video.publishedAt)
  if (!Number.isFinite(published)) return false
  return published <= now + 60_000 && now - published <= lookbackMs
}

export function selectMixCandidateVideos(
  videos: YouTubeVideo[],
  seen: Set<string>,
  seeded: boolean,
  now = Date.now(),
): YouTubeVideo[] {
  if (!seeded) {
    const recent = videos.filter((video) => isRecentVideo(video, now))
    const pool = recent.length > 0 ? recent : videos.slice(0, 1)
    return pool.slice(0, MIX_FIRST_POLL_PER_SOURCE)
  }
  return pickNewVideos(videos, seen)
}

export function resolveChannelIdFromHtml(html: string): string | null {
  const rss = html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{20,})/i)
  if (rss) return rss[1]
  const quoted = html.match(/"channelId":"(UC[\w-]{20,})"/)
  if (quoted) return quoted[1]
  const path = html.match(/\/channel\/(UC[\w-]{20,})/)
  if (path) return path[1]
  return null
}

export async function fetchYouTubeRss(channelId: string): Promise<string> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AgenticOS/1.0' },
  })
  if (!res.ok) {
    throw new Error(`YouTube RSS failed (${res.status})`)
  }
  return res.text()
}

export async function fetchChannelHtml(handle: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
    headers: { 'User-Agent': 'AgenticOS/1.0' },
  })
  if (!res.ok) {
    throw new Error(`YouTube channel page failed (${res.status})`)
  }
  return res.text()
}
