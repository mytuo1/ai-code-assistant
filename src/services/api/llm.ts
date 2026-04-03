/**
 * Core API service — universal reasoning engine edition
 *
 * Supports any OpenAI-compatible provider including:
 *   - OpenAI (GPT-4.1, o3, o4-mini, o1, o1-mini)
 *   - xAI (Grok-3, Grok-3-mini)
 *   - Google Gemini (via OpenAI-compat endpoint)
 *   - Mistral, Groq, Cerebras, Together, Fireworks, Perplexity
 *   - Azure OpenAI
 *   - Local: Ollama, vLLM, LM Studio
 *   - Any provider via LiteLLM proxy (WatsonX, Cohere, Bedrock...)
 *
 * Per-model quirks handled automatically:
 *   o1/o3/o4   — max_completion_tokens, no temperature, system→developer role,
 *                reasoning_effort, streaming may be limited
 *   Gemini      — parallel_tool_calls disabled, streaming works
 *   Local/Ollama — tools optional, graceful degradation
 */

import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions.mjs'
import type { Stream } from 'openai/streaming.mjs'
import { randomUUID } from 'crypto'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { getOpenAIClient } from './client.js'
import type { Tool, Tools, ToolPermissionContext } from '../../Tool.js'
import type {
  Message,
  AssistantMessage,
  SystemAPIErrorMessage,
  StreamEvent,
} from '../../types/message.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import { zodToJsonSchema } from '../../utils/zodToJsonSchema.js'
import { EMPTY_USAGE, type NonNullableUsage } from './logging.js'
import { getMainLoopModel, getSmallFastModel } from '../../utils/model/model.js'

// ─── Model capability detection ───────────────────────────────────────────────

/**
 * Models that use max_completion_tokens instead of max_tokens,
 * don't support temperature/top_p, and use 'developer' role for system prompt.
 */
function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4') ||
    m.includes('reasoning') ||
    isEnvTruthy(process.env.MODEL_IS_REASONING)
  )
}

/**
 * Models that don't support streaming at all.
 * o1 (non-mini, non-preview) had no streaming initially; all current OpenAI
 * reasoning models do stream. Override with MODEL_NO_STREAMING=1 if needed.
 */
function modelSupportsStreaming(model: string): boolean {
  if (isEnvTruthy(process.env.MODEL_NO_STREAMING)) return false
  const m = model.toLowerCase()
  // o1 (the original) had no streaming; o1-mini, o1-preview, o3, o4-mini all stream
  if (m === 'o1') return false
  return true
}

/**
 * Models where tool use must be disabled or may not be supported.
 * Override with MODEL_NO_TOOLS=1 to force disable for any model.
 */
function modelSupportsTools(model: string): boolean {
  if (isEnvTruthy(process.env.MODEL_NO_TOOLS)) return false
  const m = model.toLowerCase()
  // o1-mini and some early o1 variants didn't support tools
  if (m === 'o1-mini') return false
  return true
}

/**
 * Models where parallel tool calls should be disabled.
 * Gemini via OpenAI compat and some local models reject it.
 */
function modelSupportsParallelToolCalls(model: string): boolean {
  if (isEnvTruthy(process.env.MODEL_NO_PARALLEL_TOOLS)) return false
  const m = model.toLowerCase()
  if (m.includes('gemini')) return false
  if (m.includes('llama')) return false
  if (m.includes('mistral')) return false
  return true
}

/**
 * Get the reasoning_effort value for o3/o4 models.
 * Set REASONING_EFFORT=low|medium|high (default: high)
 */
function getReasoningEffort(): 'low' | 'medium' | 'high' {
  const v = (process.env.REASONING_EFFORT ?? 'high').toLowerCase()
  if (v === 'low' || v === 'medium') return v
  return 'high'
}

/**
 * Build model-specific extra params.
 * Handles: max_completion_tokens, reasoning_effort, temperature removal,
 * parallel_tool_calls, developer role.
 */
function buildModelParams(
  model: string,
  maxTokens?: number,
): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  const isReasoning = isReasoningModel(model)

  if (isReasoning) {
    // Reasoning models use max_completion_tokens, not max_tokens
    if (maxTokens) params.max_completion_tokens = maxTokens
    // o3/o4 support reasoning_effort; o1 does not
    if (model.toLowerCase().startsWith('o3') || model.toLowerCase().startsWith('o4')) {
      params.reasoning_effort = getReasoningEffort()
    }
    // No temperature, no top_p for reasoning models
  } else {
    if (maxTokens) params.max_tokens = maxTokens
    // Apply temperature if configured
    const temp = process.env.MODEL_TEMPERATURE
    if (temp) params.temperature = parseFloat(temp)
  }

  return params
}

// ─── System message handling ──────────────────────────────────────────────────

/**
 * Reasoning models (o1/o3/o4) use 'developer' role instead of 'system'.
 * Gemini ignores system messages and prefers them prepended to user content.
 * Everything else uses standard 'system' role.
 */
function buildSystemMessages(
  systemText: string,
  model: string,
): ChatCompletionMessageParam[] {
  if (!systemText) return []
  const m = model.toLowerCase()

  // o1/o3/o4 use developer role
  if (isReasoningModel(model)) {
    return [{ role: 'developer' as unknown as 'system', content: systemText }]
  }

  // Gemini via OpenAI compat works fine with system role
  return [{ role: 'system', content: systemText }]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Options = {
  model: string
  maxTokens?: number
  signal?: AbortSignal
  thinkingConfig?: ThinkingConfig
  systemPrompt?: SystemPrompt
  tools?: Tools
  agentId?: string
  querySource: string
  advisorModel?: string
  fallbackModel?: string
}

export type BetaUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// ─── Tool schema conversion ───────────────────────────────────────────────────

export async function toolToAPISchema(
  tool: Tool,
  options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>
    tools: Tools
    agents: AgentDefinition[]
    allowedAgentTypes?: string[]
    model?: string
    deferLoading?: boolean
    cacheControl?: unknown
  },
): Promise<ChatCompletionTool> {
  const parameters =
    'inputJSONSchema' in tool && tool.inputJSONSchema
      ? tool.inputJSONSchema
      : zodToJsonSchema(tool.inputSchema)

  const description = await tool.prompt({
    getToolPermissionContext: options.getToolPermissionContext,
    tools: options.tools,
    agents: options.agents,
    allowedAgentTypes: options.allowedAgentTypes,
  })

  return {
    type: 'function',
    function: {
      name: tool.name,
      description,
      parameters: parameters as Record<string, unknown>,
      // Strict mode for models that support it (improves reliability)
      ...(options.model && modelSupportsStructuredOutputs(options.model) && { strict: true }),
    },
  }
}

function modelSupportsStructuredOutputs(model: string): boolean {
  const m = model.toLowerCase()
  return m.startsWith('gpt-4') || m.startsWith('o3') || m.startsWith('o4') || m.startsWith('o1')
}

// ─── Message format conversion ────────────────────────────────────────────────

export function normalizeMessagesForAPI(
  messages: Message[],
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = []

  for (const msg of messages) {
    if (msg.type === 'user') {
      const content = Array.isArray(msg.message.content)
        ? msg.message.content
            .map((block: { type: string; text?: string }) =>
              block.type === 'text' ? (block.text ?? '') : '',
            )
            .join('')
        : String(msg.message.content ?? '')
      if (content.trim()) result.push({ role: 'user', content })
    } else if (msg.type === 'assistant') {
      const contentBlocks = Array.isArray(msg.message.content)
        ? msg.message.content
        : []

      const textParts = contentBlocks
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('')

      const toolCalls = contentBlocks
        .filter((b: { type: string }) => b.type === 'tool_use')
        .map((b: { id: string; name: string; input: unknown }) => ({
          id: b.id,
          type: 'function' as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input),
          },
        }))

      if (toolCalls.length > 0) {
        result.push({
          role: 'assistant',
          content: textParts || null,
          tool_calls: toolCalls,
        })
        // Add tool results that follow
        for (const tc of toolCalls) {
          result.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: '[pending]',
          })
        }
      } else if (textParts) {
        result.push({ role: 'assistant', content: textParts })
      }
    }
  }

  return result
}

// ─── Usage tracking ───────────────────────────────────────────────────────────

export function updateUsage(
  current: NonNullableUsage,
  delta: Partial<BetaUsage> | undefined,
): NonNullableUsage {
  if (!delta) return current
  return {
    input_tokens: (current.input_tokens ?? 0) + (delta.input_tokens ?? 0),
    output_tokens: (current.output_tokens ?? 0) + (delta.output_tokens ?? 0),
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: { web_search_requests: 0 },
  }
}

export function accumulateUsage(
  acc: NonNullableUsage,
  incoming: Partial<BetaUsage>,
): NonNullableUsage {
  return updateUsage(acc, incoming)
}

// ─── Prompt-cache stubs (OpenAI handles caching internally) ──────────────────

export function getPromptCachingEnabled(_model: string): boolean { return false }
export function getCacheControl(_opts: unknown): undefined { return undefined }
export function addCacheBreakpoints<T>(items: T[], _model: string): T[] { return items }

export function buildSystemPromptBlocks(
  systemPrompt: SystemPrompt,
): Array<{ type: 'text'; text: string }> {
  const text =
    typeof systemPrompt === 'string'
      ? systemPrompt
      : systemPrompt.map((p: { value: string }) => p.value).join('\n\n')
  return [{ type: 'text', text }]
}

// ─── API key verification ──────────────────────────────────────────────────────

export async function verifyApiKey(_key: string, _strict = true): Promise<boolean> {
  // We intentionally do NOT call models.list() — not supported on Gemini, xAI, Ollama etc.
  // A cheap 1-token completion works universally across all providers.
  try {
    const client = await getOpenAIClient()
    const model =
      process.env.OPENAI_SMALL_FAST_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-4.1-mini'
    const params: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: 'hi' }],
    }
    // Use correct token param for the model type
    if (isReasoningModel(model)) {
      params.max_completion_tokens = 1
    } else {
      params.max_tokens = 1
    }
    await (client.chat.completions.create as (p: unknown) => Promise<unknown>)(params)
    return true
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 401 || status === 403) return false
    return true // Other errors (quota, model not found) don't mean bad key
  }
}

// ─── Extra body / beta params (no-op) ─────────────────────────────────────────

export function getExtraBodyParams(_betaHeaders?: string[]): Record<string, unknown> {
  return {}
}
export function getMergedBetas(_model: string, _opts?: unknown): string[] { return [] }
export function configureTaskBudgetParams(_opts: unknown): Record<string, unknown> { return {} }
export function getAPIMetadata(): Record<string, string> {
  return { provider: 'openai', model: getMainLoopModel() }
}

// ─── Non-streaming request ─────────────────────────────────────────────────────

export async function* executeNonStreamingRequest(
  clientOptions: {
    model: string
    messages: ChatCompletionMessageParam[]
    system?: string
    tools?: ChatCompletionTool[]
    maxTokens?: number
    signal?: AbortSignal
  },
): AsyncGenerator<SystemAPIErrorMessage | AssistantMessage, void> {
  try {
    const client = await getOpenAIClient({ model: clientOptions.model })
    const systemMsgs = buildSystemMessages(clientOptions.system ?? '', clientOptions.model)
    const allMsgs = [...systemMsgs, ...clientOptions.messages]
    const modelParams = buildModelParams(clientOptions.model, clientOptions.maxTokens)
    const hasTools =
      clientOptions.tools?.length &&
      modelSupportsTools(clientOptions.model)

    const params: ChatCompletionCreateParamsNonStreaming = {
      model: clientOptions.model,
      messages: allMsgs,
      ...modelParams,
      ...(hasTools && {
        tools: clientOptions.tools,
        ...(!modelSupportsParallelToolCalls(clientOptions.model) && {
          parallel_tool_calls: false,
        }),
      }),
    } as ChatCompletionCreateParamsNonStreaming

    const response = await client.chat.completions.create(params, {
      signal: clientOptions.signal,
    })

    const choice = response.choices[0]
    if (!choice) return

    const content: Array<{
      type: string; text?: string; id?: string; name?: string; input?: unknown
    }> = []

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content })
    }
    for (const tc of choice.message.tool_calls ?? []) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: (() => { try { return JSON.parse(tc.function.arguments || '{}') } catch { return {} } })(),
      })
    }

    yield {
      type: 'assistant',
      message: {
        id: response.id,
        type: 'message',
        role: 'assistant',
        content,
        model: response.model,
        stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: response.usage?.prompt_tokens ?? 0,
          output_tokens: response.usage?.completion_tokens ?? 0,
        },
      },
      uuid: randomUUID(),
      requestId: response.id,
      timestamp: new Date().toISOString(),
    } as AssistantMessage
  } catch (err) {
    logError(err)
    yield {
      type: 'system',
      level: 'error',
      content: err instanceof Error ? err.message : String(err),
      uuid: randomUUID(),
      timestamp: new Date().toISOString(),
    } as SystemAPIErrorMessage
  }
}

// ─── Streaming query ──────────────────────────────────────────────────────────

export async function* queryModelWithStreaming({
  messages,
  systemPrompt,
  tools,
  signal,
  options,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig: ThinkingConfig
  tools: Tools
  signal: AbortSignal
  options: Options
}): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  const { model } = options
  const client = await getOpenAIClient({ model })

  const systemText =
    typeof systemPrompt === 'string'
      ? systemPrompt
      : Array.isArray(systemPrompt)
        ? systemPrompt.map((p: { value: string }) => p.value).join('\n\n')
        : ''

  const systemMsgs = buildSystemMessages(systemText, model)
  const apiMessages: ChatCompletionMessageParam[] = [
    ...systemMsgs,
    ...normalizeMessagesForAPI(messages),
  ]

  const apiTools: ChatCompletionTool[] = []
  if (modelSupportsTools(model)) {
    for (const tool of tools ?? []) {
      if ('name' in tool) {
        apiTools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: String(tool.description ?? ''),
            parameters: (
              'inputJSONSchema' in tool && tool.inputJSONSchema
                ? tool.inputJSONSchema
                : zodToJsonSchema(tool.inputSchema)
            ) as Record<string, unknown>,
          },
        })
      }
    }
  }

  const modelParams = buildModelParams(model, options.maxTokens)
  const supportsStream = modelSupportsStreaming(model)

  logForDebugging(
    `[api] model=${model} reasoning=${isReasoningModel(model)} stream=${supportsStream} tools=${apiTools.length}`,
  )

  // Non-streaming fallback for models that don't support streaming (e.g. original o1)
  if (!supportsStream) {
    yield* executeNonStreamingRequest({
      model,
      messages: apiMessages.filter(m => m.role !== 'system' && m.role !== 'developer'),
      system: systemText,
      tools: apiTools.length ? apiTools : undefined,
      maxTokens: options.maxTokens,
      signal,
    })
    return
  }

  let stream: Stream<ChatCompletionChunk> | undefined

  try {
    const streamParams: ChatCompletionCreateParamsStreaming = {
      model,
      messages: apiMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...modelParams,
      ...(apiTools.length && {
        tools: apiTools,
        ...(!modelSupportsParallelToolCalls(model) && {
          parallel_tool_calls: false,
        }),
      }),
    } as ChatCompletionCreateParamsStreaming

    stream = await client.chat.completions.create(streamParams, { signal }) as Stream<ChatCompletionChunk>

    let textAccumulator = ''
    const toolCallAccumulators = new Map<number, {
      id: string; name: string; arguments: string
    }>()
    let inputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    let finishReason: string | null = null
    const messageId = randomUUID()

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (!choice) {
        // usage-only chunk (stream_options: include_usage)
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens
          outputTokens = chunk.usage.completion_tokens ?? outputTokens
          // Capture reasoning tokens if present (o3/o4)
          reasoningTokens =
            (chunk.usage as Record<string, unknown>)
              ?.completion_tokens_details
              ?.reasoning_tokens as number ?? reasoningTokens
        }
        continue
      }

      finishReason = choice.finish_reason ?? finishReason

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens
        outputTokens = chunk.usage.completion_tokens ?? outputTokens
      }

      const delta = choice.delta as Record<string, unknown>

      // Text or reasoning delta
      const textContent = delta.content as string | undefined
      if (textContent) {
        textAccumulator += textContent
        yield {
          type: 'text_delta',
          delta: textContent,
          uuid: randomUUID(),
          timestamp: new Date().toISOString(),
        } as unknown as StreamEvent
      }

      // Tool call deltas
      const toolCallDeltas = delta.tool_calls as Array<{
        index: number; id?: string; function?: { name?: string; arguments?: string }
      }> | undefined
      if (toolCallDeltas) {
        for (const tc of toolCallDeltas) {
          const idx = tc.index
          if (!toolCallAccumulators.has(idx)) {
            toolCallAccumulators.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' })
          }
          const acc = toolCallAccumulators.get(idx)!
          if (tc.id) acc.id = tc.id
          if (tc.function?.name) acc.name += tc.function.name
          if (tc.function?.arguments) acc.arguments += tc.function.arguments
        }
      }
    }

    // Build final assistant message
    const content: Array<{
      type: string; text?: string; id?: string; name?: string; input?: unknown
    }> = []
    if (textAccumulator) {
      content.push({ type: 'text', text: textAccumulator })
    }
    for (const [, tc] of toolCallAccumulators) {
      let parsed: unknown = {}
      try { parsed = JSON.parse(tc.arguments) } catch { parsed = {} }
      content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: parsed })
    }

    // Log reasoning token usage if present
    if (reasoningTokens > 0) {
      logForDebugging(`[api] reasoning_tokens=${reasoningTokens}`)
    }

    yield {
      type: 'assistant',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content,
        model,
        stop_reason: finishReason === 'tool_calls' ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      },
      uuid: randomUUID(),
      requestId: messageId,
      timestamp: new Date().toISOString(),
    } as AssistantMessage

  } catch (err) {
    logError(err)
    yield {
      type: 'system',
      level: 'error',
      content: err instanceof Error ? err.message : String(err),
      uuid: randomUUID(),
      timestamp: new Date().toISOString(),
    } as SystemAPIErrorMessage
  } finally {
    if (stream) { try { stream.controller.abort() } catch { /* ignore */ } }
  }
}

export async function* queryModelWithoutStreaming(args: Parameters<typeof queryModelWithStreaming>[0]):
  AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
  yield* queryModelWithStreaming(args)
}

// ─── Small-model query ────────────────────────────────────────────────────────

export async function queryHaiku({
  userPrompt,
  systemPrompt,
  signal,
  options: _options,
}: {
  userPrompt: string
  systemPrompt?: string | string[]
  signal?: AbortSignal
  options?: Record<string, unknown>
}): Promise<{ message: { content: Array<{ type: string; text: string }> } }> {
  const model = getSmallFastModel()
  const client = await getOpenAIClient({ model })
  const sysPrompt = Array.isArray(systemPrompt) ? systemPrompt.join('\n') : (systemPrompt ?? '')
  const msgs: ChatCompletionMessageParam[] = [
    ...buildSystemMessages(sysPrompt, model),
    { role: 'user', content: userPrompt },
  ]
  const modelParams = buildModelParams(model)
  const resp = await (client.chat.completions.create as (p: unknown, o: unknown) => Promise<{
    choices: Array<{ message: { content: string | null } }>
  }>)({ model, messages: msgs, ...modelParams }, { signal })
  return resp.choices[0]?.message?.content ?? ''
}

export async function queryWithModel({
  userPrompt,
  systemPrompt,
  model,
  signal,
}: {
  userPrompt: string
  systemPrompt?: string
  model: string
  signal?: AbortSignal
}): Promise<string> {
  return queryHaiku({ userPrompt, systemPrompt, signal })
}

// ─── Stream cleanup ──────────────────────────────────────────────────────────

export function cleanupStream(stream: Stream<ChatCompletionChunk> | undefined): void {
  if (stream) { try { stream.controller.abort() } catch { /* ignore */ } }
}

// ─── Max tokens ───────────────────────────────────────────────────────────────

export const MAX_NON_STREAMING_TOKENS = 100_000

export function getMaxOutputTokensForModel(model: string): number {
  const override = process.env.MODEL_MAX_OUTPUT_TOKENS
  if (override) return parseInt(override, 10)
  const m = model.toLowerCase()
  if (m.startsWith('o3') || m.startsWith('o4') || m.startsWith('o1')) return 100_000
  if (m.startsWith('gpt-4.1')) return 32_768
  if (m.startsWith('gpt-4o')) return 16_384
  return 16_384
}

export function adjustParamsForNonStreaming<T extends Record<string, unknown>>(params: T): T {
  return params
}

export function stripExcessMediaItems<T>(messages: T[], _model: string): T[] {
  return messages
}

export function detectPromptCacheBreak(_before: unknown, _after: unknown): boolean {
  return false
}
