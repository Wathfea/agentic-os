import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { detectDefaultCodeRoot } from './config.js'

describe('detectDefaultCodeRoot', () => {
  it('uses Developer when ~/code does not exist', () => {
    const home = mkdtempSync(join(tmpdir(), 'agentic-home-'))
    mkdirSync(join(home, 'Developer'))
    expect(detectDefaultCodeRoot(home)).toBe(join(home, 'Developer'))
    rmSync(home, { recursive: true, force: true })
  })

  it('falls back to home when no candidate folders exist', () => {
    const home = mkdtempSync(join(tmpdir(), 'agentic-home-'))
    expect(detectDefaultCodeRoot(home)).toBe(home)
    rmSync(home, { recursive: true, force: true })
  })

  it('prefers Projects over code when both exist', () => {
    const home = mkdtempSync(join(tmpdir(), 'agentic-home-'))
    mkdirSync(join(home, 'Projects'))
    mkdirSync(join(home, 'code'))
    expect(detectDefaultCodeRoot(home)).toBe(join(home, 'Projects'))
    rmSync(home, { recursive: true, force: true })
  })
})
