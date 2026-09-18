# Brain graph on `/brain`

Date: 2026-09-14

## Problem

`/brain` is ingest, query, and lint only. The operator cannot see or walk the Second Brain. `/graph` is a Graphify query page whose viewer already exists on Home and Projects.

## Goal

`/brain` is a full-viewport Brain graph: wiki pages as nodes, wikilinks as edges, concentric vault-layer sectors around `index.md`. Select inspects a node; open reads the markdown. Graphify stays a code graph. The Graph nav item goes away.

## Domain

- **Brain graph**: wiki pages + wikilinks. Not Graphify.
- **Vault layer** sectors: sources, entities, concepts, project wiki.
- **Graphify graph**: code symbols. Home sphere + Projects “View graph”. Query + Cursor ask move to Projects.

## Out of scope

- Layout switcher (Force / Hex / Rings)
- Expand / collapse all, Remove, Open on device
- Search box
- Markdown renderer library
- Drawing Graphify nodes on the Brain map
- `raw/`, Graphify mirrors under vault `projects/`, `wiki/handoffs/`, `README.md`, nested `index.md` catalogs

## Architecture

Two read APIs, no LLM.

- `GET /api/brain/graph` — nodes and edges for the map
- `GET /api/brain/page?path=` — one page body for the reader

`buildBrainGraph(vaultRoot)` and `readBrainPage(vaultRoot, relativePath)` live in `packages/server/src/services/brain-graph-service.ts`. Production passes `BRAIN_DIR`. Tests pass a fixture vault.

Dashboard: new `BrainMap.vue` (cytoscape only). `BrainPage.vue` is the shell (inspector, reader, operations drawer). `GraphViewer.vue` is unchanged.

## Graph contents

Node `id` / `path` is vault-relative POSIX path.

| Path | Layer | Placement |
| --- | --- | --- |
| `index.md` | `index` | center |
| `wiki/overview.md` | `overview` | inner ring, single hub (north) |
| `wiki/sources/**/*.md` | `sources` | sector 0 |
| `wiki/entities/**/*.md` | `entities` | sector 1 |
| `wiki/concepts/**/*.md` | `concepts` | sector 2 |
| `wiki/projects/**/*.md` | `projects` | sector 3 |

Skip: missing vault (empty graph, not an exception), `raw/`, vault `projects/` (mirrors), `wiki/handoffs/`, `README.md`, any `index.md` except vault-root `index.md`.

Node fields: `id`, `label` (filename without `.md`), `layer`, `path`, `bytes`.

### Wikilink edges

From each included page, match `[[...]]`.

1. Strip `\|alias` and `#heading`.
2. Trim. Ignore empty.
3. Resolve against included nodes only:
   - exact `path` or `path` without `.md`
   - else unique suffix (`path === target`, `path.endsWith('/' + target)`, or `path.endsWith('/' + target + '.md')`)
   - else unique basename
   - prefer a candidate in the same directory as the source when several match
4. No match or still ambiguous: no edge, no phantom node.
5. No self-edges. Undirected uniqueness: one edge per unordered pair. Edge `id` is `source-->target` with `source < target` lexicographically.

`computeOrphans` in `brain-service.ts` must use the same `[[...]]` parse helper so orphan counts and the map cannot drift.

## Page read

`GET /api/brain/page?path=wiki/concepts/llm-wiki.md`

- Missing/blank `path`: 400
- After normalize, resolved path must stay under `vaultRoot` (`..`, absolute, NUL → 400)
- Allowed files: vault-root `index.md`, or a `.md` file under `vaultRoot/wiki` that is not under `wiki/handoffs`
- Missing file: 404
- Response: `{ page: { path, title, layer, body, bytes } }`
- `body` is raw markdown. Dashboard shows it in a `<pre>`. Do not add `marked` / markdown-it.

## Dashboard map

Full viewport under CommandNav. `AppShell` page main for `/brain` has zero padding and `overflow: hidden`.

Cytoscape already in the dashboard. Do not add a renderer. Do not reuse `GraphViewer` (Graphify cose + unlabeled dots).

Positions from `layoutBrainGraph(nodes)` in `apps/dashboard/src/lib/brain-layout.ts`:

- `index`: `(0, 0)`
- `overview`: radius `0.28`, angle `-π/2`
- Other layers: equal 90° sectors starting at `-π/2 + i * π/2`, radius `0.55`–`0.92` by count in that sector
- Cytoscape `preset` layout with those positions; `minZoom` 0.08, `maxZoom` 4, wheel pan/zoom
- `prefers-reduced-motion: reduce`: no animation
- Dots unlabeled until hover, select, or zoom ≥ 1.4
- Layer name labels are overlay HTML at sector mid-angles, not cytoscape nodes
- Select: highlight node + neighborhood, fade the rest (same idea as GraphViewer)
- Tap background: clear selection, close inspector; reader stays until dismissed
- Hex/grid chrome: reuse existing dashboard hex background, not a new WebGL grid

Layer colors (ember palette): sources `#2dd4bf`, entities `#e879f9`, concepts `#f472b6`, projects `#60a5fa`, overview `#fbbf24`, index `#f26b1a`.

## Inspect and open

Click node → left inspector from graph payload (no fetch): label, layer, path, bytes, neighbor labels. Actions: Fly to (fit camera on node), Open.

Open or double-click → `GET /api/brain/page?path=` → right reader with title + body. Close with X. Fetch error stays in the reader; map stays up.

Ingest, query, lint, mirror stay in a collapsible operations drawer. They do not share the canvas.

## Graph page retirement

- Remove Graph from `ORBIT_ITEMS` (Home orbit + CommandNav)
- Router: `{ path: '/graph', redirect: '/projects' }`
- Move Graphify query + Cursor ask + global registry out of `GraphPage.vue` into `GraphQueryPanel.vue`, mounted on `ProjectsPage.vue`
- Delete `apps/dashboard/src/pages/GraphPage.vue`
- Keep `GraphViewer` on Home and Projects
- Keep `/api/graph/query`, `/api/graph/cursor-ask`, `/api/graph/global`

## Errors

| Case | Behavior |
| --- | --- |
| Vault missing | `{ graph: { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 } }`; canvas shows vault offline |
| Graph request fail | error line on canvas |
| Broken wikilink | drop edge |
| Path escape | 400 |
| Page not allowed / missing | 404 |
| Page fetch fail | reader error, map unchanged |

## Tests

Server (`bun test` on the new files):

- Fixture vault includes one page per layer, a handoff, a raw file, a Graphify mirror, a broken link, an aliased link, an ambiguous basename resolved by same-directory
- Skips handoff / raw / mirror
- Center node is `index.md`
- Edge from `[[alias]]` and `[[path\|label]]`
- No edge for unknown targets
- `readBrainPage` rejects `../`, `raw/`, `projects/`, `wiki/handoffs/`
- `readBrainPage` returns body for `wiki/sources/src-one.md` and `index.md`

Dashboard:

- `layoutBrainGraph` puts `index` at origin, `overview` north of center, each layer inside its sector
- No Vue/cytoscape snapshot tests

Manual: open `http://localhost:5173/brain`, pan/zoom, select, open a page, confirm `/graph` lands on Projects, confirm Graph is gone from nav.

## Files

Create:

- `packages/server/src/services/brain-graph-service.ts`
- `packages/server/src/services/brain-graph-service.test.ts`
- `apps/dashboard/src/lib/brain-layout.ts`
- `apps/dashboard/src/lib/brain-layout.test.ts`
- `apps/dashboard/src/components/BrainMap.vue`
- `apps/dashboard/src/components/GraphQueryPanel.vue`

Modify:

- `packages/server/src/dto/brain.dto.ts`
- `packages/server/src/routes/brain.ts`
- `packages/server/src/services/brain-service.ts` (shared wikilink parse)
- `apps/dashboard/src/lib/api.ts`
- `apps/dashboard/src/pages/BrainPage.vue`
- `apps/dashboard/src/pages/ProjectsPage.vue`
- `apps/dashboard/src/router.ts`
- `apps/dashboard/src/lib/orbit.ts`
- `apps/dashboard/src/components/AppShell.vue`
- `apps/dashboard/src/assets/main.css`

Delete:

- `apps/dashboard/src/pages/GraphPage.vue`

## Constraints

- DTO classes for API in/out. No entity/raw fs objects in responses.
- No new npm dependency.
- No comments or docblocks in code.
- Cytoscape is the renderer.
- Ponytail: shortest diff; do not genericize GraphViewer.
