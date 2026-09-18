import { spawn } from 'node:child_process'
import { PATH_WITH_TOOLS } from '../config.js'

export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  onLog?: (line: string) => void,
  extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PATH: PATH_WITH_TOOLS, ...extraEnv },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    const handleChunk = (chunk: Buffer, target: 'stdout' | 'stderr') => {
      const text = chunk.toString()
      if (target === 'stdout') stdout += text
      else stderr += text

      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) onLog?.(trimmed)
      }
    }

    child.stdout.on('data', (d) => handleChunk(d, 'stdout'))
    child.stderr.on('data', (d) => handleChunk(d, 'stderr'))

    child.on('error', reject)
    child.on('close', (code) => {
      const exitCode = code ?? 1
      if (exitCode !== 0) {
        reject(new Error(stderr || stdout || `Command failed with code ${exitCode}`))
        return
      }
      resolve({ stdout, stderr, code: exitCode })
    })
  })
}

export async function runCommandSafe(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  try {
    const result = await runCommand(command, args, cwd)
    return result.stdout.trim()
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export function runCommandSafeBare(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    child.on('error', () => resolve(''))
    child.on('close', (code) => {
      if (code !== 0) {
        resolve(stderr.trim() || stdout.trim() || '')
        return
      }
      resolve(stdout.trim())
    })
  })
}
