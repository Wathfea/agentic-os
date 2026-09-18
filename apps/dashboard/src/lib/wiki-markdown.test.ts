import { describe, expect, it } from 'bun:test'
import { renderWikiMarkdown, resolveWikiTarget } from './wiki-markdown'

const SAMPLE = `---
type: concept
tags: [ai-coding, agents]
aliases: [AI coding feedback loops]
---

# Loop Engineering

**Summary**: The discipline of designing feedback loops.

## What it is

Loop engineering structures AI-assisted development.

See [[what-is-loop-engineering]].

- Clear objectives
- Relevant context

<script>alert(1)</script>
`

describe('renderWikiMarkdown', () => {
  it('renders frontmatter, headings, emphasis, lists, and wikilinks', () => {
    const { html, meta } = renderWikiMarkdown(SAMPLE)
    expect(meta.type).toBe('concept')
    expect(meta.tags).toBe('[ai-coding, agents]')
    expect(html).not.toContain('---')
    expect(html).toContain('<h1>')
    expect(html).toContain('Loop Engineering')
    expect(html).toContain('<strong>Summary</strong>')
    expect(html).toContain('<h2>')
    expect(html).toContain('What it is')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>')
    expect(html).toContain('data-wiki="what-is-loop-engineering"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('resolveWikiTarget', () => {
  it('matches a unique path suffix', () => {
    const nodes = [
      { id: 'wiki/concepts/loop-engineering.md', path: 'wiki/concepts/loop-engineering.md' },
      { id: 'wiki/concepts/what-is-loop-engineering.md', path: 'wiki/concepts/what-is-loop-engineering.md' },
    ]
    expect(resolveWikiTarget('what-is-loop-engineering', nodes)).toBe(
      'wiki/concepts/what-is-loop-engineering.md',
    )
  })
})
