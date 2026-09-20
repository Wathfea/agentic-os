import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

export const AGENTIC_ROOT = resolve(import.meta.dirname, '../../..')
export const STORE_DIR = join(AGENTIC_ROOT, 'store')
export const AGENTIC_CONFIG_PATH = join(STORE_DIR, 'agentic.config.json')
export const PROJECTS_STORE_DIR = join(STORE_DIR, 'projects')
export const BUILD_TMP_DIR = join(STORE_DIR, 'tmp')
export const SEED_SKILLS_DIR = join(AGENTIC_ROOT, 'seed-skills')
export const GLOBAL_SKILLS_DIR = join(homedir(), '.cursor', 'skills')
export const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills')
export const GLOBAL_GRAPH_PATH = join(homedir(), '.graphify', 'global-graph.json')
export const PORT = Number(process.env.AGENTIC_PORT ?? 3847)
export const GRAPHIFY_BIN = process.env.GRAPHIFY_BIN ?? 'graphify'
export const CURSOR_AGENT_BIN = process.env.CURSOR_AGENT_BIN ?? 'cursor-agent'
export const BRIEFING_CURSOR_MODEL = process.env.BRIEFING_CURSOR_MODEL ?? 'auto'

interface AgenticConfigFile {
  codeRoot?: string
  brainRoot?: string
  installedAt?: string
  graphifyVersion?: string
  googleClientId?: string
  googleClientSecret?: string
}

function loadAgenticConfig(): AgenticConfigFile {
  if (!existsSync(AGENTIC_CONFIG_PATH)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(AGENTIC_CONFIG_PATH, 'utf-8')) as AgenticConfigFile
  } catch {
    return {}
  }
}

const agenticConfig = loadAgenticConfig()

const PROJECT_ROOT_CANDIDATES = ['Projects', 'Developer', 'dev', 'src', 'code'] as const

export function detectDefaultCodeRoot(home = homedir()): string {
  for (const name of PROJECT_ROOT_CANDIDATES) {
    const candidate = join(home, name)
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return home
}

export const CODE_ROOT = resolve(
  process.env.AGENTIC_CODE_ROOT ?? agenticConfig.codeRoot ?? detectDefaultCodeRoot(),
)

export const BRAIN_DIR = resolve(
  process.env.AGENTIC_BRAIN_DIR ??
    agenticConfig.brainRoot ??
    join(homedir(), 'SecondBrain', 'Second Brain'),
)

const homeDir = homedir()
export const BRAIN_DIR_DISPLAY =
  BRAIN_DIR === homeDir
    ? '~'
    : BRAIN_DIR.startsWith(homeDir + '/') || BRAIN_DIR.startsWith(homeDir + '\\')
      ? `~/${BRAIN_DIR.slice(homeDir.length + 1).replaceAll('\\', '/')}`
      : BRAIN_DIR

function buildPathWithTools(): string {
  const segments = [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.bun', 'bin'),
    process.env.PATH ?? '',
  ]
  return segments.filter(Boolean).join(delimiter)
}

export const PATH_WITH_TOOLS = buildPathWithTools()
export const PATH_WITH_GRAPHIFY = PATH_WITH_TOOLS

const TOKEN_PATH = join(STORE_DIR, '.dashboard-token')

export function ensureStore(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true })
  }
  if (!existsSync(PROJECTS_STORE_DIR)) {
    mkdirSync(PROJECTS_STORE_DIR, { recursive: true })
  }
  if (!existsSync(BUILD_TMP_DIR)) {
    mkdirSync(BUILD_TMP_DIR, { recursive: true })
  }
  if (!existsSync(SEED_SKILLS_DIR)) {
    mkdirSync(SEED_SKILLS_DIR, { recursive: true })
  }
  if (!existsSync(TOKEN_PATH)) {
    writeFileSync(TOKEN_PATH, randomBytes(32).toString('hex'))
  }
}

export function getDashboardToken(): string {
  ensureStore()
  return readFileSync(TOKEN_PATH, 'utf-8').trim()
}

export type GoogleClientConfig = {
  clientId: string
  clientSecret: string
}

export function getGoogleClientConfig(): GoogleClientConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? agenticConfig.googleClientId
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? agenticConfig.googleClientSecret
  if (!clientId || !clientSecret) {
    return null
  }
  return { clientId, clientSecret }
}
