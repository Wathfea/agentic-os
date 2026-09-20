#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE_DIR = join(ROOT, 'templates', 'brain-vault')
const SEED_SKILLS_DIR = join(ROOT, 'seed-skills')
const VAULT_MARKERS = [
  '/Users/perluszdavid/SecondBrain/Second Brain',
  '~/SecondBrain/Second Brain',
  '$HOME/SecondBrain/Second Brain',
]
const VAULT_DIRS = [
  'raw/assets',
  'wiki/sources',
  'wiki/entities',
  'wiki/concepts',
  'wiki/projects',
  'wiki/handoffs',
  'projects',
  'inbox',
  '_templates',
  '.obsidian',
]

function die(msg) {
  process.stderr.write(`  [!] ${msg}\n`)
  process.exit(1)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function parseArgs(argv) {
  const out = { vault: '', skillsDir: '', claudeSkillsDir: '', projectRoot: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--vault') {
      out.vault = argv[++i] ?? ''
    } else if (argv[i] === '--skills-dir') {
      out.skillsDir = argv[++i] ?? ''
    } else if (argv[i] === '--claude-skills-dir') {
      out.claudeSkillsDir = argv[++i] ?? ''
    } else if (argv[i] === '--project-root') {
      out.projectRoot = argv[++i] ?? ''
    }
  }
  return out
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(path, acc)
    else acc.push(path)
  }
  return acc
}

export function rewriteSkillVaultPath(text, vault) {
  let out = text
  for (const marker of VAULT_MARKERS) {
    out = out.split(`"${marker}"`).join(`"${vault}"`)
    out = out.split(marker).join(vault)
  }
  return out
}

export function rewriteForClaude(text) {
  return text
    .split('.cursor/skills/')
    .join('.claude/skills/')
    .split('.cursor/rules/')
    .join('.claude/rules/')
    .split('~/.cursor/skills')
    .join('~/.claude/skills')
    .split('~/.cursor')
    .join('~/.claude')
    .split('.mdc')
    .join('.md')
}

function parseGlobs(fm) {
  const block = fm.match(/^globs:\s*\n((?:\s+-\s+.+\n?)+)/m)
  if (block) {
    return [...block[1].matchAll(/-\s+["']?([^"'\n]+)["']?/g)].map((m) => m[1].trim())
  }
  const inline = fm.match(/^globs:\s*\[([^\]]*)\]/m)
  if (!inline) return []
  return inline[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

export function convertRuleForClaude(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return rewriteForClaude(content)
  const fm = m[1]
  const body = rewriteForClaude(content.slice(m[0].length))
  const desc = (fm.match(/^description:\s*(.+)$/m) || [, ''])[1].trim()
  const globs = parseGlobs(fm)
  const lines = ['---']
  if (desc) lines.push(`description: ${desc}`)
  if (globs.length) {
    lines.push('paths:')
    for (const g of globs) lines.push(`  - ${JSON.stringify(g)}`)
  }
  lines.push('---', '')
  return `${lines.join('\n')}${body}`
}

function writeIfMissing(path, content) {
  if (existsSync(path)) return false
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return true
}

function applyDate(content, date) {
  return content.split('{{DATE}}').join(date)
}

export function seedVault(vault) {
  if (!vault) die('Vault path is required')
  mkdirSync(vault, { recursive: true })
  for (const rel of VAULT_DIRS) {
    mkdirSync(join(vault, rel), { recursive: true })
  }

  const date = today()
  let created = 0
  const files = walkFiles(TEMPLATE_DIR)
  for (const src of files) {
    const rel = src.slice(TEMPLATE_DIR.length).replace(/^[/\\]+/, '')
    if (writeIfMissing(join(vault, rel), applyDate(readFileSync(src, 'utf8'), date))) {
      created++
    }
  }

  const logPath = join(vault, 'log.md')
  if (!existsSync(logPath)) {
    writeFileSync(
      logPath,
      `## [${date}] ingest | Agentic OS installer\n\nSeeded an empty Second Brain vault (Karpathy LLM-wiki layout).\n`,
    )
    created++
  }

  return created
}

function parseSkillMeta(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  let name = ''
  let description = ''
  if (!match) return { name, description }
  const block = match[1]
  const nameMatch = block.match(/^name:\s*(.+)$/m)
  if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, '')
  const descMatch = block.match(/^description:\s*>?\s*([\s\S]*?)(?=\n[a-zA-Z][a-zA-Z0-9_-]*:|\n*$)/)
  if (descMatch) {
    description = descMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/^["']|["']$/g, '')
  }
  return { name, description }
}

export function writeSkillIndex(skillsDir) {
  const rows = []
  if (!existsSync(skillsDir)) return 0
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillPath = join(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const meta = parseSkillMeta(readFileSync(skillPath, 'utf8'))
    const desc = (meta.description || '').replace(/\|/g, '\\|')
    rows.push(`| \`${meta.name || entry.name}\` | ${desc} |`)
  }
  rows.sort()
  const body = [
    '# Skill Index',
    '',
    '| Skill | Description |',
    '|-------|-------------|',
    ...rows,
    '',
    `_${rows.length} skills. Generated by Agentic OS._`,
    '',
  ].join('\n')
  writeFileSync(join(skillsDir, '.skill-index.md'), body)
  return rows.length
}

export function syncSkills(vault, skillsDir, opts = {}) {
  if (!existsSync(SEED_SKILLS_DIR)) die(`Missing seed-skills at ${SEED_SKILLS_DIR}`)
  mkdirSync(skillsDir, { recursive: true })
  let count = 0
  for (const entry of readdirSync(SEED_SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const src = join(SEED_SKILLS_DIR, entry.name)
    const dest = join(skillsDir, entry.name)
    cpSync(src, dest, { recursive: true, force: true })
    for (const file of walkFiles(dest)) {
      const text = readFileSync(file, 'utf8')
      let next = rewriteSkillVaultPath(text, vault)
      if (opts.agent === 'claude') next = rewriteForClaude(next)
      if (next !== text) writeFileSync(file, next)
    }
    count++
  }
  writeSkillIndex(skillsDir)
  return count
}

export function writeClaudeProjectOverlay(projectRoot) {
  const cursorRules = join(projectRoot, '.cursor', 'rules')
  const claudeRules = join(projectRoot, '.claude', 'rules')
  let rules = 0
  if (existsSync(cursorRules)) {
    mkdirSync(claudeRules, { recursive: true })
    for (const entry of readdirSync(cursorRules, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.mdc') && !entry.name.endsWith('.md')) continue
      const destName = entry.name.replace(/\.mdc$/i, '.md')
      const dest = join(claudeRules, destName)
      if (writeIfMissing(dest, convertRuleForClaude(readFileSync(join(cursorRules, entry.name), 'utf8')))) {
        rules++
      }
    }
  }

  let agents = 0
  const agentsSrc = join(projectRoot, 'AGENTS.md')
  if (existsSync(agentsSrc)) {
    const body = rewriteForClaude(readFileSync(agentsSrc, 'utf8'))
    if (writeIfMissing(join(projectRoot, 'CLAUDE.md'), body)) agents++
    if (writeIfMissing(join(projectRoot, '.claude', 'CLAUDE.md'), body)) agents++
  }
  return { rules, agents }
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.vault) {
    die(
      'Usage: node scripts/install-bootstrap.mjs --vault <path> [--skills-dir <path>] [--claude-skills-dir <path>] [--project-root <path>]',
    )
  }
  const cursorDir = args.skillsDir || join(homedir(), '.cursor', 'skills')
  const claudeDir = args.claudeSkillsDir || (args.skillsDir ? '' : join(homedir(), '.claude', 'skills'))
  const projectRoot = args.projectRoot || (args.skillsDir || args.claudeSkillsDir ? '' : ROOT)
  const seeded = seedVault(args.vault)
  const synced = syncSkills(args.vault, cursorDir)
  process.stdout.write(`  VAULT_SEEDED ${seeded}\n`)
  process.stdout.write(`  SKILLS_SYNCED ${synced}\n`)
  if (claudeDir) {
    const claudeSynced = syncSkills(args.vault, claudeDir, { agent: 'claude' })
    process.stdout.write(`  CLAUDE_SKILLS_SYNCED ${claudeSynced}\n`)
  }
  if (projectRoot) {
    const overlay = writeClaudeProjectOverlay(projectRoot)
    process.stdout.write(`  CLAUDE_OVERLAY rules=${overlay.rules} files=${overlay.agents}\n`)
  }
}
