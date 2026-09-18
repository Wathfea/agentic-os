import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CODE_ROOT } from '../config.js'
import { CodeCandidateDto } from '../dto/project.dto.js'
import { getDb } from '../db/index.js'

export function scanCodeDirectory(): CodeCandidateDto[] {
  if (!existsSync(CODE_ROOT)) {
    return []
  }

  const registeredPaths = new Set(
    getDb()
      .prepare('SELECT path FROM projects')
      .all()
      .map((row) => String((row as { path: string }).path)),
  )

  const entries = readdirSync(CODE_ROOT, { withFileTypes: true })
  const candidates: CodeCandidateDto[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const fullPath = join(CODE_ROOT, entry.name)
    try {
      statSync(fullPath)
    } catch {
      continue
    }

    candidates.push(
      new CodeCandidateDto(
        entry.name,
        fullPath,
        existsSync(join(fullPath, '.git')),
        existsSync(join(fullPath, 'package.json')),
        existsSync(join(fullPath, 'pyproject.toml')),
        registeredPaths.has(fullPath),
      ),
    )
  }

  return candidates.sort((a, b) => a.name.localeCompare(b.name))
}
