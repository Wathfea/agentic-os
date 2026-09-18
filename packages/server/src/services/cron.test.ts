import { describe, expect, it } from 'bun:test'
import { cronMatchesNow, isValidCronShape } from './cron.js'

describe('isValidCronShape', () => {
  it('accepts five-field expressions', () => {
    expect(isValidCronShape('30 7 * * *')).toBe(true)
  })

  it('rejects junk', () => {
    expect(isValidCronShape('whenever')).toBe(false)
    expect(isValidCronShape('')).toBe(false)
  })
})

describe('cronMatchesNow', () => {
  it('matches when the previous tick is inside the catch-up window', () => {
    const now = new Date('2026-09-16T07:30:20Z')
    expect(cronMatchesNow('30 7 * * *', 60_000, now, 'UTC')).toBe(true)
  })

  it('misses when the previous tick is outside the window', () => {
    const now = new Date('2026-09-16T08:00:00Z')
    expect(cronMatchesNow('30 7 * * *', 60_000, now, 'UTC')).toBe(false)
  })
})
