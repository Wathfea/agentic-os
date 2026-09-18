import { describe, expect, it } from 'bun:test'
import { formatForTelegram, plainTextForTelegram, splitMessage } from './telegram-format.js'

describe('formatForTelegram', () => {
  it('turns mix section headers into HTML bold', () => {
    const html = formatForTelegram('**Email**\n9 unread\n• Invoice overdue')
    expect(html).toContain('<b>Email</b>')
    expect(html).toContain('9 unread')
    expect(html).toContain('• Invoice overdue')
  })

  it('escapes raw HTML', () => {
    expect(formatForTelegram('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;')
  })
})

describe('plainTextForTelegram', () => {
  it('strips markdown markers', () => {
    expect(plainTextForTelegram('**hello** world')).toBe('hello world')
  })
})

describe('splitMessage', () => {
  it('keeps short text as one part', () => {
    expect(splitMessage('hi', 10)).toEqual(['hi'])
  })

  it('splits on newlines before the limit', () => {
    const text = `${'a'.repeat(8)}\n${'b'.repeat(8)}`
    expect(splitMessage(text, 10)).toEqual(['aaaaaaaa', 'bbbbbbbb'])
  })
})
