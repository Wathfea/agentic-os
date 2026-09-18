const MAX_MESSAGE_LENGTH = 4096

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function plainTextForTelegram(text: string): string {
  let result = text.trim()
  result = result.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```\w*\n?/, '').replace(/```$/, '').trim(),
  )
  result = result.replace(/`([^`]+)`/g, '$1')
  result = result.replace(/<[^>]+>/g, '')
  result = result.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  result = result.replace(/\*\*(.+?)\*\*/g, '$1')
  result = result.replace(/__(.+?)__/g, '$1')
  result = result.replace(/\*(.+?)\*/g, '$1')
  result = result.replace(/~~(.+?)~~/g, '$1')
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  result = result.replace(/```+/g, '')
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export function formatForTelegram(text: string): string {
  const codeBlocks: string[] = []
  const inlineCodes: string[] = []
  let result = text.trim()

  result = result.replace(/<code>([\s\S]*?)<\/code>/gi, (_match, inner) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code>${escapeTelegramHtml(String(inner).trim())}</code>`)
    return `\x00IC${idx}\x00`
  })

  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length
    const escaped = escapeTelegramHtml(String(code).trimEnd())
    codeBlocks.push(`<pre>${escaped}</pre>`)
    return `\x00CB${idx}\x00`
  })

  result = result.replace(/```(\w*)\n?([\s\S]*)$/g, (_match, _lang, code) => {
    const idx = codeBlocks.length
    const escaped = escapeTelegramHtml(String(code).trimEnd())
    codeBlocks.push(`<pre>${escaped}</pre>`)
    return `\x00CB${idx}\x00`
  })

  result = result.replace(/`([^`\n]+)`/g, (_match, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code>${escapeTelegramHtml(code)}</code>`)
    return `\x00IC${idx}\x00`
  })

  result = escapeTelegramHtml(result)

  result = result.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
  result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  result = result.replace(/__(.+?)__/g, '<b>$1</b>')
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<i>$1</i>')
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>')
  result = result.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
  result = result.replace(/^- \[ \]/gm, '☐')
  result = result.replace(/^- \[x\]/gm, '☑')
  result = result.replace(/^---+$/gm, '')
  result = result.replace(/^\*\*\*+$/gm, '')
  result = result.replace(/```+/g, '')

  result = result.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[parseInt(idx, 10)] ?? '')
  result = result.replace(/\x00IC(\d+)\x00/g, (_m, idx) => inlineCodes[parseInt(idx, 10)] ?? '')

  return result.trim()
}

export function splitMessage(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }

    let splitAt = remaining.lastIndexOf('\n', limit)
    if (splitAt === -1 || splitAt < limit * 0.3) {
      splitAt = remaining.lastIndexOf(' ', limit)
    }
    if (splitAt === -1 || splitAt < limit * 0.3) {
      splitAt = limit
    }

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}
