import { BriefingCalendarEventDto } from '../dto/briefing.dto.js'
import { googleApiFetch } from './google-api-client.js'

type CalendarListResponse = {
  items?: Array<{ id: string; primary?: boolean; summary?: string }>
}

type CalendarEventsResponse = {
  items?: Array<{
    id: string
    summary?: string
    description?: string
    location?: string
    status?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
    htmlLink?: string
  }>
}

function getLocalDayBounds(): { timeMin: string; timeMax: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

async function getPrimaryCalendarId(): Promise<string> {
  const res = await googleApiFetch('/calendar/v3/users/me/calendarList?minAccessRole=reader')
  const data = (await res.json()) as CalendarListResponse
  const primary = data.items?.find((item) => item.primary)
  return primary?.id ?? 'primary'
}

export async function fetchCalendarEvents(): Promise<BriefingCalendarEventDto[]> {
  const calendarId = await getPrimaryCalendarId()
  const { timeMin, timeMax } = getLocalDayBounds()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const res = await googleApiFetch(
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  )
  const data = (await res.json()) as CalendarEventsResponse

  return (data.items ?? [])
    .filter((event) => event.status !== 'cancelled')
    .map(
      (event) =>
        new BriefingCalendarEventDto(
          event.id,
          event.summary ?? '(no title)',
          event.start?.dateTime ?? event.start?.date ?? null,
          event.end?.dateTime ?? event.end?.date ?? null,
          event.location ?? null,
          event.description ?? null,
          event.htmlLink ?? null,
        ),
    )
}
