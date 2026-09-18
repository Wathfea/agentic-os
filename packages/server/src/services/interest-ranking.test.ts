import { describe, expect, it } from 'bun:test'
import {
  parseWatchInterestNeedles,
  resolveKeptVideoIds,
  videoMatchesNeedles,
} from './interest-ranking.js'
import type { YouTubeVideo } from './youtube-rss.js'

const aiVideo: YouTubeVideo = {
  videoId: 'vidNew',
  title: 'AI agents in production',
  url: 'https://www.youtube.com/watch?v=vidNew',
  publishedAt: '2026-09-16T08:00:00+00:00',
  description: 'How AI changes software teams.',
}

const pasta: YouTubeVideo = {
  videoId: 'vidOld',
  title: 'Cooking pasta',
  url: 'https://www.youtube.com/watch?v=vidOld',
  publishedAt: '2026-09-01T08:00:00+00:00',
  description: 'Boil water.',
}

const PAGE = `## Current interests

- New AI-based technology
- AI-based approaches in software development
`

describe('parseWatchInterestNeedles', () => {
  it('pulls list items from the watch interests page', () => {
    expect(parseWatchInterestNeedles(PAGE)).toEqual([
      'New AI-based technology',
      'AI-based approaches in software development',
    ])
  })
})

describe('videoMatchesNeedles', () => {
  it('keeps AI software videos and drops unrelated ones', () => {
    const needles = parseWatchInterestNeedles(PAGE)
    expect(videoMatchesNeedles(aiVideo, needles)).toBe(true)
    expect(videoMatchesNeedles(pasta, needles)).toBe(false)
  })
})

describe('resolveKeptVideoIds', () => {
  it('uses Cursor JSON when keep ids are valid', () => {
    const ids = resolveKeptVideoIds('{"keep":["vidNew"]}', [aiVideo, pasta], ['AI'])
    expect(ids).toEqual(['vidNew'])
  })

  it('falls back to needles when Cursor output is unusable', () => {
    const needles = parseWatchInterestNeedles(PAGE)
    const ids = resolveKeptVideoIds('Authentication required CURSOR_API_KEY', [aiVideo, pasta], needles)
    expect(ids).toEqual(['vidNew'])
  })

  it('falls back to needles when Cursor keeps none', () => {
    const needles = parseWatchInterestNeedles(PAGE)
    const ids = resolveKeptVideoIds('{"keep":[]}', [aiVideo, pasta], needles)
    expect(ids).toEqual(['vidNew'])
  })
})
