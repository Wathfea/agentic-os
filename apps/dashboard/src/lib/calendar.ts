export type YearWeek = {
  week: number
  state: 'past' | 'current' | 'future'
}

export type YearQuarter = {
  id: string
  weeks: YearWeek[]
}

export type ClockZone = {
  id: string
  label: string
  time: string
  day: string
  night: boolean
}

export type HeroClock = {
  weekLabel: string
  dateLabel: string
  timeLabel: string
  zoneLabel: string
}

export type CalendarEventInput = {
  id: string
  title: string
  startAt: string | null
  endAt: string | null
  link: string | null
}

export type UpcomingEvent = {
  id: string
  title: string
  time: string
  link: string | null
}

export const REMOTE_ZONES = [
  { id: 'pt', label: 'USA PT', timeZone: 'America/Los_Angeles' },
  { id: 'et', label: 'USA ET', timeZone: 'America/New_York' },
  { id: 'london', label: 'LONDON', timeZone: 'Europe/London' },
] as const

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  return bag
}

function civilDate(date: Date, timeZone?: string): Date {
  if (!timeZone) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    )
  }
  const p = zonedParts(date, timeZone)
  return new Date(
    Number(p.year),
    MONTHS[p.month] ?? 0,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
}

export function isoWeek(date: Date): number {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNr = (tmp.getDay() + 6) % 7
  tmp.setDate(tmp.getDate() - dayNr + 3)
  const firstThursday = new Date(tmp.getFullYear(), 0, 4)
  const d0 = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - d0 + 3)
  return 1 + Math.round((tmp.getTime() - firstThursday.getTime()) / 604800000)
}

function isoWeekYear(date: Date): number {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNr = (tmp.getDay() + 6) % 7
  tmp.setDate(tmp.getDate() - dayNr + 3)
  return tmp.getFullYear()
}

export function weeksInIsoYear(year: number): number {
  return isoWeek(new Date(year, 11, 28))
}

export function yearQuarters(date: Date): YearQuarter[] {
  const week = isoWeek(date)
  const total = weeksInIsoYear(isoWeekYear(date))
  const sizes = [13, 13, 13, Math.max(13, total - 39)]
  let n = 1
  return sizes.map((size, i) => ({
    id: `Q${i + 1}`,
    weeks: Array.from({ length: size }, () => {
      const w = n++
      const state = w < week ? 'past' : w === week ? 'current' : 'future'
      return { week: w, state }
    }),
  }))
}

export function clockHands(date: Date) {
  const s = date.getSeconds()
  const m = date.getMinutes() + s / 60
  const h = (date.getHours() % 12) + m / 60
  return {
    hourDeg: h * 30,
    minuteDeg: m * 6,
    secondDeg: s * 6,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function clock12(hours: number, minutes: number, seconds?: number) {
  const h12 = hours % 12 || 12
  const ap = hours >= 12 ? 'pm' : 'am'
  const core = `${pad(h12)}:${pad(minutes)}${seconds == null ? '' : `:${pad(seconds)}`}`
  return `${core} ${ap}`
}

export function formatHero(date: Date, timeZone?: string): HeroClock {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const civil = civilDate(date, timeZone)
  const p = zonedParts(date, zone)
  const city = zone.split('/').pop()?.replace(/_/g, ' ').toUpperCase() ?? zone.toUpperCase()
  return {
    weekLabel: `Wk${isoWeek(civil)}`,
    dateLabel: `${p.month} ${p.day} ${p.year} (${p.weekday})`,
    timeLabel: clock12(civil.getHours(), civil.getMinutes(), civil.getSeconds()),
    zoneLabel: `${p.timeZoneName} · ${city}`,
  }
}

export function formatZone(date: Date, label: string, timeZone: string): ClockZone {
  const civil = civilDate(date, timeZone)
  const hours = civil.getHours()
  return {
    id: timeZone,
    label,
    time: clock12(hours, civil.getMinutes()),
    day: civil.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    night: hours >= 18 || hours < 6,
  }
}

function parseStamp(value: string | null): Date | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatEventTime(raw: string | null, start: Date | null) {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'all day'
  if (!start) return ''
  const h12 = start.getHours() % 12 || 12
  const ap = start.getHours() >= 12 ? 'pm' : 'am'
  return `${h12}:${pad(start.getMinutes())}${ap}`
}

export function upcomingEvents(events: CalendarEventInput[], now: Date, limit = 3): UpcomingEvent[] {
  return events
    .map((event) => ({
      event,
      start: parseStamp(event.startAt),
      end: parseStamp(event.endAt),
    }))
    .filter((row) => {
      if (row.end) return row.end.getTime() >= now.getTime()
      if (row.start) return row.start.getTime() >= now.getTime()
      return false
    })
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0))
    .slice(0, limit)
    .map((row) => ({
      id: row.event.id,
      title: row.event.title,
      time: formatEventTime(row.event.startAt, row.start),
      link: row.event.link,
    }))
}

export function googleCalendarUrl(link: string | null | undefined) {
  return link || 'https://calendar.google.com/calendar/r'
}
