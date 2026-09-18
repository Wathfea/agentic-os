import { describe, expect, it } from 'bun:test'
import {
  extractChannelId,
  parseYouTubeRss,
  pickNewVideos,
  selectMixCandidateVideos,
} from './youtube-rss.js'

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>vidNew</yt:videoId>
    <title>AI agents in production</title>
    <published>2026-09-16T08:00:00+00:00</published>
    <link rel="alternate" href="https://www.youtube.com/watch?v=vidNew"/>
    <media:group>
      <media:description>How AI changes software teams.</media:description>
    </media:group>
  </entry>
  <entry>
    <yt:videoId>vidOld</yt:videoId>
    <title>Cooking pasta</title>
    <published>2026-09-01T08:00:00+00:00</published>
    <link rel="alternate" href="https://www.youtube.com/watch?v=vidOld"/>
    <media:group>
      <media:description>Boil water.</media:description>
    </media:group>
  </entry>
</feed>`

describe('extractChannelId', () => {
  it('accepts a raw UC id', () => {
    expect(extractChannelId('UC1234567890abcdefghij')).toBe('UC1234567890abcdefghij')
  })

  it('extracts from a /channel/ URL', () => {
    expect(extractChannelId('https://www.youtube.com/channel/UC1234567890abcdefghij')).toBe(
      'UC1234567890abcdefghij',
    )
  })

  it('returns null for a handle until resolved', () => {
    expect(extractChannelId('https://www.youtube.com/@someone')).toBeNull()
  })
})

describe('parseYouTubeRss', () => {
  it('reads video id, title, url, published, and description', () => {
    const videos = parseYouTubeRss(FEED)
    expect(videos).toHaveLength(2)
    expect(videos[0]).toEqual({
      videoId: 'vidNew',
      title: 'AI agents in production',
      url: 'https://www.youtube.com/watch?v=vidNew',
      publishedAt: '2026-09-16T08:00:00+00:00',
      description: 'How AI changes software teams.',
    })
  })
})

describe('pickNewVideos', () => {
  it('returns every item on first run so the caller can mark them seen', () => {
    const videos = parseYouTubeRss(FEED)
    expect(pickNewVideos(videos, new Set())).toEqual(videos)
  })

  it('skips ids already in the seen set', () => {
    const videos = parseYouTubeRss(FEED)
    expect(pickNewVideos(videos, new Set(['vidNew', 'vidOld']))).toEqual([])
    expect(pickNewVideos(videos, new Set(['vidOld'])).map((v) => v.videoId)).toEqual(['vidNew'])
  })
})

describe('selectMixCandidateVideos', () => {
  const now = Date.parse('2026-09-17T16:00:00+00:00')

  it('on first poll keeps recent videos and drops the backlog', () => {
    const videos = parseYouTubeRss(FEED)
    const picked = selectMixCandidateVideos(videos, new Set(), false, now)
    expect(picked.map((video) => video.videoId)).toEqual(['vidNew'])
  })

  it('on first poll with no recent videos keeps the latest upload', () => {
    const videos = parseYouTubeRss(FEED).filter((video) => video.videoId === 'vidOld')
    const picked = selectMixCandidateVideos(videos, new Set(['vidOld']), false, now)
    expect(picked.map((video) => video.videoId)).toEqual(['vidOld'])
  })

  it('after the first poll only returns unseen videos', () => {
    const videos = parseYouTubeRss(FEED)
    const picked = selectMixCandidateVideos(videos, new Set(['vidNew', 'vidOld']), true, now)
    expect(picked).toEqual([])
  })
})
