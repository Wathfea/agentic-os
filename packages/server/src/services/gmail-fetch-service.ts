import { BriefingEmailThreadDto } from '../dto/briefing.dto.js'
import { googleApiFetch } from './google-api-client.js'

const MAX_THREADS = 20

type GmailThreadListResponse = {
  threads?: Array<{ id: string; snippet?: string }>
}

type GmailThreadResponse = {
  id: string
  snippet?: string
  messages?: Array<{
    id: string
    snippet?: string
    internalDate?: string
    labelIds?: string[]
    payload?: {
      headers?: Array<{ name?: string; value?: string }>
    }
  }>
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | null {
  const match = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return match?.value ?? null
}

export async function fetchEmailThreads(): Promise<BriefingEmailThreadDto[]> {
  const listRes = await googleApiFetch(
    `/gmail/v1/users/me/threads?q=${encodeURIComponent('newer_than:2d')}&maxResults=${MAX_THREADS}`,
  )
  const list = (await listRes.json()) as GmailThreadListResponse
  const threadIds = (list.threads ?? []).map((t) => t.id).filter(Boolean)
  const threads: BriefingEmailThreadDto[] = []

  for (const threadId of threadIds) {
    const threadRes = await googleApiFetch(
      `/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    )
    const thread = (await threadRes.json()) as GmailThreadResponse
    const messages = thread.messages ?? []
    const latest = messages[messages.length - 1]
    const headers = latest?.payload?.headers
    const unread = messages.some((m) => m.labelIds?.includes('UNREAD'))

    threads.push(
      new BriefingEmailThreadDto(
        thread.id,
        headerValue(headers, 'Subject') ?? '(no subject)',
        headerValue(headers, 'From') ?? 'Unknown sender',
        latest?.internalDate ? new Date(Number(latest.internalDate)).toISOString() : null,
        thread.snippet ?? latest?.snippet ?? '',
        unread,
      ),
    )
  }

  return threads.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1
    const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : 0
    const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : 0
    return bTime - aTime
  })
}
