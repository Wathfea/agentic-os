import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = join(import.meta.dirname, '..')
const installPd = join(root, 'scripts', 'install-pd.mjs')

const RAW_FILES = [
  'raw/task-loop-skill.md',
  'raw/what-is-loop-engineering.md',
  'raw/karpathy-llm-wiki.md',
  'raw/graphify-knowledge-graph-from-codebase.md',
  'raw/README.md',
]

const WIKI_FILES = [
  'wiki/sources/task-loop-skill.md',
  'wiki/sources/what-is-loop-engineering.md',
  'wiki/sources/karpathy-llm-wiki.md',
  'wiki/sources/graphify-knowledge-graph-from-codebase.md',
  'wiki/concepts/task-loop.md',
  'wiki/concepts/loop-engineering.md',
  'wiki/concepts/llm-wiki.md',
  'wiki/concepts/knowledge-graph.md',
  'wiki/concepts/book-manager.md',
  'wiki/entities/publishdrive-pd.md',
  'wiki/entities/graphify.md',
  'wiki/entities/andrej-karpathy.md',
  'wiki/overview.md',
  'wiki/projects/pd/overview.md',
  'AGENTS.md',
]

const INDEX_LINKS = [
  '[[overview]]',
  '[[task-loop-skill]]',
  '[[what-is-loop-engineering]]',
  '[[karpathy-llm-wiki]]',
  '[[graphify-knowledge-graph-from-codebase]]',
  '[[publishdrive-pd]]',
  '[[graphify]]',
  '[[andrej-karpathy]]',
  '[[loop-engineering]]',
  '[[task-loop]]',
  '[[llm-wiki]]',
  '[[knowledge-graph]]',
  '[[book-manager]]',
]

const FORBIDDEN = /tribal-digital|vfs-vertical-flight-school|vfs-frontend|vfs-mobil|VFSAPP|shared-stacks|supabase/i

function runInstall(dir: string) {
  const pd = join(dir, 'pd')
  const brain = join(dir, 'brain')
  mkdirSync(pd, { recursive: true })
  mkdirSync(brain, { recursive: true })
  const result = spawnSync('node', [installPd, '--yes', '--pd', pd, '--brain', brain, '--agent', 'cursor'], {
    encoding: 'utf8',
    cwd: root,
  })
  return { pd, brain, result }
}

function walkMd(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walkMd(path, acc)
    else if (name.endsWith('.md')) acc.push(path)
  }
  return acc
}

describe('pd overlay vault seed', () => {
  it('seeds pd, task-loop, LLM-wiki, and Graphify raw plus wiki into an empty vault', () => {
    const dir = mkdtempSync(join(root, '.tmp-pd-install-seed-'))
    const { brain, result } = runInstall(dir)
    expect(result.status).toBe(0)
    for (const rel of [...RAW_FILES, ...WIKI_FILES]) {
      expect(existsSync(join(brain, rel))).toBe(true)
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not overwrite existing AGENTS.md, overview, or raw sources on re-run', () => {
    const dir = mkdtempSync(join(root, '.tmp-pd-install-keep-'))
    const brain = join(dir, 'brain')
    mkdirSync(join(brain, 'wiki'), { recursive: true })
    mkdirSync(join(brain, 'raw'), { recursive: true })
    writeFileSync(join(brain, 'AGENTS.md'), 'KEEP-AGENTS\n')
    writeFileSync(join(brain, 'wiki', 'overview.md'), 'KEEP-OVERVIEW\n')
    writeFileSync(join(brain, 'raw', 'task-loop-skill.md'), 'KEEP-RAW\n')
    const { result } = runInstall(dir)
    expect(result.status).toBe(0)
    expect(readFileSync(join(brain, 'AGENTS.md'), 'utf8')).toBe('KEEP-AGENTS\n')
    expect(readFileSync(join(brain, 'wiki', 'overview.md'), 'utf8')).toBe('KEEP-OVERVIEW\n')
    expect(readFileSync(join(brain, 'raw', 'task-loop-skill.md'), 'utf8')).toBe('KEEP-RAW\n')
    expect(existsSync(join(brain, 'wiki', 'concepts', 'task-loop.md'))).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('merges task-loop and LLM-method catalog links into index.md', () => {
    const dir = mkdtempSync(join(root, '.tmp-pd-install-index-'))
    const { brain, result } = runInstall(dir)
    expect(result.status).toBe(0)
    const index = readFileSync(join(brain, 'index.md'), 'utf8')
    for (const link of INDEX_LINKS) {
      expect(index).toContain(link)
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not seed Tribal Digital, VFS, or Supabase pages or wikilinks', () => {
    const dir = mkdtempSync(join(root, '.tmp-pd-install-scope-'))
    const { brain, result } = runInstall(dir)
    expect(result.status).toBe(0)
    expect(existsSync(join(brain, 'wiki', 'entities', 'tribal-digital.md'))).toBe(false)
    expect(existsSync(join(brain, 'wiki', 'entities', 'vfs-vertical-flight-school.md'))).toBe(false)
    for (const path of walkMd(join(brain, 'wiki'))) {
      const text = readFileSync(path, 'utf8')
      expect(text).not.toMatch(FORBIDDEN)
    }
    rmSync(dir, { recursive: true, force: true })
  })
})
