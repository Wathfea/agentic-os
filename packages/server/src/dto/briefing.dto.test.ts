import { describe, expect, it } from 'bun:test'
import {
  BriefingActionItemDto,
  BriefingCalendarEventDto,
  BriefingConnectionDto,
  BriefingOverviewDto,
  BriefingStatusDto,
} from './briefing.dto.js'

describe('BriefingOverviewDto', () => {
  it('includes calendar events in JSON', () => {
    const event = new BriefingCalendarEventDto(
      'evt-1',
      'Team standup',
      '2026-08-20T05:30:00.000Z',
      null,
      null,
      null,
      'https://calendar.google.com/e/1',
    )
    const dto = new BriefingOverviewDto(
      new BriefingConnectionDto('connected', 'a@b.c', '2026-08-20T00:00:00.000Z', true),
      new BriefingStatusDto('ready', '2026-08-20T00:00:00.000Z', null, ['ok'], false),
      [
        new BriefingActionItemDto(
          'ai-1',
          'Prep standup',
          'calendar_event',
          'evt-1',
          '2026-08-20T05:30:00.000Z',
          'medium',
          'open',
        ),
      ],
      false,
      [event],
    )
    expect(dto.toJSON().calendarEvents).toEqual([
      {
        id: 'evt-1',
        title: 'Team standup',
        startAt: '2026-08-20T05:30:00.000Z',
        endAt: null,
        location: null,
        description: null,
        link: 'https://calendar.google.com/e/1',
      },
    ])
  })
})
