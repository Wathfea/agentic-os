import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { runCommand } from './shell.js'

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/.?#]+)/i)
  if (!match) {
    throw new Error('Invalid GitHub URL')
  }
  return {
    owner: match[1]!,
    repo: match[2]!.replace(/\.git$/i, ''),
  }
}

export async function cloneGitHubRepository(input: {
  url: string
  targetPath: string
  branch?: string
  shallow?: boolean
}): Promise<{ path: string; name: string }> {
  const { repo } = parseGitHubUrl(input.url)

  if (existsSync(input.targetPath)) {
    rmSync(input.targetPath, { recursive: true, force: true })
  }

  mkdirSync(dirname(input.targetPath), { recursive: true })

  const args = ['clone']
  if (input.shallow !== false) {
    args.push('--depth', '1')
  }
  if (input.branch) {
    args.push('-b', input.branch)
  }
  args.push(input.url, input.targetPath)

  await runCommand('git', args, dirname(input.targetPath))
  return { path: input.targetPath, name: repo }
}
