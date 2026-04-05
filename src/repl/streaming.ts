import { queryModelWithStreaming } from '../services/api/llm.js'
import type { Message } from '../types/message.js'
import type { SystemPrompt } from '../utils/systemPromptType.js'
import type { Tools } from '../Tool.js'

export interface StreamingResponseAccumulator {
  textContent: string
  toolCalls: Array<{
    id: string
    name: string
    input: unknown
  }>
  inputTokens: number
  outputTokens: number
  stopReason: string | null
}

/**
 * Stream LLM response and accumulate text + tool calls
 * Displays tokens in real-time and detects tool use
 */
export async function streamLLMResponse({
  messages,
  systemPrompt,
  tools,
  model,
  signal,
  onToken,
  onToolDetected,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  tools: Tools
  model: string
  signal: AbortSignal
  onToken?: (token: string) => void
  onToolDetected?: (toolName: string) => void
}): Promise<StreamingResponseAccumulator> {
  
  const accumulator: StreamingResponseAccumulator = {
    textContent: '',
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    stopReason: null,
  }

  try {
    const stream = queryModelWithStreaming({
      messages,
      systemPrompt,
      tools,
      signal,
      options: {
        model,
        maxTokens: 8000,
      },
      thinkingConfig: { type: 'disabled' },
    })

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        // Real-time token display
        accumulator.textContent += event.delta
        onToken?.(event.delta)
      } else if (event.type === 'assistant') {
        // Final message with all content blocks
        const msg = event.message
        accumulator.inputTokens = msg.usage?.input_tokens ?? 0
        accumulator.outputTokens = msg.usage?.output_tokens ?? 0
        accumulator.stopReason = msg.stop_reason ?? null

        // Extract text and tool calls from content blocks
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            // Only include text we haven't already accumulated
            accumulator.textContent = block.text
          } else if (block.type === 'tool_use') {
            accumulator.toolCalls.push({
              id: block.id ?? '',
              name: block.name ?? '',
              input: block.input ?? {},
            })
            onToolDetected?.(block.name ?? '')
          }
        }
      } else if (event.type === 'system') {
        // Error event
        throw new Error(`API Error: ${event.content}`)
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('AbortError')) {
      // User cancelled
      throw new Error('Request cancelled')
    }
    throw err
  }

  return accumulator
}

/**
 * Pretty-print streaming response to terminal
 */
export function printStreamingStart(): void {
  process.stdout.write('\n✨ \x1b[1;36mAssistant:\x1b[0m\n')
}

export function printStreamingToken(token: string): void {
  process.stdout.write(token)
}

export function printStreamingEnd(): void {
  process.stdout.write('\n\n')
}

export function printToolDetected(toolName: string): void {
  process.stderr.write(`[DEBUG] Tool detected: ${toolName}\n`)
}

/**
 * Format response for display with usage info
 */
export function formatResponseSummary(
  accumulator: StreamingResponseAccumulator,
): string {
  const summary: string[] = []

  if (accumulator.toolCalls.length > 0) {
    summary.push(
      `\n🔧 Detected ${accumulator.toolCalls.length} tool(s):`
    )
    for (const tc of accumulator.toolCalls) {
      summary.push(`   • ${tc.name}`)
    }
  }

  summary.push(
    `\n📊 Tokens: ${accumulator.inputTokens} in, ${accumulator.outputTokens} out`
  )

  return summary.join('\n')
}
