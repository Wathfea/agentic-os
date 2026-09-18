import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { AGENTIC_ROOT, CODE_ROOT, GLOBAL_GRAPH_PATH } from '../config.js'
import { SystemHealthDto } from '../dto/system.dto.js'
import { listProjects, getSavingsSummary } from '../services/project-service.js'
import { listSkills } from '../services/skills-manager.js'
import { getLoopHealth } from '../services/loop-health-service.js'
import { runCommandSafe, runCommandSafeBare } from '../services/shell.js'

export const systemRoutes = new Hono()

systemRoutes.get('/system/health', async (c) => {
  const version = await runCommandSafe('graphify', ['--version'], process.cwd())
  const which = await runCommandSafe('which', ['graphify'], process.cwd())
  const whichBare = await runCommandSafeBare('which', ['graphify'], process.cwd())

  const dto = new SystemHealthDto(
    version && !version.includes('not found') ? version : null,
    which && !which.includes('not found') ? which.trim() : null,
    whichBare && !whichBare.includes('not found') ? whichBare.trim() : null,
    GLOBAL_GRAPH_PATH,
    CODE_ROOT,
    AGENTIC_ROOT,
    listProjects().length,
    listSkills().length,
  )

  return c.json({
    health: dto.toJSON(),
    globalGraphExists: existsSync(GLOBAL_GRAPH_PATH),
  })
})

systemRoutes.get('/system/savings', (c) => {
  return c.json({ savings: getSavingsSummary() })
})

systemRoutes.get('/system/loop-health', (c) => {
  return c.json({ loopHealth: getLoopHealth().toJSON() })
})

systemRoutes.get('/system/token', (c) => {
  return c.json({ hint: 'Token is stored in store/.dashboard-token on disk' })
})
