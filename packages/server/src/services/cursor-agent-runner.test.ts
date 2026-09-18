import { describe, expect, it } from 'bun:test'
import { detectCursorAuthError } from './cursor-agent-runner.js'

describe('detectCursorAuthError', () => {
  it('detects the Cursor CLI --print login error', () => {
    expect(
      detectCursorAuthError(
        "Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.",
      ),
    ).toBeTruthy()
  })

  it('ignores unrelated agent output', () => {
    expect(detectCursorAuthError('The vault defines [[agentic-os]] as the control plane.')).toBeNull()
  })
})
