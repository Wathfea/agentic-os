import { AGENTIC_ROOT, BRIEFING_CURSOR_MODEL } from '../config.js'
import type {
  BriefingCalendarEventDto,
  BriefingEmailThreadDto,
  BriefingGeneratedActionItem,
  BriefingGeneratedPayload,
} from '../dto/briefing.dto.js'
import { fetchCalendarEvents } from './calendar-fetch-service.js'
import { runCursorAgentTask } from './cursor-agent-runner.js'
import { fetchEmailThreads } from './gmail-fetch-service.js'
import { mergeGeneratedActionItems, saveBriefingFailure, saveBriefingSuccess, saveCalendarEvents } from './briefing-store.js'

let refreshInFlight: Promise<void> | null = null

export function isBriefingRefreshInFlight(): boolean {
  return refreshInFlight !== null
}

export async function refreshBriefing(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = runBriefingRefresh().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function runBriefingRefresh(): Promise<void> {
  let emailThreads: BriefingEmailThreadDto[] = []
  let calendarEvents: BriefingCalendarEventDto[] = []

  try {
    ;[emailThreads, calendarEvents] = await Promise.all([fetchEmailThreads(), fetchCalendarEvents()])
    saveCalendarEvents(calendarEvents)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Google Workspace data'
    saveBriefingFailure('fetch_failed', message)
    throw err
  }

  try {
    const generated = await summarizeBriefingContext(emailThreads, calendarEvents)
    saveBriefingSuccess(generated.summary, calendarEvents)
    mergeGeneratedActionItems(generated.actionItems)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Briefing summarization failed'
    saveBriefingFailure('summarization_failed', message)
    throw err
  }
}

async function summarizeBriefingContext(
  emailThreads: BriefingEmailThreadDto[],
  calendarEvents: BriefingCalendarEventDto[],
): Promise<BriefingGeneratedPayload> {
  const context = {
    emailThreads: emailThreads.map((thread) => thread.toJSON()),
    calendarEvents: calendarEvents.map((event) => event.toJSON()),
  }

  const prompt = [
    'You are generating a workspace briefing from Gmail and Google Calendar context.',
    'Read-only task. Do not modify files.',
    'Return ONLY valid JSON with this exact shape:',
    '{"summary":["..."],"actionItems":[{"title":"...","sourceType":"gmail_thread|calendar_event","sourceId":"...","dueAt":"ISO-8601 or null","priority":"high|medium|low|null"}]}',
    'Rules:',
    '- summary: 3-8 concise bullets about what needs attention; weight unread email higher.',
    '- actionItems: inferred commitments only; each must reference an existing sourceId from the context.',
    '- Do not invent source IDs.',
  ].join('\n')

  try {
    const output = await runCursorAgentTask({
      prompt: `${prompt}\n\nContext JSON:\n${JSON.stringify(context)}`,
      workspace: AGENTIC_ROOT,
      mode: 'ask',
      model: BRIEFING_CURSOR_MODEL,
      bootMessage: 'GENERATING WORKSPACE BRIEFING...',
      onEvent: () => {},
    })
    return resolveGeneratedBriefing(output, emailThreads, calendarEvents)
  } catch {
    return resolveGeneratedBriefing(null, emailThreads, calendarEvents)
  }
}

export function resolveGeneratedBriefing(
  agentOutput: string | null,
  emailThreads: BriefingEmailThreadDto[],
  calendarEvents: BriefingCalendarEventDto[],
): BriefingGeneratedPayload {
  if (!agentOutput) {
    return buildLocalBriefing(emailThreads, calendarEvents)
  }
  try {
    assertNoCursorUsageLimit(agentOutput)
    return parseGeneratedPayload(agentOutput)
  } catch {
    return buildLocalBriefing(emailThreads, calendarEvents)
  }
}

export function buildLocalBriefing(
  emailThreads: BriefingEmailThreadDto[],
  calendarEvents: BriefingCalendarEventDto[],
): BriefingGeneratedPayload {
  const unread = emailThreads.filter((thread) => thread.unread)
  const mailSources = unread.length > 0 ? unread : emailThreads.slice(0, 5)
  const summary: string[] = []

  if (unread.length > 0) {
    summary.push(`${unread.length} unread email${unread.length === 1 ? '' : 's'} need attention.`)
  } else if (emailThreads.length > 0) {
    summary.push(`${emailThreads.length} recent email${emailThreads.length === 1 ? '' : 's'}, none unread.`)
  } else {
    summary.push('No recent email in the last two days.')
  }

  for (const thread of mailSources.slice(0, 5)) {
    summary.push(`${thread.subject} — ${thread.from}`)
  }

  const nextEvent = calendarEvents[0]
  if (nextEvent) {
    summary.push(`Next event: ${nextEvent.title}`)
  }

  const actionItems: BriefingGeneratedActionItem[] = [
    ...mailSources.map((thread) => ({
      title: thread.subject,
      sourceType: 'gmail_thread' as const,
      sourceId: thread.id,
      dueAt: thread.receivedAt,
      priority: thread.unread ? 'high' : 'medium',
    })),
    ...calendarEvents.slice(0, 3).map((event) => ({
      title: event.title,
      sourceType: 'calendar_event' as const,
      sourceId: event.id,
      dueAt: event.startAt,
      priority: 'medium' as const,
    })),
  ]

  return { summary, actionItems }
}

function assertNoCursorUsageLimit(output: string): void {
  const lower = output.toLowerCase()
  if (lower.includes('out of usage') || lower.includes('increase limits for faster responses')) {
    throw new Error('Cursor usage limit reached. Retry after your limit resets.')
  }
}

function parseGeneratedPayload(output: string): BriefingGeneratedPayload {
  const jsonText = extractJsonObject(output)
  const parsed = JSON.parse(jsonText) as BriefingGeneratedPayload

  if (!Array.isArray(parsed.summary)) {
    throw new Error('Briefing output missing summary array')
  }

  if (!Array.isArray(parsed.actionItems)) {
    throw new Error('Briefing output missing actionItems array')
  }

  return {
    summary: parsed.summary.filter((line) => typeof line === 'string' && line.trim()),
    actionItems: parsed.actionItems
      .filter(
        (item) =>
          item &&
          typeof item.title === 'string' &&
          (item.sourceType === 'gmail_thread' || item.sourceType === 'calendar_event') &&
          typeof item.sourceId === 'string',
      )
      .map((item) => ({
        title: item.title.trim(),
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        dueAt: item.dueAt ?? null,
        priority: item.priority ?? null,
      })),
  }
}

function extractJsonObject(output: string): string {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return extractBalancedJsonObject(fenced[1].trim())
  }

  const start = output.indexOf('{')
  if (start < 0) {
    throw new Error('Cursor agent did not return JSON briefing output')
  }

  return extractBalancedJsonObject(output.slice(start))
}

function extractBalancedJsonObject(text: string): string {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth++
      continue
    }
    if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(0, i + 1)
      }
    }
  }

  throw new Error('Cursor agent did not return JSON briefing output')
}
