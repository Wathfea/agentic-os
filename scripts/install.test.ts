import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = join(import.meta.dirname, '..')
const installSh = join(root, 'scripts', 'install.sh')
const installPs1 = join(root, 'scripts', 'install.ps1')
const bootstrap = join(root, 'scripts', 'install-bootstrap.mjs')

describe('install Obsidian vault setup', () => {
  it('creates an Obsidian vault folder before the path prompt is needed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentic-vault-'))
    const vault = join(dir, 'Second Brain')
    const result = spawnSync('bash', [installSh, '--prepare-vault', vault], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('VAULT_READY')
    expect(existsSync(join(vault, '.obsidian'))).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not auto-create a vault when the user was told to create one in Obsidian', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentic-vault-manual-'))
    const vault = join(dir, 'Second Brain')
    const result = spawnSync('bash', [installSh, '--prepare-vault', vault], {
      encoding: 'utf8',
      env: { ...process.env, OBSIDIAN_VAULT_MANUAL: '1' },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('VAULT_SKIPPED')
    expect(result.stdout).not.toContain('VAULT_READY')
    expect(existsSync(join(vault, '.obsidian'))).toBe(false)
    expect(existsSync(vault)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('installs or guides Obsidian before asking for the vault path', () => {
    const sh = readFileSync(installSh, 'utf8')
    const main = sh.split('log "Detecting environment ($OS)..."')[1]
    expect(main.indexOf('ensure_obsidian')).toBeGreaterThan(-1)
    expect(main.indexOf('prepare_brain_vault')).toBeGreaterThan(-1)
    expect(main.indexOf('prompt_brain_root')).toBeGreaterThan(main.indexOf('ensure_obsidian'))
    expect(main.indexOf('prompt_brain_root')).toBeGreaterThan(main.indexOf('prepare_brain_vault'))
    expect(sh).toContain('print_obsidian_howto')
    expect(sh).toContain('https://obsidian.md/download')
    expect(sh).toContain('Create new vault')
    expect(sh).toContain('Open folder as vault')
    const howto = sh.slice(sh.indexOf('print_obsidian_howto() {'), sh.indexOf('open_obsidian_download() {'))
    expect(howto).toContain('OBSIDIAN_VAULT_MANUAL=1')
    expect(howto).not.toContain('this installer creates')
    const prepare = sh.slice(sh.indexOf('prepare_brain_vault() {'), sh.indexOf('prompt_brain_root() {'))
    expect(prepare).toContain('OBSIDIAN_VAULT_MANUAL')
  })

  it('keeps the Windows installer on the same Obsidian-then-vault order', () => {
    const ps = readFileSync(installPs1, 'utf8')
    const main = ps.split('Log "Detecting environment (Windows)..."')[1]
    expect(main.indexOf('Ensure-Obsidian')).toBeGreaterThan(-1)
    expect(main.indexOf('Prepare-BrainVault')).toBeGreaterThan(-1)
    expect(main.indexOf('Get-BrainRoot')).toBeGreaterThan(main.indexOf('Ensure-Obsidian'))
    expect(main.indexOf('Get-BrainRoot')).toBeGreaterThan(main.indexOf('Prepare-BrainVault'))
    expect(ps).toContain('Show-ObsidianHowto')
    expect(ps).toContain('https://obsidian.md/download')
    expect(ps).toContain('Create new vault')
    expect(ps).toContain('Open folder as vault')
    const howto = ps.slice(ps.indexOf('function Show-ObsidianHowto'), ps.indexOf('function Open-ObsidianDownload'))
    expect(howto).toContain('ObsidianVaultManual')
    expect(howto).not.toContain('this installer creates')
    const prepare = ps.slice(ps.indexOf('function Prepare-BrainVault'), ps.indexOf('function Get-BrainRoot'))
    expect(prepare).toContain('ObsidianVaultManual')
  })
})

describe('coworker bootstrap', () => {
  it('seeds a Karpathy vault and syncs skills with the chosen vault path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentic-boot-'))
    const vault = join(dir, 'Second Brain')
    const skillsDir = join(dir, 'skills')
    const result = spawnSync('node', [bootstrap, '--vault', vault, '--skills-dir', skillsDir], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('VAULT_SEEDED')
    expect(result.stdout).toContain('SKILLS_SYNCED')
    expect(existsSync(join(vault, 'AGENTS.md'))).toBe(true)
    expect(existsSync(join(vault, 'index.md'))).toBe(true)
    expect(existsSync(join(vault, 'log.md'))).toBe(true)
    expect(existsSync(join(vault, 'wiki', 'overview.md'))).toBe(true)
    expect(existsSync(join(vault, '.obsidian'))).toBe(true)
    const skill = readFileSync(join(skillsDir, 'second-brain', 'SKILL.md'), 'utf8')
    expect(skill).toContain(vault)
    expect(skill).not.toContain('~/SecondBrain/Second Brain')
    expect(existsSync(join(skillsDir, '.skill-index.md'))).toBe(true)
    expect(readFileSync(join(skillsDir, '.skill-index.md'), 'utf8')).toContain('task-loop')
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not overwrite an existing vault AGENTS.md', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentic-keep-'))
    const vault = join(dir, 'Second Brain')
    const skillsDir = join(dir, 'skills')
    spawnSync('node', [bootstrap, '--vault', vault, '--skills-dir', skillsDir], { encoding: 'utf8' })
    const marker = join(vault, 'AGENTS.md')
    const custom = '# keep me\n'
    writeFileSync(marker, custom)
    const result = spawnSync('node', [bootstrap, '--vault', vault, '--skills-dir', skillsDir], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(readFileSync(marker, 'utf8')).toBe(custom)
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs vault seed and skill sync after the vault path is known', () => {
    const sh = readFileSync(installSh, 'utf8')
    const main = sh.split('log "Detecting environment ($OS)..."')[1]
    expect(main.indexOf('seed_brain_and_skills')).toBeGreaterThan(main.indexOf('prompt_brain_root'))
    expect(main.indexOf('ensure_agents')).toBeGreaterThan(-1)
    expect(main.indexOf('ensure_agents')).toBeLessThan(main.indexOf('prompt_code_root'))
    expect(main.indexOf('update_graphify_repo')).toBeGreaterThan(main.indexOf('install_graphify'))
    const ps = readFileSync(installPs1, 'utf8')
    const psMain = ps.split('Log "Detecting environment (Windows)..."')[1]
    expect(psMain.indexOf('Seed-BrainAndSkills')).toBeGreaterThan(psMain.indexOf('Get-BrainRoot'))
    expect(psMain.indexOf('Ensure-Agents')).toBeLessThan(psMain.indexOf('Get-CodeRoot'))
  })

  it('syncs Claude Code skills with path rewrite and writes a project overlay', () => {
    const dir = mkdtempSync(join(root, '.tmp-agentic-claude-'))
    const vault = join(dir, 'Second Brain')
    const cursorSkills = join(dir, 'cursor-skills')
    const claudeSkills = join(dir, 'claude-skills')
    const project = join(dir, 'project')
    mkdirSync(join(project, '.cursor', 'rules'), { recursive: true })
    writeFileSync(
      join(project, 'AGENTS.md'),
      'See `.cursor/rules/graphify.mdc` and ~/.cursor/skills\n',
    )
    writeFileSync(
      join(project, '.cursor', 'rules', 'graphify.mdc'),
      '---\ndescription: graphify stub\nalwaysApply: true\n---\n\nUse graphify.\n',
    )
    const result = spawnSync(
      'node',
      [
        bootstrap,
        '--vault',
        vault,
        '--skills-dir',
        cursorSkills,
        '--claude-skills-dir',
        claudeSkills,
        '--project-root',
        project,
      ],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('CLAUDE_SKILLS_SYNCED')
    expect(result.stdout).toContain('CLAUDE_OVERLAY')
    const claudeSkill = readFileSync(join(claudeSkills, 'second-brain', 'SKILL.md'), 'utf8')
    expect(claudeSkill).toContain(vault)
    expect(claudeSkill).not.toContain('~/SecondBrain/Second Brain')
    const claudeAgentic = readFileSync(join(claudeSkills, 'agentic-os', 'SKILL.md'), 'utf8')
    expect(claudeAgentic).toContain('.claude/skills')
    expect(claudeAgentic).not.toContain('.cursor/skills')
    expect(claudeAgentic).toContain('.claude/rules/ponytail.md')
    expect(claudeAgentic).not.toContain('.cursor/rules/ponytail.mdc')
    const claudeMd = readFileSync(join(project, 'CLAUDE.md'), 'utf8')
    expect(claudeMd).toContain('.claude/rules/graphify.md')
    expect(claudeMd).not.toContain('.cursor/rules/graphify.mdc')
    const rule = readFileSync(join(project, '.claude', 'rules', 'graphify.md'), 'utf8')
    expect(rule).toContain('description: graphify stub')
    expect(rule).not.toContain('alwaysApply')
    expect(existsSync(join(project, '.claude', 'CLAUDE.md'))).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('asks Cursor or Claude before locating or installing that app', () => {
    const sh = readFileSync(installSh, 'utf8')
    const ps = readFileSync(installPs1, 'utf8')
    expect(sh).toContain('Which coding agent do you use?')
    expect(sh).toContain('prompt_agent')
    expect(sh).toContain('ensure_one_agent')
    expect(sh).toContain('--agent')
    expect(sh).not.toContain('Preparing Cursor and Claude Code. Skills are copied for both.')
    const ensure = sh.slice(sh.indexOf('ensure_agents() {'))
    expect(ensure.indexOf('prompt_agent')).toBeGreaterThan(-1)
    expect(ensure.indexOf('prompt_agent')).toBeLessThan(ensure.indexOf('ensure_one_agent "Cursor"'))
    expect(ensure.indexOf('ensure_one_agent "Cursor"')).toBeGreaterThan(-1)
    expect(ensure.indexOf('ensure_one_agent "Claude Code"')).toBeGreaterThan(-1)
    expect(ps).toContain('Which coding agent do you use?')
    expect(ps).toContain('Get-CodingAgent')
    expect(ps).toContain('Ensure-OneAgent')
    expect(ps).toContain('[string]$Agent = ""')
    expect(ps).not.toContain('Preparing Cursor and Claude Code. Skills are copied for both.')
    expect(sh).toContain('claude_present')
    expect(sh).toContain('install_claude')
    expect(sh).toContain('.claude/skills')
    expect(sh).toContain('graphify install --platform claude')
    expect(sh).not.toContain('Cursor is required')
    expect(sh).not.toContain('graphify cursor install --project')
    expect(ps).toContain('Test-ClaudeInstalled')
    expect(ps).toContain('Install-ClaudeApp')
    expect(ps).toContain('.claude\\skills')
    expect(ps).toContain('graphify install --platform claude')
    expect(ps).not.toContain('Cursor is required')
    expect(ps).not.toContain('graphify cursor install --project')
  })
})
