import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BUILD_TMP_DIR } from '../config.js'
import { getDb } from '../db/index.js'
import { GraphJobDto, type JobKind } from '../dto/graph-job.dto.js'
import { ProjectDto } from '../dto/project.dto.js'
import {
  ensureGraphifyOutIgnored,
  hardenGraphifyProject,
  installAgenticGitignoreHooks,
  installAgenticHookWrapper,
  mirrorProjectToBrain,
  syncGlobalGraph,
} from './graphify-hooks.js'
import { cloneGitHubRepository } from './github-clone.js'
import { computeJobMetrics } from './graph-metrics.js'
import { jobEvents } from './job-events.js'
import { copyGraphifyOut } from './project-store.js'
import { getGraphJsonPath } from './project-paths.js'
import { runCommand } from './shell.js'

const MAX_LOG_CHARS = 50_000

function appendLog(jobId: string, line: string): void {
  const db = getDb()
  const row = db.prepare('SELECT log_tail FROM graph_jobs WHERE id = ?').get(jobId) as
    | { log_tail: string }
    | undefined
  const current = row?.log_tail ?? ''
  const next = (current + line + '\n').slice(-MAX_LOG_CHARS)
  db.prepare('UPDATE graph_jobs SET log_tail = ? WHERE id = ?').run(next, jobId)
  jobEvents.emitJob({ jobId, type: 'log', message: line })
}

function updateJobStatus(
  jobId: string,
  status: string,
  errorMessage?: string,
): void {
  const db = getDb()
  const finishedAt = status === 'done' || status === 'failed' ? new Date().toISOString() : null
  db.prepare(
    `UPDATE graph_jobs SET status = ?, finished_at = COALESCE(?, finished_at), error_message = COALESCE(?, error_message) WHERE id = ?`,
  ).run(status, finishedAt, errorMessage ?? null, jobId)
  jobEvents.emitJob({ jobId, type: 'status', status })
}

function countGraphNodes(project: ProjectDto): number {
  const graphPath = getGraphJsonPath(project)
  if (!existsSync(graphPath)) return 0
  try {
    const data = JSON.parse(readFileSync(graphPath, 'utf-8')) as { nodes?: unknown[] }
    return Array.isArray(data.nodes) ? data.nodes.length : 0
  } catch {
    return 0
  }
}

function persistJobMetrics(
  jobId: string,
  projectId: string,
  metrics: ReturnType<typeof computeJobMetrics>,
): void {
  const db = getDb()
  db.prepare(
    `UPDATE graph_jobs
     SET llm_used = ?, tokens_used = ?, tokens_saved = ?, cost_usd = ?, cost_saved_usd = ?
     WHERE id = ?`,
  ).run(
    metrics.llmUsed ? 1 : 0,
    metrics.tokensUsed,
    metrics.tokensSaved,
    metrics.costUsd,
    metrics.costSavedUsd,
    jobId,
  )

  db.prepare(
    `UPDATE projects
     SET total_tokens_saved = total_tokens_saved + ?,
         total_tokens_used = total_tokens_used + ?,
         total_cost_saved_usd = total_cost_saved_usd + ?,
         total_cost_used_usd = total_cost_used_usd + ?
     WHERE id = ?`,
  ).run(
    metrics.tokensSaved,
    metrics.tokensUsed,
    metrics.costSavedUsd,
    metrics.costUsd,
    projectId,
  )
}

async function runGraphifyBuild(
  projectPath: string,
  kind: JobKind,
  log: (line: string) => void,
  options: { installHooks: boolean },
): Promise<boolean> {
  let usedLlm = false

  if (kind === 'full' || kind === 'hooks_only') {
    if (kind === 'full') {
      log(`Running graphify update (code AST, no LLM) in ${projectPath}`)
      await runCommand('graphify', ['update', '.', '--force'], projectPath, log)

      const hasLlmKey = Boolean(
        process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.OPENAI_API_KEY,
      )
      if (hasLlmKey) {
        usedLlm = true
        log('LLM key detected — running semantic extract for docs')
        await runCommand('graphify', ['extract', '.', '--no-viz', '--update'], projectPath, log)
      } else {
        log('No LLM key — AST-only build, tokens saved')
      }

      log('Installing Cursor graphify rule')
      await runCommand('graphify', ['cursor', 'install', '--project'], projectPath, log)
    }

    if (options.installHooks) {
      if (existsSync(join(projectPath, '.git'))) {
        log('Installing graphify git hooks')
        await runCommand('graphify', ['hook', 'install'], projectPath, log)
      } else {
        log('Skipping git hooks — no git repository found')
      }
    }
  }

  if (kind === 'update') {
    log('Running graphify update (AST-only, no LLM)')
    await runCommand('graphify', ['update', '.'], projectPath, log)
  }

  return usedLlm
}

async function exportGraphWikiIfNeeded(
  projectPath: string,
  kind: JobKind,
  log: (line: string) => void,
): Promise<void> {
  const graphPath = join(projectPath, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) {
    return
  }

  const wikiIndex = join(projectPath, 'graphify-out', 'wiki', 'index.md')
  const shouldExport = kind === 'full' || !existsSync(wikiIndex)
  if (!shouldExport) {
    return
  }

  log('Exporting graphify wiki (graphify-out/wiki/index.md)')
  await runCommand('graphify', ['export', 'wiki'], projectPath, log)
}

async function runGitHubPipeline(
  project: ProjectDto,
  jobId: string,
  kind: JobKind,
  log: (line: string) => void,
): Promise<boolean> {
  if (!project.githubUrl) {
    throw new Error('GitHub URL missing for remote project')
  }

  mkdirSync(BUILD_TMP_DIR, { recursive: true })
  const tempPath = join(BUILD_TMP_DIR, jobId)
  log(`Cloning ${project.githubUrl} into temporary build workspace`)
  await cloneGitHubRepository({
    url: project.githubUrl,
    targetPath: tempPath,
    branch: project.githubBranch ?? undefined,
  })
  ensureGraphifyOutIgnored(tempPath)
  log('Building graph in temporary clone (source will be deleted after graph export)')

  try {
    const usedLlm = await runGraphifyBuild(tempPath, kind, log, { installHooks: false })
    copyGraphifyOut(tempPath, project.path)
    log('Persisted graphify-out; temporary clone deleted')
    return usedLlm
  } finally {
    rmSync(tempPath, { recursive: true, force: true })
  }
}

async function runPipeline(
  project: ProjectDto,
  jobId: string,
  kind: JobKind,
): Promise<void> {
  const logLines: string[] = []
  const log = (line: string) => {
    logLines.push(line)
    appendLog(jobId, line)
  }
  const db = getDb()
  let usedLlm = false

  db.prepare("UPDATE projects SET graph_status = 'building' WHERE id = ?").run(project.id)
  db.prepare("UPDATE graph_jobs SET status = 'running', started_at = datetime('now') WHERE id = ?").run(
    jobId,
  )
  jobEvents.emitJob({ jobId, type: 'status', status: 'running' })

  try {
    if (project.sourceType === 'github') {
      usedLlm = await runGitHubPipeline(project, jobId, kind, log)
      await exportGraphWikiIfNeeded(project.path, kind, log)
    } else {
      ensureGraphifyOutIgnored(project.path)
      log('Ensured graphify-out/ is listed in .gitignore')
      usedLlm = await runGraphifyBuild(project.path, kind, log, { installHooks: true })
      await exportGraphWikiIfNeeded(project.path, kind, log)
      if (kind === 'full' || kind === 'hooks_only') {
        await installAgenticHookWrapper(project.path, project.alias, log)
        installAgenticGitignoreHooks(project.path, log)
        db.prepare('UPDATE projects SET hooks_installed = 1 WHERE id = ?').run(project.id)
      }
    }

    log(`Registering global graph alias: ${project.alias}`)
    await syncGlobalGraph(project.path, project.alias, log)

    await hardenGraphifyProject(project.path, log, project.name)

    log('Mirroring graph into Second Brain vault')
    await mirrorProjectToBrain(project.name, project.path, log)

    const nodeCount = countGraphNodes(project)
    db.prepare(
      `UPDATE projects SET graph_status = 'ready', graph_node_count = ?, last_built_at = datetime('now') WHERE id = ?`,
    ).run(nodeCount, project.id)

    const metrics = computeJobMetrics({
      kind,
      log: logLines.join('\n'),
      nodeCount,
      usedLlm,
    })
    persistJobMetrics(jobId, project.id, metrics)
    log(
      `Metrics: saved ${metrics.tokensSaved} tokens ($${metrics.costSavedUsd.toFixed(4)}), used ${metrics.tokensUsed} tokens ($${metrics.costUsd.toFixed(4)})`,
    )

    updateJobStatus(jobId, 'done')
    jobEvents.emitJob({ jobId, type: 'done' })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log(`ERROR: ${message}`)
    db.prepare("UPDATE projects SET graph_status = 'error' WHERE id = ?").run(project.id)
    updateJobStatus(jobId, 'failed', message)
    jobEvents.emitJob({ jobId, type: 'error', message })
  }
}

export function enqueueGraphJob(projectId: string, kind: JobKind = 'full'): GraphJobDto {
  const db = getDb()
  const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
  if (!projectRow) {
    throw new Error('Project not found')
  }

  const project = ProjectDto.fromRow(projectRow as Record<string, unknown>)
  const jobId = randomUUID()

  db.prepare(
    `INSERT INTO graph_jobs (id, project_id, kind, status) VALUES (?, ?, ?, 'queued')`,
  ).run(jobId, projectId, kind)

  const job = GraphJobDto.fromRow(
    db.prepare('SELECT * FROM graph_jobs WHERE id = ?').get(jobId) as Record<string, unknown>,
  )

  setImmediate(() => {
    void runPipeline(project, jobId, kind)
  })

  return job
}

export function getJob(jobId: string): GraphJobDto | null {
  const row = getDb().prepare('SELECT * FROM graph_jobs WHERE id = ?').get(jobId)
  if (!row) return null
  return GraphJobDto.fromRow(row as Record<string, unknown>)
}

export function listRecentJobs(limit = 20): GraphJobDto[] {
  const rows = getDb()
    .prepare('SELECT * FROM graph_jobs ORDER BY started_at DESC NULLS LAST, rowid DESC LIMIT ?')
    .all(limit)
  return rows.map((row) => GraphJobDto.fromRow(row as Record<string, unknown>))
}

export function markProjectFresh(projectId: string): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    | Record<string, unknown>
    | undefined
  if (!row) return

  const project = ProjectDto.fromRow(row)
  const nodeCount = countGraphNodes(project)
  db.prepare(
    `UPDATE projects SET graph_status = 'ready', graph_node_count = ?, last_built_at = datetime('now') WHERE id = ?`,
  ).run(nodeCount, projectId)
}
