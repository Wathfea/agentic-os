# Brain Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-viewport Brain graph on `/brain` (wiki pages + wikilinks), and retire the Graph nav item by moving Graphify query onto Projects.

**Architecture:** `brain-graph-service` walks a vault root and emits DTOs. Two GET routes. Dashboard `BrainMap` uses cytoscape `preset` positions from `layoutBrainGraph`. Inspector/reader/ops drawer live on `BrainPage`. Graphify viewer stays on Home and Projects.

**Tech Stack:** Bun, Hono, Vue 3, TanStack Query, cytoscape 3, bun:test.

**Spec:** `docs/superpowers/specs/2026-09-14-brain-graph-design.md`

## Global Constraints

- DTO classes for every API request/response. No fs objects in JSON.
- No new npm dependency. Cytoscape is already installed.
- No comments or docblocks in code.
- Do not change `GraphViewer.vue`.
- Do not draw Graphify nodes on the Brain map.
- Do not add a markdown library; reader is `<pre>`.
- Do not commit unless the user asks.
- Tests: `bun test <file>`.

## File map

Create:

- `packages/server/src/services/brain-graph-service.ts` — walk vault, parse wikilinks, read one page
- `packages/server/src/services/brain-graph-service.test.ts`
- `apps/dashboard/src/lib/brain-layout.ts` — polar sector positions
- `apps/dashboard/src/lib/brain-layout.test.ts`
- `apps/dashboard/src/components/BrainMap.vue`
- `apps/dashboard/src/components/GraphQueryPanel.vue`

Modify:

- `packages/server/src/dto/brain.dto.ts`
- `packages/server/src/routes/brain.ts`
- `packages/server/src/services/brain-service.ts`
- `apps/dashboard/src/lib/api.ts`
- `apps/dashboard/src/pages/BrainPage.vue`
- `apps/dashboard/src/pages/ProjectsPage.vue`
- `apps/dashboard/src/router.ts`
- `apps/dashboard/src/lib/orbit.ts`
- `apps/dashboard/src/components/AppShell.vue`
- `apps/dashboard/src/assets/main.css`

Delete:

- `apps/dashboard/src/pages/GraphPage.vue`

---

### Task 1: Brain graph builder

**Files:**

- Create: `packages/server/src/services/brain-graph-service.ts`
- Create: `packages/server/src/services/brain-graph-service.test.ts`
- Modify: `packages/server/src/services/brain-service.ts` (`computeOrphans` uses `parseWikilinkTargets`)

**Interfaces:**

- Consumes: `node:fs`, `node:path`
- Produces:
  - `export type BrainGraphLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'`
  - `export function parseWikilinkTargets(content: string): string[]`
  - `export function layerForPath(rel: string): BrainGraphLayer | null`
  - `export function buildBrainGraph(vaultRoot: string): { nodes: Array<{ id: string; label: string; layer: BrainGraphLayer; path: string; bytes: number }>; edges: Array<{ id: string; source: string; target: string }> }`
  - `export function readBrainPage(vaultRoot: string, relativePath: string): { path: string; title: string; layer: BrainGraphLayer; body: string; bytes: number }`
  - `readBrainPage` throws `Error` with message `invalid path` | `not found` | `not allowed`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/services/brain-graph-service.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/server/src/services/brain-graph-service.test.ts`

Expected: FAIL (cannot find module `./brain-graph-service.js`)

- [ ] **Step 3: Write implementation**

Create `packages/server/src/services/brain-graph-service.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export type BrainGraphLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'

export type BrainGraphNodeRecord = {
  id: string
  label: string
  layer: BrainGraphLayer
  path: string
  bytes: number
}

export type BrainGraphEdgeRecord = {
  id: string
  source: string
  target: string
}

export type BrainPageRecord = {
  path: string
  title: string
  layer: BrainGraphLayer
  body: string
  bytes: number
}

export function parseWikilinkTargets(content: string): string[] {
  const out: string[] = []
  for (const match of content.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    let raw = (match[1] ?? '').trim()
    const pipe = raw.indexOf('|')
    if (pipe >= 0) raw = raw.slice(0, pipe).trim()
    const hash = raw.indexOf('#')
    if (hash >= 0) raw = raw.slice(0, hash).trim()
    if (raw) out.push(raw.replaceAll('\\', '/'))
  }
  return out
}

export function layerForPath(rel: string): BrainGraphLayer | null {
  if (rel === 'index.md') return 'index'
  if (rel === 'wiki/overview.md') return 'overview'
  if (rel.startsWith('wiki/sources/')) return 'sources'
  if (rel.startsWith('wiki/entities/')) return 'entities'
  if (rel.startsWith('wiki/concepts/')) return 'concepts'
  if (rel.startsWith('wiki/projects/')) return 'projects'
  return null
}

function toPosix(rel: string): string {
  return rel.split(sep).join('/')
}

function fileLabel(rel: string): string {
  const base = rel.split('/').pop() ?? rel
  return base.replace(/\.md$/, '')
}

function shouldSkipRel(rel: string): boolean {
  const base = rel.split('/').pop() ?? rel
  if (base === 'README.md') return true
  if (base === 'index.md' && rel !== 'index.md') return true
  if (rel.startsWith('wiki/handoffs/')) return true
  return false
}

function listCandidateFiles(vaultRoot: string): string[] {
  const out: string[] = []
  const indexPath = join(vaultRoot, 'index.md')
  if (existsSync(indexPath)) out.push(indexPath)
  const wikiDir = join(vaultRoot, 'wiki')
  if (!existsSync(wikiDir)) return out
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name.endsWith('.md')) out.push(full)
    }
  }
  walk(wikiDir)
  return out
}

function resolveTarget(
  target: string,
  sourceRel: string,
  byPath: Map<string, BrainGraphNodeRecord>,
): string | null {
  const normalized = target.replace(/\.md$/, '')
  const exact = byPath.get(target) ?? byPath.get(`${normalized}.md`)
  if (exact) return exact.id
  const sourceDir = sourceRel.split('/').slice(0, -1).join('/')
  const nodes = [...byPath.values()]
  const suffixHits = nodes.filter((node) => {
    const noMd = node.path.replace(/\.md$/, '')
    return (
      noMd === normalized ||
      noMd.endsWith(`/${normalized}`) ||
      node.path.endsWith(`/${normalized}.md`)
    )
  })
  if (suffixHits.length === 1) return suffixHits[0]!.id
  if (suffixHits.length > 1) {
    const local = suffixHits.filter((node) => node.path.startsWith(`${sourceDir}/`))
    if (local.length === 1) return local[0]!.id
  }
  const base = normalized.split('/').pop() ?? normalized
  const baseHits = nodes.filter((node) => fileLabel(node.path) === base)
  if (baseHits.length === 1) return baseHits[0]!.id
  if (baseHits.length > 1) {
    const local = baseHits.filter((node) => node.path.startsWith(`${sourceDir}/`))
    if (local.length === 1) return local[0]!.id
  }
  return null
}

export function buildBrainGraph(vaultRoot: string): {
  nodes: BrainGraphNodeRecord[]
  edges: BrainGraphEdgeRecord[]
} {
  if (!existsSync(vaultRoot)) return { nodes: [], edges: [] }
  const nodes: BrainGraphNodeRecord[] = []
  for (const full of listCandidateFiles(vaultRoot)) {
    const rel = toPosix(relative(vaultRoot, full))
    if (shouldSkipRel(rel)) continue
    const layer = layerForPath(rel)
    if (!layer) continue
    const stat = statSync(full)
    nodes.push({
      id: rel,
      label: fileLabel(rel),
      layer,
      path: rel,
      bytes: stat.size,
    })
  }
  const byPath = new Map(nodes.map((node) => [node.path, node]))
  const seen = new Set<string>()
  const edges: BrainGraphEdgeRecord[] = []
  for (const node of nodes) {
    const content = readFileSync(join(vaultRoot, node.path), 'utf-8')
    for (const target of parseWikilinkTargets(content)) {
      const resolved = resolveTarget(target, node.path, byPath)
      if (!resolved || resolved === node.id) continue
      const [source, dest] = node.id < resolved ? [node.id, resolved] : [resolved, node.id]
      const id = `${source}-->${dest}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({ id, source, target: dest })
    }
  }
  return { nodes, edges }
}

function assertInsideVault(vaultRoot: string, relativePath: string): string {
  if (!relativePath || relativePath.includes('\0')) throw new Error('invalid path')
  const posix = relativePath.replaceAll('\\', '/')
  if (posix.startsWith('/') || posix.split('/').includes('..')) throw new Error('invalid path')
  const resolved = resolve(vaultRoot, posix)
  const rel = toPosix(relative(vaultRoot, resolved))
  if (rel.startsWith('../') || rel === '..') throw new Error('invalid path')
  return rel
}

export function readBrainPage(vaultRoot: string, relativePath: string): BrainPageRecord {
  const rel = assertInsideVault(vaultRoot, relativePath)
  const layer = layerForPath(rel)
  if (!layer || shouldSkipRel(rel)) throw new Error('not allowed')
  const full = join(vaultRoot, rel)
  if (!existsSync(full)) throw new Error('not found')
  const body = readFileSync(full, 'utf-8')
  return {
    path: rel,
    title: fileLabel(rel),
    layer,
    body,
    bytes: statSync(full).size,
  }
}
```

In `packages/server/src/services/brain-service.ts`, add import `parseWikilinkTargets` from `./brain-graph-service.js` and replace the matchAll loop in `computeOrphans` with:

```ts
for (const target of parseWikilinkTargets(content)) {
  linked.add(target.split('/').pop() ?? '')
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `bun test packages/server/src/services/brain-graph-service.test.ts`

Expected: PASS, all tests.

Also run: `bun test packages/server/src/dto/briefing.dto.test.ts`

Expected: PASS (orphan helper change must not break other tests).

---

### Task 2: DTOs and GET routes

**Files:**

- Modify: `packages/server/src/dto/brain.dto.ts`
- Modify: `packages/server/src/routes/brain.ts`

**Interfaces:**

- Consumes: `buildBrainGraph`, `readBrainPage` from Task 1; `BRAIN_DIR` from `../config.js`
- Produces JSON:
  - `GET /api/brain/graph` → `{ graph: { nodes, edges, nodeCount, edgeCount } }`
  - `GET /api/brain/page?path=` → `{ page: { path, title, layer, body, bytes } }` or 400/404

- [ ] **Step 1: Add DTOs**

Append to `packages/server/src/dto/brain.dto.ts`:

```ts
import type { BrainGraphLayer } from '../services/brain-graph-service.js'

export class BrainGraphNodeDto {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly layer: BrainGraphLayer,
    public readonly path: string,
    public readonly bytes: number,
  ) {}

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      layer: this.layer,
      path: this.path,
      bytes: this.bytes,
    }
  }
}

export class BrainGraphEdgeDto {
  constructor(
    public readonly id: string,
    public readonly source: string,
    public readonly target: string,
  ) {}

  toJSON() {
    return { id: this.id, source: this.source, target: this.target }
  }
}

export class BrainGraphDto {
  constructor(
    public readonly nodes: BrainGraphNodeDto[],
    public readonly edges: BrainGraphEdgeDto[],
  ) {}

  toJSON() {
    return {
      nodes: this.nodes.map((node) => node.toJSON()),
      edges: this.edges.map((edge) => edge.toJSON()),
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length,
    }
  }
}

export class BrainPageDto {
  constructor(
    public readonly path: string,
    public readonly title: string,
    public readonly layer: BrainGraphLayer,
    public readonly body: string,
    public readonly bytes: number,
  ) {}

  toJSON() {
    return {
      path: this.path,
      title: this.title,
      layer: this.layer,
      body: this.body,
      bytes: this.bytes,
    }
  }
}
```

- [ ] **Step 2: Add routes**

In `packages/server/src/routes/brain.ts` import `BRAIN_DIR` from `../config.js`, the new DTOs, and `buildBrainGraph` / `readBrainPage`. Add:

```ts
brainRoutes.get('/brain/graph', (c) => {
  const built = buildBrainGraph(BRAIN_DIR)
  const graph = new BrainGraphDto(
    built.nodes.map(
      (node) => new BrainGraphNodeDto(node.id, node.label, node.layer, node.path, node.bytes),
    ),
    built.edges.map((edge) => new BrainGraphEdgeDto(edge.id, edge.source, edge.target)),
  )
  return c.json({ graph: graph.toJSON() })
})

brainRoutes.get('/brain/page', (c) => {
  const path = c.req.query('path')?.trim() ?? ''
  if (!path) return c.json({ error: 'Path is required' }, 400)
  try {
    const page = readBrainPage(BRAIN_DIR, path)
    return c.json({
      page: new BrainPageDto(page.path, page.title, page.layer, page.body, page.bytes).toJSON(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read page'
    if (message === 'invalid path') return c.json({ error: message }, 400)
    if (message === 'not found' || message === 'not allowed') return c.json({ error: message }, 404)
    return c.json({ error: message }, 400)
  }
})
```

Keep existing POST routes.

- [ ] **Step 3: Typecheck server**

Run: `bun run --filter @agentic/server build`

Expected: `tsc` exits 0.

---

### Task 3: Polar layout helper

**Files:**

- Create: `apps/dashboard/src/lib/brain-layout.ts`
- Create: `apps/dashboard/src/lib/brain-layout.test.ts`

**Interfaces:**

- Consumes: node `{ id, layer }[]`
- Produces: `layoutBrainGraph(nodes) => Map<string, { x: number; y: number }>`
  - `index` at `{ x: 0, y: 0 }`
  - `overview` at radius `0.28`, angle `-Math.PI / 2`
  - `sources|entities|concepts|projects` in 90° sectors starting at `-Math.PI / 2`, radius `0.55`–`0.92`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'bun:test'
import { layoutBrainGraph, SECTOR_LAYERS } from './brain-layout'

describe('layoutBrainGraph', () => {
  it('places index at origin and overview north', () => {
    const pos = layoutBrainGraph([
      { id: 'index.md', layer: 'index' },
      { id: 'wiki/overview.md', layer: 'overview' },
    ])
    expect(pos.get('index.md')).toEqual({ x: 0, y: 0 })
    const overview = pos.get('wiki/overview.md')!
    expect(overview.x).toBeCloseTo(0, 5)
    expect(overview.y).toBeLessThan(0)
  })

  it('keeps each vault layer inside its sector', () => {
    const nodes = [
      { id: 'index.md', layer: 'index' as const },
      { id: 's1', layer: 'sources' as const },
      { id: 'e1', layer: 'entities' as const },
      { id: 'c1', layer: 'concepts' as const },
      { id: 'p1', layer: 'projects' as const },
    ]
    const pos = layoutBrainGraph(nodes)
    for (const [i, layer] of SECTOR_LAYERS.entries()) {
      const p = pos.get(nodes[i + 1]!.id)!
      const angle = Math.atan2(p.y, p.x)
      const start = -Math.PI / 2 + i * (Math.PI / 2)
      const end = start + Math.PI / 2
      const wrapped = angle < start - 1e-6 ? angle + Math.PI * 2 : angle
      expect(wrapped).toBeGreaterThanOrEqual(start - 1e-6)
      expect(wrapped).toBeLessThan(end + 1e-6)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/dashboard/src/lib/brain-layout.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write implementation**

```ts
export type BrainLayoutLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'

export const SECTOR_LAYERS = ['sources', 'entities', 'concepts', 'projects'] as const

export function layoutBrainGraph(
  nodes: Array<{ id: string; layer: BrainLayoutLayer }>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const byLayer = new Map<BrainLayoutLayer, string[]>()
  for (const node of nodes) {
    const list = byLayer.get(node.layer) ?? []
    list.push(node.id)
    byLayer.set(node.layer, list)
  }
  for (const id of byLayer.get('index') ?? []) positions.set(id, { x: 0, y: 0 })
  const overviewR = 0.28
  const overviewA = -Math.PI / 2
  for (const id of byLayer.get('overview') ?? []) {
    positions.set(id, { x: overviewR * Math.cos(overviewA), y: overviewR * Math.sin(overviewA) })
  }
  for (const [i, layer] of SECTOR_LAYERS.entries()) {
    const ids = byLayer.get(layer) ?? []
    const start = -Math.PI / 2 + i * (Math.PI / 2)
    const span = Math.PI / 2
    const n = ids.length
    for (const [j, id] of ids.entries()) {
      const t = n === 1 ? 0.5 : (j + 0.5) / n
      const angle = start + span * t
      const ring = n === 1 ? 0.7 : 0.55 + (0.37 * (j % 3)) / 2
      positions.set(id, { x: ring * Math.cos(angle), y: ring * Math.sin(angle) })
    }
  }
  return positions
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/dashboard/src/lib/brain-layout.test.ts`

Expected: PASS

---

### Task 4: Dashboard API client

**Files:**

- Modify: `apps/dashboard/src/lib/api.ts`

**Interfaces:**

- Consumes: Task 2 JSON shapes
- Produces:
  - `export type BrainGraphLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'`
  - `export type BrainGraphNode = { id: string; label: string; layer: BrainGraphLayer; path: string; bytes: number }`
  - `export type BrainGraphEdge = { id: string; source: string; target: string }`
  - `export type BrainGraph = { nodes: BrainGraphNode[]; edges: BrainGraphEdge[]; nodeCount: number; edgeCount: number }`
  - `export type BrainPage = { path: string; title: string; layer: BrainGraphLayer; body: string; bytes: number }`
  - `api.brainGraph: () => Promise<{ graph: BrainGraph }>`
  - `api.brainPage: (path: string) => Promise<{ page: BrainPage }>`

- [ ] **Step 1: Add types and methods**

Next to the existing `BrainStatus` type, add the types above.

On `api` object add:

```ts
brainGraph: () => apiFetch<{ graph: BrainGraph }>('/api/brain/graph'),
brainPage: (path: string) =>
  apiFetch<{ page: BrainPage }>(`/api/brain/page?path=${encodeURIComponent(path)}`),
```

- [ ] **Step 2: Confirm no other client changes**

`streamBrain`, `brainStatus`, `mirrorProjects` stay as they are.

---

### Task 5: BrainMap component

**Files:**

- Create: `apps/dashboard/src/components/BrainMap.vue`

**Interfaces:**

- Consumes: `graph: BrainGraph`, `selectedId: string | null`, `layoutBrainGraph`
- Produces: emit `select(id: string | null)`, emit `open(id: string)`, method via emit only (parent calls nothing on the component). Fly-to is parent-driven by changing `focusId` prop.

Props:

```ts
{
  graph: BrainGraph
  selectedId: string | null
  focusId: string | null
  loading: boolean
  error: string
  vaultMissing: boolean
}
```

Emits: `select`, `open`

- [ ] **Step 1: Implement BrainMap.vue**

Use cytoscape like `GraphViewer.vue`, but:

- `layout: { name: 'preset' }`
- node `position` from `layoutBrainGraph(graph.nodes)` scaled by 420 (cytoscape pixels)
- node `background-color` from layer: index `#f26b1a`, overview `#fbbf24`, sources `#2dd4bf`, entities `#e879f9`, concepts `#f472b6`, projects `#60a5fa`
- default node width/height 7; selected 12; labels `text-opacity` 0 unless `:selected`, `.hovered`, or `cy.zoom() >= 1.4`
- tap node → emit `select`; double-tap node → emit `open`; tap background → emit `select` with `null`
- watch `focusId` → `cy.animate({ fit: { eles: cy.getElementById(focusId), padding: 80 }, duration: reduce ? 0 : 280 })`
- watch `selectedId` to apply `highlighted` / `faded` classes like GraphViewer
- shell fills 100% height; reuse GraphViewer’s hex/grid overlay CSS (copy the `graph-viewer-grid` treatment); overlay HTML labels for the four `SECTOR_LAYERS` at mid-sector positions (`pointer-events: none`)
- vault missing / error / loading messages in the chrome bar
- `prefers-reduced-motion: reduce` → animationDuration 0

Do not import GraphViewer.

- [ ] **Step 2: Typecheck dashboard**

Run: `bun run --filter @agentic/dashboard build`

Expected: may fail until BrainPage uses BrainMap; if so, continue to Task 6 immediately. If BrainMap-only unused import errors, they clear in Task 6.

---

### Task 6: Brain page shell

**Files:**

- Modify: `apps/dashboard/src/components/AppShell.vue`
- Modify: `apps/dashboard/src/assets/main.css`
- Modify: `apps/dashboard/src/pages/BrainPage.vue`

**Interfaces:**

- Consumes: `api.brainGraph`, `api.brainPage`, `BrainMap`, existing ingest/query/lint mutations
- Produces: `/brain` full-viewport map with inspector, reader, ops drawer

- [ ] **Step 1: Map-mode shell**

In `AppShell.vue`:

```ts
const isMap = computed(() => route.path === '/brain')
```

Main class: `isHome ? 'command-app__main' : isMap ? 'command-app__page command-app__page--map' : 'command-app__page'`

CSS:

```css
.command-app__page--map {
  padding: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: Rewrite BrainPage.vue**

Keep existing mutations (`ingest`, `query`, `lint`, `mirror`) and `HackTerminal`.

Add:

```ts
const graphQuery = useQuery({ queryKey: ['brain-graph'], queryFn: () => api.brainGraph() })
const selectedId = ref<string | null>(null)
const focusId = ref<string | null>(null)
const openPath = ref<string | null>(null)
const drawerOpen = ref(false)

const selectedNode = computed(() => graphQuery.data.value?.graph.nodes.find((n) => n.id === selectedId.value) ?? null)
const neighbors = computed(() => {
  const graph = graphQuery.data.value?.graph
  if (!graph || !selectedId.value) return []
  const ids = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.source === selectedId.value) ids.add(edge.target)
    if (edge.target === selectedId.value) ids.add(edge.source)
  }
  return graph.nodes.filter((n) => ids.has(n.id))
})

const pageQuery = useQuery({
  queryKey: computed(() => ['brain-page', openPath.value]),
  queryFn: () => api.brainPage(openPath.value!),
  enabled: computed(() => !!openPath.value),
})
```

Layout (single full-size stage):

- `BrainMap` filling the stage
- Left inspector when `selectedNode` (label, layer, path, bytes, neighbor list, Fly to sets `focusId`, Open sets `openPath` to `selectedNode.path`)
- Right reader when `openPath` (title + `<pre>{{ page.body }}</pre>`, X clears `openPath`; error from `pageQuery`)
- Bottom-right OPS button toggles drawer containing current ingest/query/lint/mirror UI and vault readout counts
- `vaultMissing` when `status.data.value?.status.exists === false`

Inspector/reader are overlays on this page, not new files.

- [ ] **Step 3: Build dashboard**

Run: `bun run --filter @agentic/dashboard build`

Expected: `vue-tsc` and vite build exit 0.

---

### Task 7: Retire Graph nav

**Files:**

- Create: `apps/dashboard/src/components/GraphQueryPanel.vue`
- Modify: `apps/dashboard/src/pages/ProjectsPage.vue`
- Modify: `apps/dashboard/src/router.ts`
- Modify: `apps/dashboard/src/lib/orbit.ts`
- Delete: `apps/dashboard/src/pages/GraphPage.vue`

**Interfaces:**

- Consumes: existing GraphPage query/cursor UI and `api.queryGraph` / `askCursor` / `api.globalGraph`
- Produces: Projects hosts Graphify query; `/graph` redirects to `/projects`; nav has no Graph item

- [ ] **Step 1: Move query UI**

Copy the script + template from `GraphPage.vue` (example queries, mode toggle, scope, project select, question, terminal, output, global registry) into `GraphQueryPanel.vue`. Drop `PageHeader` and drop the `GraphViewer` block (`canShowGraph` section). Projects already has View graph.

Mount in `ProjectsPage.vue` after the GitHub import section:

```vue
<GraphQueryPanel />
```

- [ ] **Step 2: Router, nav, delete page**

`router.ts`:

```ts
{ path: '/graph', redirect: '/projects' },
```

Remove the `GraphPage` import.

`orbit.ts`: remove the `graph` item. Remove unused `Share2` import if nothing else uses it.

Delete `apps/dashboard/src/pages/GraphPage.vue`.

- [ ] **Step 3: Build and test**

Run:

```
bun test packages/server/src/services/brain-graph-service.test.ts
bun test apps/dashboard/src/lib/brain-layout.test.ts
bun run --filter @agentic/server build
bun run --filter @agentic/dashboard build
```

Expected: all PASS / exit 0.

Manual:

1. `http://localhost:5173/brain` — concentric sectors, pan/zoom, select inspector, open reader
2. Nav has Status, Projects, Brain, Skills — no Graph
3. `http://localhost:5173/graph` lands on Projects with the query panel
4. Home sphere and Projects View graph still show Graphify

- [ ] **Step 4: Graphify update**

From repo root:

```
export PATH="$HOME/.local/bin:$PATH"
graphify update .
```

If overwrite refused: `graphify update . --force`

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Wiki nodes + wikilink edges, skip raw/mirrors/handoffs | 1 |
| `GET /api/brain/graph` and `/page` + DTOs | 2 |
| Path sandbox | 1, 2 |
| Polar sectors, index center, overview north | 3, 5 |
| Full-viewport `/brain`, inspector, reader, drawer | 6 |
| Cytoscape, no new deps, no GraphViewer reuse | 5 |
| Graph nav retired, query on Projects, `/graph` redirect | 7 |
| Tests for builder, sandbox, layout | 1, 3 |
| `graphify update .` | 7 |
