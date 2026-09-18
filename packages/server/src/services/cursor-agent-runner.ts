import { spawn } from 'node:child_process'
import { CURSOR_AGENT_BIN, PATH_WITH_TOOLS } from '../config.js'

export type CursorAgentEvent = {
  type: 'boot' | 'delta' | 'log' | 'done' | 'error'
  message?: string
  delta?: string
}

export type CursorAgentMode = 'ask' | 'agent'

export async function runCursorAgentTask(input: {
  prompt: string
  workspace: string
  mode?: CursorAgentMode
  model?: string
  bootMessage?: string
  onEvent: (event: CursorAgentEvent) => void
}): Promise<string> {
  const mode: CursorAgentMode = input.mode ?? 'agent'
  const onEvent = input.onEvent

  onEvent({ type: 'boot', message: input.bootMessage ?? 'INITIALIZING CURSOR AGENT...' })

  const args = [
    '--print',
    '--trust',
    '--mode',
    mode,
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--workspace',
    input.workspace,
  ]

  const model = input.model
  if (model) {
    args.push('--model', model)
  }

  args.push(input.prompt)

  return runCursorAgentRaw(args, onEvent)
}

export async function runCursorAgentAsk(input: {
  question: string
  workspace: string
  graphContext: string
  onEvent: (event: CursorAgentEvent) => void
}): Promise<string> {
  const prompt = [
    'Answer using the Graphify graph context and any files in the workspace (especially graphify-out/).',
    'Do not modify files. Read-only analysis only.',
    '',
    'Graph context:',
    input.graphContext,
    '',
    `Question: ${input.question}`,
  ].join('\n')

  return runCursorAgentTask({
    prompt,
    workspace: input.workspace,
    mode: 'ask',
    onEvent: input.onEvent,
  })
}

function runCursorAgentRaw(
  args: string[],
  onEvent: (event: CursorAgentEvent) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(CURSOR_AGENT_BIN, args, {
      env: {
        ...process.env,
        PATH: PATH_WITH_TOOLS,
      },
    })

    let output = ''
    let stderr = ''
    let buffer = ''

    const flushLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const payload = JSON.parse(trimmed) as Record<string, unknown>
        const type = String(payload.type ?? '')
        if (type === 'assistant' || type === 'message') {
          const message = payload.message as { content?: Array<{ type?: string; text?: string }> } | undefined
          const blocks = message?.content ?? []
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              output += block.text
              onEvent({ type: 'delta', delta: block.text })
            }
          }
          return
        }
        if (typeof payload.text === 'string') {
          output += payload.text
          onEvent({ type: 'delta', delta: payload.text })
          return
        }
        if (typeof payload.delta === 'string') {
          output += payload.delta
          onEvent({ type: 'delta', delta: payload.delta })
          return
        }
        onEvent({ type: 'log', message: trimmed.slice(0, 240) })
      } catch {
        output += `${trimmed}\n`
        if (!detectCursorAuthError(trimmed)) {
          onEvent({ type: 'log', message: trimmed })
        }
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) flushLine(line)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      for (const line of chunk.toString().split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !detectCursorAuthError(trimmed)) {
          onEvent({ type: 'log', message: trimmed })
        }
      }
    })

    child.on('error', (error) => {
      onEvent({ type: 'error', message: error.message })
      reject(error)
    })

    child.on('close', (code) => {
      if (buffer.trim()) flushLine(buffer)
      const combined = `${output}\n${stderr}`.trim()
      const authError = detectCursorAuthError(combined)
      if (authError) {
        reject(new Error(authError))
        return
      }
      const usageError = detectCursorUsageLimit(combined)
      if (usageError) {
        onEvent({ type: 'error', message: usageError })
        reject(new Error(usageError))
        return
      }
      if (code !== 0 && !output.trim()) {
        const message = stderr.trim() || `Cursor agent exited with code ${code ?? 1}`
        onEvent({ type: 'error', message })
        reject(new Error(message))
        return
      }
      onEvent({ type: 'done', message: output.trim() })
      resolve(output.trim())
    })
  })
}

export function detectCursorAuthError(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('authentication required') && lower.includes('cursor_api_key')) {
    return 'Cursor CLI authentication required. Run agent login or set CURSOR_API_KEY.'
  }
  return null
}

function detectCursorUsageLimit(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes('out of usage') || lower.includes('increase limits for faster responses')) {
    return 'Cursor usage limit reached. Retry after your limit resets, or set BRIEFING_CURSOR_MODEL=auto.'
  }
  return null
}
