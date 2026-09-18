import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLocalBrainAnswer, resolveBrainQuery } from './brain-service.js'

let vault = ''

function seed() {
  vault = mkdtempSync(join(tmpdir(), 'brain-query-'))
  writeFileSync(join(vault, 'index.md'), 'Catalog of [[hex-lattice]] and other notes.\n')
  mkdirSync(join(vault, 'wiki/concepts'), { recursive: true })
  writeFileSync(
    join(vault, 'wiki/concepts/hex-lattice.md'),
    'A honeycomb lattice offsets the second row by half a hex.\n',
  )
  writeFileSync(join(vault, 'wiki/concepts/unrelated.md'), 'This page is about lunch menus.\n')
}

afterEach(() => {
  if (vault) rmSync(vault, { recursive: true, force: true })
})

describe('buildLocalBrainAnswer', () => {
  it('cites matching wiki pages from the vault', () => {
    seed()
    const answer = buildLocalBrainAnswer(vault, 'How does the hex lattice tessellate?')
    expect(answer).toContain('wiki/concepts/hex-lattice.md')
    expect(answer).toContain('honeycomb')
    expect(answer).not.toContain('lunch menus')
  })
})

describe('resolveBrainQuery', () => {
  it('falls back to vault files when Cursor auth fails', () => {
    seed()
    const answer = resolveBrainQuery(
      "Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.",
      'How does the hex lattice tessellate?',
      vault,
    )
    expect(answer).toContain('wiki/concepts/hex-lattice.md')
    expect(answer).not.toContain('CURSOR_API_KEY')
  })

  it('keeps Cursor output when the agent succeeded', () => {
    seed()
    const answer = resolveBrainQuery(
      'The honeycomb tile includes an offset second row.',
      'How does the hex lattice tessellate?',
      vault,
    )
    expect(answer).toBe('The honeycomb tile includes an offset second row.')
  })
})
