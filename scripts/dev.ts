import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const root = join(import.meta.dirname, '..')
const win = process.platform === 'win32'

process.env.PATH = [
  join(homedir(), '.local', 'bin'),
  join(homedir(), '.bun', 'bin'),
  process.env.PATH ?? '',
]
  .filter(Boolean)
  .join(delimiter)

const configPath = join(root, 'store', 'agentic.config.json')
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      codeRoot?: string
      brainRoot?: string
    }
    if (config.codeRoot) process.env.AGENTIC_CODE_ROOT = config.codeRoot
    if (config.brainRoot) process.env.AGENTIC_BRAIN_DIR = config.brainRoot
  } catch {}
}

process.env.AGENTIC_BRAIN_LINT = '1'
process.chdir(root)

if (!existsSync(join(root, 'node_modules'))) {
  const install = spawnSync('bun', ['install'], {
    cwd: root,
    stdio: 'inherit',
    shell: win,
    env: process.env,
  })
  if (install.status !== 0) {
    process.exit(install.status ?? 1)
  }
}

const storeDir = join(root, 'store')
const tokenPath = join(storeDir, '.dashboard-token')
if (!existsSync(tokenPath)) {
  mkdirSync(storeDir, { recursive: true })
  writeFileSync(tokenPath, randomBytes(32).toString('hex'))
}

console.log(`Dashboard token: ${readFileSync(tokenPath, 'utf8').trim()}`)
console.log('API: http://127.0.0.1:3847')
console.log('UI:  http://localhost:5173')

const bun = win ? 'bun.cmd' : 'bun'
const childEnv = { ...process.env }
const server = spawn(bun, ['run', 'dev:server'], {
  cwd: root,
  stdio: 'inherit',
  shell: win,
  env: childEnv,
})
const dashboard = spawn(bun, ['run', 'dev:dashboard'], {
  cwd: root,
  stdio: 'inherit',
  shell: win,
  env: childEnv,
})

let exiting = false
function shutdown() {
  if (exiting) return
  exiting = true
  server.kill()
  dashboard.kill()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
if (win) {
  process.on('SIGBREAK', shutdown)
}

server.on('exit', (code) => {
  dashboard.kill()
  if (!exiting) process.exit(code ?? 0)
})
dashboard.on('exit', (code) => {
  server.kill()
  if (!exiting) process.exit(code ?? 0)
})
