import { CronExpressionParser } from 'cron-parser'

export const CRON_SHAPE_RX = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?$/

function cronTimeZone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function isValidCronShape(cron: unknown): cron is string {
  if (typeof cron !== 'string') return false
  const trimmed = cron.trim()
  if (!trimmed || trimmed.length > 100) return false
  if (!CRON_SHAPE_RX.test(trimmed)) return false
  try {
    CronExpressionParser.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function computeNextRun(cronExpression: string, now = new Date()): number {
  const expr = CronExpressionParser.parse(cronExpression, {
    currentDate: now,
    tz: cronTimeZone(),
  })
  return Math.floor(expr.next().getTime() / 1000)
}

export function cronMatchesNow(
  cron: string,
  catchUpMs: number = 60_000,
  now: Date = new Date(),
  tz: string = cronTimeZone(),
): boolean {
  try {
    const expr = CronExpressionParser.parse(cron, { currentDate: now, tz })
    const prev = expr.prev()
    return now.getTime() - prev.getTime() < catchUpMs
  } catch {
    return false
  }
}
