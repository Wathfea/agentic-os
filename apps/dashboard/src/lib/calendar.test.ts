import { describe, expect, it } from 'bun:test'
import {
  clockHands,
  formatHero,
  formatZone,
  googleCalendarUrl,
  isoWeek,
  upcomingEvents,
  yearQuarters,
} from './calendar'

const sydney = new Date('2026-08-20T04:34:25.000Z')

describe('iso week grid', () => {
  it('marks week 34 as current on 20 Aug 2026', () => {
    expect(isoWeek(sydney)).toBe(34)
    const quarters = yearQuarters(sydney)
    expect(quarters.map((q) => q.id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
    expect(quarters.flatMap((q) => q.weeks).length).toBeGreaterThanOrEqual(52)
    const current = quarters.flatMap((q) => q.weeks).find((w) => w.state === 'current')
    expect(current?.week).toBe(34)
  })
})

describe('clock', () => {
  it('points hands for 14:34:25', () => {
    const local = new Date(2026, 7, 20, 14, 34, 25)
    const hands = clockHands(local)
    expect(hands.minuteDeg).toBeCloseTo(206.5, 1)
    expect(hands.secondDeg).toBe(150)
    expect(hands.hourDeg).toBeCloseTo(77.208, 1)
  })

  it('formats hero and remote zones', () => {
    const hero = formatHero(sydney, 'Australia/Sydney')
    expect(hero.weekLabel).toBe('Wk34')
    expect(hero.dateLabel).toContain('Aug 20 2026')
    expect(hero.timeLabel).toMatch(/02:34:25 pm/i)
    expect(hero.zoneLabel.toUpperCase()).toContain('SYDNEY')
    const pt = formatZone(sydney, 'USA PT', 'America/Los_Angeles')
    expect(pt.time.toLowerCase()).toContain('9:34')
    expect(pt.night).toBe(true)
  })
})

describe('upcoming events', () => {
  it('keeps the next three events from now', () => {
    const rows = upcomingEvents(
      [
        { id: '1', title: 'Past', startAt: '2026-08-20T01:00:00.000Z', endAt: '2026-08-20T02:00:00.000Z', link: null },
        { id: '2', title: 'Team standup', startAt: '2026-08-20T05:30:00.000Z', endAt: null, link: 'https://calendar.google.com/e/2' },
        { id: '3', title: 'Nordic SaaS', startAt: '2026-08-20T07:00:00.000Z', endAt: null, link: null },
        { id: '4', title: 'Sprint review', startAt: '2026-08-20T08:30:00.000Z', endAt: null, link: null },
        { id: '5', title: 'Later', startAt: '2026-08-20T10:00:00.000Z', endAt: null, link: null },
      ],
      sydney,
    )
    expect(rows.map((r) => r.title)).toEqual(['Team standup', 'Nordic SaaS', 'Sprint review'])
    expect(googleCalendarUrl(rows[0].link)).toBe('https://calendar.google.com/e/2')
    expect(googleCalendarUrl(null)).toBe('https://calendar.google.com/calendar/r')
  })
})
