export type WikiNodeRef = { id: string; path: string }

export function parseFrontmatter(src: string): { meta: Record<string, string>; body: string } {
  if (!src.startsWith('---')) return { meta: {}, body: src }
  const end = src.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: src }
  const raw = src.slice(4, end)
  const body = src.slice(end + 4).replace(/^\s*\n/, '')
  const meta: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const cut = line.indexOf(':')
    if (cut <= 0) continue
    const key = line.slice(0, cut).trim()
    if (!key) continue
    meta[key] = line.slice(cut + 1).trim()
  }
  return { meta, body }
}

export function resolveWikiTarget(target: string, nodes: WikiNodeRef[]): string | null {
  const normalized = target.trim().replace(/\.md$/, '').replaceAll('\\', '/')
  if (!normalized) return null
  const exact = nodes.find((node) => node.path === target || node.path === `${normalized}.md`)
  if (exact) return exact.id
  const suffixHits = nodes.filter((node) => {
    const noMd = node.path.replace(/\.md$/, '')
    return noMd === normalized || noMd.endsWith(`/${normalized}`)
  })
  if (suffixHits.length === 1) return suffixHits[0]!.id
  const base = normalized.split('/').pop() ?? normalized
  const baseHits = nodes.filter((node) => {
    const file = (node.path.split('/').pop() ?? node.path).replace(/\.md$/, '')
    return file === base
  })
  if (baseHits.length === 1) return baseHits[0]!.id
  return null
}

export function renderWikiMarkdown(src: string): { html: string; meta: Record<string, string> } {
  const { meta, body } = parseFrontmatter(src)
  const chunks: string[] = []
  if (Object.keys(meta).length) {
    chunks.push('<dl class="wiki-prose__meta">')
    for (const [key, value] of Object.entries(meta)) {
      chunks.push(`<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    }
    chunks.push('</dl>')
  }
  chunks.push(renderBlocks(body))
  return { html: chunks.join(''), meta }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function inline(value: string) {
  const placeholders: string[] = []
  const hold = (html: string) => {
    placeholders.push(html)
    return `\u0000${placeholders.length - 1}\u0000`
  }
  let out = escapeHtml(value)
  out = out.replace(/`([^`]+)`/g, (_, code: string) => hold(`<code>${code}</code>`))
  out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    const href = escapeHtml(target.trim())
    const text = escapeHtml((label ?? target).trim())
    return hold(`<a href="#" data-wiki="${href}">${text}</a>`)
  })
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, text: string, href: string) =>
    hold(`<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`),
  )
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => placeholders[Number(i)] ?? '')
}

function renderBlocks(body: string) {
  const lines = body.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.startsWith('```')) {
      const lang = escapeHtml(line.slice(3).trim())
      const code: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        code.push(lines[i] ?? '')
        i += 1
      }
      if (i < lines.length) i += 1
      out.push(`<pre class="wiki-prose__code"${lang ? ` data-lang="${lang}"` : ''}><code>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1]!.length
      out.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`)
      i += 1
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inline((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inline((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? '')) {
        quote.push((lines[i] ?? '').replace(/^\s*>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`)
      continue
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push('<hr />')
      i += 1
      continue
    }
    if (!line.trim()) {
      i += 1
      continue
    }
    const para: string[] = []
    while (i < lines.length && (lines[i] ?? '').trim() && !/^(#{1,6}\s+|```|\s*[-*]\s+|\s*\d+\.\s+|\s*>\s?)/.test(lines[i] ?? '')) {
      para.push(lines[i] ?? '')
      i += 1
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('')
}
