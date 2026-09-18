import { describe, expect, it } from 'bun:test'
import {
  assembleMixMessage,
  formatCalendarEventLine,
  stripMailAddress,
} from './mix-message.js'

const video = {
  title: 'AI agents in production',
  url: 'https://www.youtube.com/watch?v=vidNew',
  channel: 'Matt Wolfe',
}

describe('stripMailAddress', () => {
  it('drops angle-bracket emails and wrapping quotes', () => {
    expect(
      stripMailAddress(
        'Missed our conference? — Team PublishDrive <team@publishdrive.com>',
      ),
    ).toBe('Missed our conference? — Team PublishDrive')
    expect(stripMailAddress(' — "Ada Lovelace" <ada@example.com>')).toBe('Ada Lovelace')
  })
})

describe('formatCalendarEventLine', () => {
  it('puts local time before the title', () => {
    expect(
      formatCalendarEventLine('Standup', '2026-09-17T14:00:00.000Z', 'UTC'),
    ).toBe('Thu 14:00  Standup')
  })
})

describe('assembleMixMessage', () => {
  it('builds scannable email, calendar, and video sections', () => {
    const text = assembleMixMessage(
      [
        '9 unread emails need attention.',
        'Invoice overdue — ap@example.com',
        'Next event: Standup',
      ],
      [video],
      {
        calendarLines: ['Thu 14:00  Standup'],
        sourceCount: 5,
      },
    )
    expect(text).toBe(
      [
        '**Morning mix**',
        '',
        '**Email**',
        '9 unread',
        '• Invoice overdue — ap@example.com',
        '',
        '**Calendar**',
        '• Thu 14:00  Standup',
        '',
        '**Videos**',
        '• [AI agents in production](https://www.youtube.com/watch?v=vidNew) — Matt Wolfe',
      ].join('\n'),
    )
    expect(text).not.toContain('How AI changes software teams.')
  })

  it('strips sender emails from briefing lines', () => {
    const text = assembleMixMessage(
      ['Make money with Human Design — Gytis Ceglys <gytis@bodygraph.com>'],
      [],
    )
    expect(text).toContain('Make money with Human Design — Gytis Ceglys')
    expect(text).not.toContain('<gytis@bodygraph.com>')
  })

  it('keeps a videos heading when sources exist but none were kept', () => {
    const text = assembleMixMessage(['Standup at 10'], [], { sourceCount: 3 })
    expect(text).toContain('**Videos**')
    expect(text).toContain('None new.')
  })

  it('returns null when there is nothing to send', () => {
    expect(assembleMixMessage([], [])).toBeNull()
  })
})
