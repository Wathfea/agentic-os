const TOKEN_KEY = 'agentic-dashboard-token'

export function getToken(): string {
  let token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    token = prompt('Enter dashboard token (store/.dashboard-token):') ?? ''
    if (token) localStorage.setItem(TOKEN_KEY, token)
  }
  return token
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export type Project = {
  id: string
  name: string
  path: string
  alias: string
  graphStatus: string
  graphNodeCount: number
  lastBuiltAt: string | null
  hooksInstalled: boolean
  autoRebuild: boolean
  rebuildIntervalHours: number | null
  lastScheduledAt: string | null
  totalTokensSaved: number
  totalTokensUsed: number
  totalCostSavedUsd: number
  totalCostUsedUsd: number
  sourceType: 'local' | 'github'
  githubUrl: string | null
  githubBranch: string | null
  createdAt: string
}

export type CodeCandidate = {
  name: string
  path: string
  isGit: boolean
  hasPackageJson: boolean
  hasPyproject: boolean
  registered: boolean
}

export type GraphJob = {
  id: string
  projectId: string
  kind: string
  status: string
  logTail: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  llmUsed: boolean
  tokensUsed: number
  tokensSaved: number
  costUsd: number
  costSavedUsd: number
}

export type Skill = {
  id: string
  name: string
  source: string
  path: string
  description: string
  projectName: string | null
  writable: boolean
}

export type GraphData = {
  nodes: Array<{ id: string; label: string; type?: string }>
  edges: Array<{ id: string; source: string; target: string; label?: string }>
  nodeCount: number
  edgeCount: number
}

export type SavingsSummary = {
  totalTokensSaved: number
  totalTokensUsed: number
  totalCostSavedUsd: number
  totalCostUsedUsd: number
}

export type BrainStatus = {
  vaultPath: string
  exists: boolean
  rawSources: number
  wikiPages: number
  sourcePages: number
  entityPages: number
  conceptPages: number
  orphanPages: number
  mirroredProjects: number
  lastIngest: string | null
  lastLint: string | null
}

export type BrainGraphLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'

export type BrainGraphNode = {
  id: string
  label: string
  layer: BrainGraphLayer
  path: string
  bytes: number
}

export type BrainGraphEdge = {
  id: string
  source: string
  target: string
}

export type BrainGraph = {
  nodes: BrainGraphNode[]
  edges: BrainGraphEdge[]
  nodeCount: number
  edgeCount: number
}

export type BrainPage = {
  path: string
  title: string
  layer: BrainGraphLayer
  body: string
  bytes: number
}

export type BrainMirrorResult = {
  mirrored: number
  log: string
}

export type BrainScaffoldResult = {
  scaffolded: number
  log: string
}

export type LoopHealthProject = {
  projectId: string
  name: string
  alias: string
  graphStatus: string
  nodeCount: number
  graphAgeHours: number | null
  graphStale: boolean
  graphWikiPresent: boolean
  devWikiSeeded: boolean
  gotchasEmpty: boolean
  autoRebuild: boolean
  graphifyGitignoreOk: boolean
}

export type LoopHealthSummary = {
  projectCount: number
  staleGraphCount: number
  emptyGotchasCount: number
  missingWikiCount: number
  brainLintAgeHours: number | null
}

export type LoopHealth = {
  summary: LoopHealthSummary
  projects: LoopHealthProject[]
}

export type BriefingConnectionStatus = 'disconnected' | 'connected' | 'expired'

export type BriefingPipelineStatus =
  | 'disconnected'
  | 'ready'
  | 'fetch_failed'
  | 'summarization_failed'
  | 'stale'

export type BriefingActionItemStatus = 'open' | 'done' | 'dismissed'

export type BriefingActionItem = {
  id: string
  title: string
  sourceType: 'gmail_thread' | 'calendar_event'
  sourceId: string
  dueAt: string | null
  priority: string | null
  status: BriefingActionItemStatus
}

export type BriefingCalendarEvent = {
  id: string
  title: string
  startAt: string | null
  endAt: string | null
  location: string | null
  description: string | null
  link: string | null
}

export type BriefingOverview = {
  connection: {
    status: BriefingConnectionStatus
    email: string | null
    connectedAt: string | null
    googleConfigured: boolean
  }
  briefing: {
    status: BriefingPipelineStatus
    lastUpdatedAt: string | null
    statusMessage: string | null
    summary: string[]
    refreshing: boolean
  }
  actionItems: BriefingActionItem[]
  stale: boolean
  calendarEvents: BriefingCalendarEvent[]
}

export type MixSource = {
  id: string
  channelId: string
  title: string
  handle: string | null
  enabled: boolean
}

export type MixOverview = {
  telegram: {
    connected: boolean
    chatId: string | null
  }
  mix: {
    cron: string
    enabled: boolean
    lastStatus: string
    lastError: string | null
    lastRunAt: string | null
    nextRunAt: number | null
    running: boolean
  }
  sources: MixSource[]
}

export const BRAIN_QUERY_EXAMPLES = [
  'What did I decide about the second brain architecture?',
  'Summarize what I know about Graphify',
  'What are the open questions in my notes?',
  'Which concepts link to token efficiency?',
]

export const SCHEDULE_OPTIONS = [
  { label: 'OFF', value: null },
  { label: '6H', value: 6 },
  { label: '12H', value: 12 },
  { label: '24H', value: 24 },
  { label: '7D', value: 168 },
] as const

export const GRAPH_QUERY_EXAMPLES = [
  'What connects authentication to the database?',
  'Which files handle API routing?',
  'Trace the data flow from user input to storage',
  'What are the main entry points of this codebase?',
  'Which modules depend on the config layer?',
  'Explain how errors propagate through the system',
]

export const api = {
  health: () => apiFetch<{ health: Record<string, unknown>; globalGraphExists: boolean }>('/api/system/health'),
  savings: () => apiFetch<{ savings: SavingsSummary }>('/api/system/savings'),
  scanCode: () => apiFetch<{ candidates: CodeCandidate[] }>('/api/code/scan'),
  listProjects: () => apiFetch<{ projects: Project[] }>('/api/projects'),
  addProject: (body: { path: string; name?: string; alias?: string }) =>
    apiFetch<{ project: Project; jobId: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cloneProject: (body: { url: string; name?: string; alias?: string; branch?: string }) =>
    apiFetch<{ project: Project; jobId: string }>('/api/projects/clone', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeProject: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  rebuildGraph: (id: string, mode: 'full' | 'update' = 'full') =>
    apiFetch<{ job: GraphJob }>(`/api/projects/${id}/graph`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  rebuildAllGraphs: (mode: 'full' | 'update' = 'full') =>
    apiFetch<{
      queued: GraphJob[]
      skipped: Array<{ projectId: string; name: string; reason: 'busy' }>
      queuedCount: number
      skippedCount: number
    }>('/api/projects/graph/rebuild-all', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  patchProject: (
    id: string,
    body: { autoRebuild?: boolean; name?: string; rebuildIntervalHours?: number | null },
  ) =>
    apiFetch<{ project: Project }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getGraphJson: (id: string) => apiFetch<{ graph: GraphData }>(`/api/projects/${id}/graph/json`),
  listJobs: () => apiFetch<{ jobs: GraphJob[] }>('/api/jobs'),
  getJob: (id: string) => apiFetch<{ job: GraphJob }>(`/api/jobs/${id}`),
  listSkills: () => apiFetch<{ skills: Skill[] }>('/api/skills'),
  getSkill: (id: string) => apiFetch<{ skill: Skill; content: string }>(`/api/skills/${id}`),
  saveSkill: (id: string, content: string) =>
    apiFetch<{ skill: Skill }>(`/api/skills/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  createSkill: (body: { name: string; description: string; body?: string }) =>
    apiFetch<{ skill: Skill }>('/api/skills', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteSkill: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/skills/${id}`, { method: 'DELETE' }),
  syncSkills: () => apiFetch<{ synced: number }>('/api/skills/sync', { method: 'POST' }),
  queryGraph: (body: { question: string; scope?: string; projectId?: string }) =>
    apiFetch<{ result: { question: string; scope: string; output: string } }>('/api/graph/query', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  globalGraph: () =>
    apiFetch<{ entries: Array<{ alias: string; nodeCount: number; edgeCount: number }>; raw: string }>(
      '/api/graph/global',
    ),
  brainStatus: () => apiFetch<{ status: BrainStatus }>('/api/brain/status'),
  brainGraph: () => apiFetch<{ graph: BrainGraph }>('/api/brain/graph'),
  brainPage: (path: string) =>
    apiFetch<{ page: BrainPage }>(`/api/brain/page?path=${encodeURIComponent(path)}`),
  mirrorProjects: () =>
    apiFetch<{ result: BrainMirrorResult }>('/api/brain/mirror-projects', { method: 'POST' }),
  scaffoldProjects: () =>
    apiFetch<{ result: BrainScaffoldResult }>('/api/brain/scaffold-projects', { method: 'POST' }),
  loopHealth: () => apiFetch<{ loopHealth: LoopHealth }>('/api/system/loop-health'),
  briefingStatus: () => apiFetch<{ briefing: BriefingOverview }>('/api/briefing/status'),
  briefingCalendar: () => apiFetch<{ calendarEvents: BriefingCalendarEvent[] }>('/api/briefing/calendar'),
  briefingRefresh: () =>
    apiFetch<{ briefing: BriefingOverview }>('/api/briefing/refresh', { method: 'POST' }),
  briefingConnect: () => apiFetch<{ connect: { authUrl: string } }>('/api/briefing/connect'),
  briefingDisconnect: () =>
    apiFetch<{ briefing: BriefingOverview }>('/api/briefing/disconnect', { method: 'POST' }),
  briefingDismissActionItem: (id: string) =>
    apiFetch<{ briefing: BriefingOverview }>(`/api/briefing/action-items/${id}/dismiss`, {
      method: 'POST',
    }),
  briefingDoneActionItem: (id: string) =>
    apiFetch<{ briefing: BriefingOverview }>(`/api/briefing/action-items/${id}/done`, {
      method: 'POST',
    }),
  mixStatus: () => apiFetch<{ mix: MixOverview }>('/api/mix'),
  saveMix: (body: { cron?: string; enabled?: boolean }) =>
    apiFetch<{ mix: MixOverview }>('/api/mix', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  saveTelegram: (body: { botToken: string; chatId: string }) =>
    apiFetch<{ mix: MixOverview }>('/api/mix/telegram', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  disconnectTelegram: () => apiFetch<{ mix: MixOverview }>('/api/mix/telegram', { method: 'DELETE' }),
  testTelegram: () => apiFetch<{ mix: MixOverview }>('/api/mix/telegram/test', { method: 'POST' }),
  runMix: () => apiFetch<{ mix: MixOverview }>('/api/mix/run', { method: 'POST' }),
  addMixSource: (url: string) =>
    apiFetch<{ mix: MixOverview }>('/api/mix/sources', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  deleteMixSource: (id: string) =>
    apiFetch<{ mix: MixOverview }>(`/api/mix/sources/${id}`, { method: 'DELETE' }),
}

export type CursorAskEvent = {
  type: string
  message?: string
  delta?: string
}

export async function askCursor(
  body: { question: string; scope?: string; projectId?: string },
  onEvent: (event: CursorAskEvent) => void,
): Promise<string> {
  const res = await fetch('/api/graph/cursor-ask', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.error ?? `Cursor ask failed: ${res.status}`)
  }

  if (!res.body) {
    throw new Error('No response stream from Cursor ask')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const lines = chunk.split('\n')
      let eventType = 'log'
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim()
        if (line.startsWith('data:')) dataLine += line.slice(5).trim()
      }
      if (!dataLine) continue
      try {
        const event = JSON.parse(dataLine) as CursorAskEvent
        onEvent({ ...event, type: event.type ?? eventType })
        if (event.type === 'delta' && event.delta) answer += event.delta
        if (event.type === 'done' && event.message) answer = event.message
        if (event.type === 'log' && event.message) answer = event.message
      } catch {
        onEvent({ type: eventType, message: dataLine })
      }
    }
  }

  return answer
}

export async function streamBrain(
  action: 'query' | 'ingest' | 'lint',
  body: Record<string, unknown>,
  onEvent: (event: CursorAskEvent) => void,
): Promise<string> {
  const res = await fetch(`/api/brain/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.error ?? `Brain ${action} failed: ${res.status}`)
  }
  if (!res.body) {
    throw new Error('No response stream from brain')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const lines = chunk.split('\n')
      let eventType = 'log'
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim()
        if (line.startsWith('data:')) dataLine += line.slice(5).trim()
      }
      if (!dataLine) continue
      try {
        const event = JSON.parse(dataLine) as CursorAskEvent & { answer?: string }
        const type = event.type ?? eventType
        onEvent({ ...event, type })
        if (type === 'delta' && event.delta) answer += event.delta
        if (type === 'done' && event.message) answer = event.message
        if (type === 'result' && event.answer) answer = event.answer
      } catch {
        onEvent({ type: eventType, message: dataLine })
      }
    }
  }

  return answer
}

export function subscribeJobEvents(
  jobId: string,
  onEvent: (event: { type: string; message?: string; status?: string }) => void,
): () => void {
  const token = getToken()
  const source = new EventSource(`/api/jobs/${jobId}/events?token=${encodeURIComponent(token)}`)

  const types = ['log', 'status', 'done', 'error']
  for (const type of types) {
    source.addEventListener(type, (e) => {
      try {
        onEvent(JSON.parse((e as MessageEvent).data))
      } catch {
        onEvent({ type })
      }
    })
  }

  return () => source.close()
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

export function formatBriefingTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function formatTokens(value: number): string {
  return value.toLocaleString()
}
