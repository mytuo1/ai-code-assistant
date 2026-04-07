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
  maxTokens = 4096,
  onToken,
  onToolDetected,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  tools: Tools
  model: string
  signal: AbortSignal
  maxTokens?: number
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
        maxTokens,
      },
      thinkingConfig: { type: 'disabled' },
    })



    for await (const event of stream) {
      process.stderr.write(`[StreamDebug] Event type: ${event.type}\n`)
      
      if (event.type === 'text_delta') {
        // Real-time token display
        accumulator.textContent += event.delta
        onToken?.(event.delta)
        process.stderr.write(`[StreamDebug] Text delta: "${event.delta}"\n`)
      } else if (event.type === 'assistant') {
        // Final message with all content blocks
        const msg = event.message
        accumulator.inputTokens = msg.usage?.input_tokens ?? 0
        accumulator.outputTokens = msg.usage?.output_tokens ?? 0
        accumulator.stopReason = msg.stop_reason ?? null
        process.stderr.write(`[StreamDebug] Assistant message with ${msg.content?.length ?? 0} content blocks\n`)

        // Extract text and tool calls from content blocks
        for (const block of msg.content) {
          process.stderr.write(`[StreamDebug] Content block type: ${block.type}\n`)
          
          if (block.type === 'text' && block.text) {
            // Only include text we haven't already accumulated
            accumulator.textContent = block.text
            process.stderr.write(`[StreamDebug] Text block: "${block.text}"\n`)
          } else if (block.type === 'tool_use') {
            let toolName = block.name ?? ''
            process.stderr.write(`[StreamDebug] Tool use (before normalization): ${toolName}\n`)
            
            // Normalize tool names (OpenAI API quirk: ReadRead → Read)
            if (toolName.length % 2 === 0) {
              const half = toolName.length / 2
              const first = toolName.slice(0, half)
              const second = toolName.slice(half)
              if (first === second) {
                toolName = first
                process.stderr.write(`[StreamDebug] Tool name normalized: ${toolName}\n`)
              }
            }
            
            accumulator.toolCalls.push({
              id: block.id ?? '',
              name: toolName,
              input: block.input ?? {},
            })
            process.stderr.write(`[StreamDebug] Tool call added to accumulator (total: ${accumulator.toolCalls.length})\n`)
            onToolDetected?.(toolName)
          }
        }
      } else if (event.type === 'system') {
        // Error event
        process.stderr.write(`[StreamDebug] System error: ${event.content}\n`)
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
  // Removed debug output
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
