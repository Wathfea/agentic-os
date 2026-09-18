import { describe, expect, it } from 'bun:test'
import { BriefingCalendarEventDto, BriefingEmailThreadDto } from '../dto/briefing.dto.js'
import { buildLocalBriefing, resolveGeneratedBriefing } from './briefing-generator.js'

const unread = new BriefingEmailThreadDto(
  't-1',
  'Invoice overdue',
  'ap@example.com',
  '2026-09-14T10:00:00.000Z',
  'Please pay',
  true,
)

const event = new BriefingCalendarEventDto(
  'e-1',
  'Standup',
  '2026-09-14T12:00:00.000Z',
  null,
  null,
  null,
  null,
)

describe('buildLocalBriefing', () => {
  it('turns unread mail into high-priority action items', () => {
    const payload = buildLocalBriefing([unread], [event])
    expect(payload.actionItems).toEqual([
      {
        title: 'Invoice overdue',
        sourceType: 'gmail_thread',
        sourceId: 't-1',
        dueAt: '2026-09-14T10:00:00.000Z',
        priority: 'high',
      },
      {
        title: 'Standup',
        sourceType: 'calendar_event',
        sourceId: 'e-1',
        dueAt: '2026-09-14T12:00:00.000Z',
        priority: 'medium',
      },
    ])
    expect(payload.summary[0]).toContain('1 unread')
  })
})

describe('resolveGeneratedBriefing', () => {
  it('uses Cursor JSON when the agent returns a valid payload', () => {
    const payload = resolveGeneratedBriefing(
      '{"summary":["AI mix"],"actionItems":[{"title":"Call bank","sourceType":"gmail_thread","sourceId":"t-1","dueAt":null,"priority":"high"}]}',
      [unread],
      [event],
    )
    expect(payload.summary).toEqual(['AI mix'])
    expect(payload.actionItems).toEqual([
      {
        title: 'Call bank',
        sourceType: 'gmail_thread',
        sourceId: 't-1',
        dueAt: null,
        priority: 'high',
      },
    ])
  })

  it('falls back to the local mix when Cursor auth fails', () => {
    const payload = resolveGeneratedBriefing(
      "Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.",
      [unread],
      [event],
    )
    expect(payload.actionItems[0]?.sourceId).toBe('t-1')
    expect(payload.actionItems[0]?.priority).toBe('high')
    expect(payload.summary[0]).toContain('unread')
  })
})
