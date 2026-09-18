import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const win = process.platform === 'win32'
const result = spawnSync(
  win ? 'powershell.exe' : 'bash',
  win
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'install.ps1')]
    : [join(root, 'scripts', 'install.sh')],
  { cwd: root, stdio: 'inherit' },
)
process.exit(result.status ?? 1)
