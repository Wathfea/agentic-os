import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildBrainGraph,
  parseWikilinkTargets,
  readBrainPage,
} from './brain-graph-service.js'

let vault = ''

function seed() {
  vault = mkdtempSync(join(tmpdir(), 'brain-graph-'))
  writeFileSync(join(vault, 'index.md'), 'See [[src-one]] and [[alpha]].\n')
  mkdirSync(join(vault, 'wiki/sources'), { recursive: true })
  mkdirSync(join(vault, 'wiki/entities'), { recursive: true })
  mkdirSync(join(vault, 'wiki/concepts'), { recursive: true })
  mkdirSync(join(vault, 'wiki/projects/demo'), { recursive: true })
  mkdirSync(join(vault, 'wiki/handoffs'), { recursive: true })
  mkdirSync(join(vault, 'raw'), { recursive: true })
  mkdirSync(join(vault, 'projects/mirror'), { recursive: true })
  writeFileSync(join(vault, 'wiki/overview.md'), 'Hub [[alpha]]\n')
  writeFileSync(join(vault, 'wiki/sources/src-one.md'), '[[alpha|Alias]] and [[missing-page]]\n')
  writeFileSync(join(vault, 'wiki/entities/alpha.md'), '[[overview]]\n')
  writeFileSync(join(vault, 'wiki/concepts/idea.md'), 'plain\n')
  writeFileSync(join(vault, 'wiki/projects/demo/overview.md'), '[[gotchas]]\n')
  writeFileSync(join(vault, 'wiki/projects/demo/gotchas.md'), 'See [[overview]]\n')
  writeFileSync(join(vault, 'wiki/handoffs/skip-me.md'), '[[alpha]]\n')
  writeFileSync(join(vault, 'wiki/sources/README.md'), 'skip\n')
  writeFileSync(join(vault, 'raw/ignored.md'), '[[alpha]]\n')
  writeFileSync(join(vault, 'projects/mirror/index.md'), '[[alpha]]\n')
}

afterEach(() => {
  if (vault) rmSync(vault, { recursive: true, force: true })
})

describe('parseWikilinkTargets', () => {
  it('strips alias and heading', () => {
    expect(parseWikilinkTargets('[[Foo|Bar]] [[Baz#Head]]')).toEqual(['Foo', 'Baz'])
  })
})

describe('buildBrainGraph', () => {
  it('includes vault layers and skips raw, mirrors, handoffs, readme', () => {
    seed()
    const graph = buildBrainGraph(vault)
    const paths = graph.nodes.map((n) => n.path).sort()
    expect(paths).toEqual([
      'index.md',
      'wiki/concepts/idea.md',
      'wiki/entities/alpha.md',
      'wiki/overview.md',
      'wiki/projects/demo/gotchas.md',
      'wiki/projects/demo/overview.md',
      'wiki/sources/src-one.md',
    ])
    expect(graph.nodes.find((n) => n.path === 'index.md')?.layer).toBe('index')
    expect(graph.nodes.find((n) => n.path === 'wiki/overview.md')?.layer).toBe('overview')
  })

  it('resolves alias links and drops unknown targets', () => {
    seed()
    const graph = buildBrainGraph(vault)
    const ids = new Set(graph.edges.map((e) => `${e.source}::${e.target}`))
    expect(ids.has('wiki/sources/src-one.md::wiki/entities/alpha.md') || ids.has('wiki/entities/alpha.md::wiki/sources/src-one.md')).toBe(true)
    expect(graph.edges.some((e) => e.source.includes('missing') || e.target.includes('missing'))).toBe(false)
  })

  it('prefers same-directory overview for [[overview]]', () => {
    seed()
    const graph = buildBrainGraph(vault)
    const edge = graph.edges.find(
      (e) =>
        (e.source === 'wiki/projects/demo/gotchas.md' && e.target === 'wiki/projects/demo/overview.md') ||
        (e.target === 'wiki/projects/demo/gotchas.md' && e.source === 'wiki/projects/demo/overview.md'),
    )
    expect(edge).toBeTruthy()
  })

  it('returns empty graph when vault is missing', () => {
    const graph = buildBrainGraph(join(tmpdir(), 'no-such-brain-vault'))
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
  })

  it('skips symlink files whose real path is outside the vault', () => {
    seed()
    const outside = join(tmpdir(), 'brain-graph-outside-leak.md')
    writeFileSync(outside, '[[alpha]]\n')
    symlinkSync(outside, join(vault, 'wiki/sources/leak.md'))
    const graph = buildBrainGraph(vault)
    expect(graph.nodes.some((n) => n.path === 'wiki/sources/leak.md')).toBe(false)
    rmSync(outside, { force: true })
  })

  it('does not recurse on directory symlinks under wiki', () => {
    seed()
    symlinkSync(vault, join(vault, 'wiki', 'loop-to-root'))
    const start = Date.now()
    const graph = buildBrainGraph(vault)
    expect(Date.now() - start).toBeLessThan(5000)
    expect(graph.nodes.some((n) => n.path === 'index.md')).toBe(true)
    expect(graph.nodes.map((n) => n.path).sort()).toEqual([
      'index.md',
      'wiki/concepts/idea.md',
      'wiki/entities/alpha.md',
      'wiki/overview.md',
      'wiki/projects/demo/gotchas.md',
      'wiki/projects/demo/overview.md',
      'wiki/sources/src-one.md',
    ])
  })
})

describe('readBrainPage', () => {
  it('reads an allowed wiki page', () => {
    seed()
    const page = readBrainPage(vault, 'wiki/sources/src-one.md')
    expect(page.layer).toBe('sources')
    expect(page.body).toContain('[[alpha|Alias]]')
    expect(page.title).toBe('src-one')
  })

  it('reads vault index.md', () => {
    seed()
    const page = readBrainPage(vault, 'index.md')
    expect(page.layer).toBe('index')
  })

  it('rejects escape, raw, mirrors, and handoffs', () => {
    seed()
    expect(() => readBrainPage(vault, '../outside.md')).toThrow('invalid path')
    expect(() => readBrainPage(vault, 'raw/ignored.md')).toThrow('not allowed')
    expect(() => readBrainPage(vault, 'projects/mirror/index.md')).toThrow('not allowed')
    expect(() => readBrainPage(vault, 'wiki/handoffs/skip-me.md')).toThrow('not allowed')
    expect(() => readBrainPage(vault, 'wiki/sources/nope.md')).toThrow('not found')
  })

  it('rejects symlink pointing outside vault', () => {
    seed()
    const outside = join(tmpdir(), 'brain-graph-outside-secret.txt')
    writeFileSync(outside, 'SECRET_OUTSIDE')
    symlinkSync(outside, join(vault, 'wiki/sources/leak.md'))
    expect(() => readBrainPage(vault, 'wiki/sources/leak.md')).toThrow('not allowed')
    rmSync(outside, { force: true })
  })

  it('rejects symlink pointing to a disallowed path inside vault', () => {
    seed()
    symlinkSync(
      join(vault, 'wiki/handoffs/skip-me.md'),
      join(vault, 'wiki/sources/leak.md'),
    )
    expect(() => readBrainPage(vault, 'wiki/sources/leak.md')).toThrow('not allowed')
  })

  it('rejects directory paths', () => {
    seed()
    expect(() => readBrainPage(vault, 'wiki/sources')).toThrow('not allowed')
  })
})
