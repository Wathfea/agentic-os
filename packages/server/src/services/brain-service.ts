import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENTIC_ROOT, BRAIN_DIR } from '../config.js'
import {
  BrainStatusDto,
  BrainMirrorResultDto,
  BrainScaffoldResultDto,
  type BrainIngestRequestDto,
} from '../dto/brain.dto.js'
import {
  detectCursorAuthError,
  runCursorAgentTask,
  type CursorAgentEvent,
} from './cursor-agent-runner.js'
import { runCommand } from './shell.js'
import { scaffoldAllProjectWikis, scaffoldProjectWiki } from './brain-scaffold-service.js'
import { buildBrainGraph, parseWikilinkTargets } from './brain-graph-service.js'

const SKIP_FILES = new Set(['README.md', 'index.md'])

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...listMarkdown(join(dir, entry.name)))
    } else if (entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

function countFiles(dir: string, skipDirs: Set<string> = new Set()): number {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      count += countFiles(join(dir, entry.name), skipDirs)
    } else if (!SKIP_FILES.has(entry.name)) {
      count++
    }
  }
  return count
}

function countSubdirs(dir: string): number {
  if (!existsSync(dir)) return 0
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
}

function baseName(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.md$/, '')
}

function computeOrphans(wikiDir: string): number {
  const pages = listMarkdown(wikiDir)
  if (pages.length === 0) return 0
  const linked = new Set<string>()
  for (const page of pages) {
    const content = readFileSync(page, 'utf-8')
    for (const target of parseWikilinkTargets(content)) {
      linked.add(target.split('/').pop() ?? '')
    }
  }
  let orphans = 0
  for (const page of pages) {
    if (baseName(page) === 'overview') continue
    if (!linked.has(baseName(page))) orphans++
  }
  return orphans
}

function lastLogEntry(kind: string): string | null {
  const logPath = join(BRAIN_DIR, 'log.md')
  if (!existsSync(logPath)) return null
  const lines = readFileSync(logPath, 'utf-8').split('\n')
  let found: string | null = null
  for (const line of lines) {
    if (line.startsWith('## [') && line.toLowerCase().includes(`| ${kind}`)) {
      found = line.replace(/^##\s*/, '').trim()
    }
  }
  return found
}

export function getBrainStatus(): BrainStatusDto {
  const exists = existsSync(BRAIN_DIR)
  const wikiDir = join(BRAIN_DIR, 'wiki')
  return new BrainStatusDto(
    BRAIN_DIR,
    exists,
    countFiles(join(BRAIN_DIR, 'raw'), new Set(['assets'])),
    listMarkdown(wikiDir).length,
    listMarkdown(join(wikiDir, 'sources')).length,
    listMarkdown(join(wikiDir, 'entities')).length,
    listMarkdown(join(wikiDir, 'concepts')).length,
    computeOrphans(wikiDir),
    countSubdirs(join(BRAIN_DIR, 'projects')),
    lastLogEntry('ingest'),
    lastLogEntry('lint'),
  )
}

export async function ingestToBrain(
  request: BrainIngestRequestDto,
  onEvent: (event: CursorAgentEvent) => void,
): Promise<string> {
  if (!request.url && !request.path) {
    throw new Error('Provide a url or a path to ingest')
  }

  if (request.url) {
    onEvent({ type: 'log', message: `Fetching ${request.url} into raw/` })
    try {
      await runCommand(
        'graphify',
        ['add', request.url, '--dir', join(BRAIN_DIR, 'raw')],
        BRAIN_DIR,
        (line) => onEvent({ type: 'log', message: line }),
      )
    } catch (e) {
      onEvent({ type: 'log', message: `graphify add failed, agent will fetch manually: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const target = request.url ?? request.path ?? ''
  const prompt = [
    'You are the wiki librarian for this Second Brain vault. Read AGENTS.md first, then follow the second-brain skill ingest workflow.',
    `Ingest this source: ${target}`,
    request.note ? `User note: ${request.note}` : '',
    'Steps: ensure the source is saved under raw/ (fetch it if a URL and it is not there), write a summary page under wiki/sources/, integrate it into relevant wiki/entities and wiki/concepts pages, update index.md, and append a "## [DATE] ingest | Title" line to log.md.',
    'Write full prose - never compressed/caveman text into vault files. Never edit files under raw/. Cite the source.',
  ]
    .filter(Boolean)
    .join('\n')

  return runCursorAgentTask({
    prompt,
    workspace: BRAIN_DIR,
    mode: 'agent',
    bootMessage: 'INGESTING INTO SECOND BRAIN...',
    onEvent,
  })
}

const QUERY_STOPWORDS = new Set([
  'the',
  'and',
  'how',
  'does',
  'what',
  'did',
  'about',
  'from',
  'with',
  'for',
  'this',
  'that',
  'are',
  'was',
  'were',
  'you',
  'your',
  'our',
  'into',
  'have',
  'has',
  'had',
  'not',
  'but',
  'which',
  'when',
  'who',
  'why',
  'can',
  'could',
  'should',
  'would',
  'know',
  'open',
  'notes',
  'summarize',
])

function queryTerms(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !QUERY_STOPWORDS.has(term)),
    ),
  ]
}

function excerptFor(body: string, terms: string[]): string {
  const stripped = body.replace(/^---[\s\S]*?---\s*/, '')
  const lines = stripped
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const hit = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term)))
  return (hit ?? lines.slice(0, 4).join(' ')).slice(0, 400)
}

export function buildLocalBrainAnswer(vaultDir: string, question: string): string {
  const terms = queryTerms(question)
  const graph = buildBrainGraph(vaultDir)
  const scored: Array<{ path: string; score: number; excerpt: string }> = []

  for (const node of graph.nodes) {
    const body = readFileSync(join(vaultDir, node.path), 'utf-8')
    const hay = `${node.label}\n${body}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (hay.includes(term)) score++
    }
    if (node.path === 'index.md') score = Math.max(score, 1)
    if (score <= 0) continue
    scored.push({ path: node.path, score, excerpt: excerptFor(body, terms) })
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
  const index = scored.find((row) => row.path === 'index.md')
  const rest = scored.filter((row) => row.path !== 'index.md').slice(0, 5)
  const hits = index ? [index, ...rest] : rest

  if (hits.length === 0) {
    return 'Nothing in the vault matched this question.'
  }

  return [
    'Answered from vault files.',
    ...hits.map((row) => `### ${row.path}\n${row.excerpt}`),
  ].join('\n\n')
}

export function resolveBrainQuery(
  agentOutput: string | null,
  question: string,
  vaultDir: string,
): string {
  if (!agentOutput || detectCursorAuthError(agentOutput)) {
    return buildLocalBrainAnswer(vaultDir, question)
  }
  return agentOutput
}

export async function queryBrain(
  question: string,
  onEvent: (event: CursorAgentEvent) => void,
): Promise<string> {
  if (!question.trim()) {
    throw new Error('Question is required')
  }
  const prompt = [
    'You are answering from this Second Brain vault. Read index.md first to locate relevant pages, then read those pages and follow [[wikilinks]].',
    'Answer with citations to the wiki pages and raw sources used. If the answer is not in the vault, say so plainly - do not fabricate.',
    `Question: ${question}`,
  ].join('\n')

  const useLocal = (answer: string) => {
    onEvent({ type: 'log', message: 'Cursor agent unavailable. Answering from vault files.' })
    onEvent({ type: 'delta', delta: answer })
    onEvent({ type: 'done', message: answer })
    return answer
  }

  try {
    const output = await runCursorAgentTask({
      prompt,
      workspace: BRAIN_DIR,
      mode: 'ask',
      bootMessage: 'QUERYING SECOND BRAIN...',
      onEvent,
    })
    const answer = resolveBrainQuery(output, question, BRAIN_DIR)
    if (answer !== output) return useLocal(answer)
    return answer
  } catch {
    return useLocal(buildLocalBrainAnswer(BRAIN_DIR, question))
  }
}

export async function lintBrain(
  onEvent: (event: CursorAgentEvent) => void,
): Promise<string> {
  const prompt = [
    'You are linting this Second Brain vault. Read AGENTS.md, then follow the second-brain skill lint workflow.',
    'Check for: contradictions, stale claims, orphan pages, missing pages, missing cross-references, index drift, and gaps.',
    'Produce a report grouped by check, each item with a page path and a suggested fix. Do not auto-resolve contradictions or decision reversals.',
    'Append a "## [DATE] lint | summary" line to log.md. Write full prose only.',
  ].join('\n')

  return runCursorAgentTask({
    prompt,
    workspace: BRAIN_DIR,
    mode: 'agent',
    bootMessage: 'LINTING SECOND BRAIN...',
    onEvent,
  })
}

export async function mirrorProjectsToBrain(
  onLog?: (line: string) => void,
): Promise<BrainMirrorResultDto> {
  const script = join(AGENTIC_ROOT, 'scripts', 'brain-mirror.sh')
  const lines: string[] = []
  const log = (line: string) => {
    lines.push(line)
    onLog?.(line)
  }
  await runCommand('sh', [script], AGENTIC_ROOT, log, { AGENTIC_BRAIN_DIR: BRAIN_DIR })
  const mirrored = lines.filter((l) => l.startsWith('mirrored:')).length
  return new BrainMirrorResultDto(mirrored, lines.join('\n'))
}

export function scaffoldProjectWikiPages(
  name: string,
  projectPath: string,
): BrainScaffoldResultDto {
  const result = scaffoldProjectWiki(name, projectPath)
  const log =
    result.created.length > 0
      ? `scaffolded: ${name} -> ${result.created.join(', ')}`
      : `skip: ${name} (all pages exist)`
  return new BrainScaffoldResultDto(result.created.length > 0 ? 1 : 0, log)
}

export function scaffoldAllProjectWikiPages(): BrainScaffoldResultDto {
  return scaffoldAllProjectWikis()
}
