/**
 * OpenAI Compatibility Shim
 *
 * This file re-exports OpenAI SDK types under the names the codebase previously
 * used from @anthropic-ai/sdk. It is the single place you need to update if
 * type names change in a future OpenAI SDK release.
 *
 * Migration: @anthropic-ai/sdk → openai
 */

import type OpenAI from 'openai'
import type { Stream } from 'openai/streaming.mjs'

// ─── Re-export the OpenAI client itself ──────────────────────────────────────
export { default as Anthropic } from 'openai' // alias so old code compiles
export type { ClientOptions } from 'openai'
export type { APIError, APIUserAbortError } from 'openai'
export { APIError, APIUserAbortError, APIConnectionError, APIConnectionTimeoutError, AuthenticationError, NotFoundError, RateLimitError, InternalServerError, BadRequestError, PermissionDeniedError, UnprocessableEntityError } from 'openai'
export type { Stream }

// ─── Message param types ──────────────────────────────────────────────────────
export type MessageParam = OpenAI.Chat.ChatCompletionMessageParam
export type BetaMessageParam = OpenAI.Chat.ChatCompletionMessageParam

// ─── Content block types ──────────────────────────────────────────────────────
export type ContentBlock =
  | OpenAI.Chat.ChatCompletionContentPartText
  | OpenAI.Chat.ChatCompletionContentPartImage
  | ToolUseBlock

export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam

export type BetaContentBlock = ContentBlock

// ─── Text blocks ─────────────────────────────────────────────────────────────
export type TextBlockParam = OpenAI.Chat.ChatCompletionContentPartText
export type TextBlock = OpenAI.Chat.ChatCompletionContentPartText

// ─── Image blocks ─────────────────────────────────────────────────────────────
export type ImageBlockParam = OpenAI.Chat.ChatCompletionContentPartImage
export type Base64ImageSource = {
  type: 'base64'
  media_type: string
  data: string
}

// ─── Tool use / tool call blocks ─────────────────────────────────────────────
export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
export type BetaToolUseBlock = ToolUseBlock
export type ToolUseBlockParam = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

// ─── Tool result blocks ───────────────────────────────────────────────────────
export type ToolResultBlockParam = {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlockParam[]
  is_error?: boolean
}
export type BetaToolResultBlockParam = ToolResultBlockParam

// ─── Tool definitions ─────────────────────────────────────────────────────────
export type BetaTool = OpenAI.Chat.ChatCompletionTool
export type BetaToolUnion = OpenAI.Chat.ChatCompletionTool

// ─── Message stream params ─────────────────────────────────────────────────────
export type BetaMessageStreamParams = OpenAI.Chat.ChatCompletionCreateParamsStreaming

// ─── Usage ───────────────────────────────────────────────────────────────────
export type BetaUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// ─── Stop reason ──────────────────────────────────────────────────────────────
export type BetaStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'tool_use'
  | 'stop_sequence'
  | null

// ─── Message delta usage ──────────────────────────────────────────────────────
export type BetaMessageDeltaUsage = {
  output_tokens: number
}

// ─── Thinking blocks (no OpenAI equivalent — stubbed out) ────────────────────
export type ThinkingBlock = {
  type: 'thinking'
  thinking: string
}
export type ThinkingBlockParam = {
  type: 'thinking'
  thinking: string
}
export type RedactedThinkingBlock = {
  type: 'redacted_thinking'
  data: string
}
export type RedactedThinkingBlockParam = {
  type: 'redacted_thinking'
  data: string
}

// ─── Stream events ────────────────────────────────────────────────────────────
export type BetaRawMessageStreamEvent = OpenAI.Chat.ChatCompletionChunk

// ─── Tool choice ──────────────────────────────────────────────────────────────
export type BetaToolChoiceAuto = OpenAI.Chat.ChatCompletionToolChoiceOption & {
  type: 'auto'
}
export type BetaToolChoiceTool = {
  type: 'tool'
  name: string
}

// ─── Output config (Anthropic-specific, stubbed) ─────────────────────────────
export type BetaOutputConfig = Record<string, unknown>
export type BetaJSONOutputFormat = { type: 'json_object' }

// ─── Document block (Anthropic PDF support, stubbed) ─────────────────────────
export type BetaRequestDocumentBlock = {
  type: 'document'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

// ─── Message (full response) ──────────────────────────────────────────────────
export type BetaMessage = {
  id: string
  type: 'message'
  role: 'assistant'
  content: ContentBlock[]
  model: string
  stop_reason: BetaStopReason
  stop_sequence: string | null
  usage: BetaUsage
}

export type BetaRedactedThinkingBlock = { type: 'redacted_thinking'; data: string }
export type BetaThinkingBlock = { type: 'thinking'; thinking: string }
export type BetaWebSearchTool20250305 = { type: 'web_search_20250305'; name: string }

// Default export for: import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
export default OpenAI
