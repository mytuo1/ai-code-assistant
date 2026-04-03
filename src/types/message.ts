/**
 * Core message types used throughout the application.
 * These types define the internal message format for conversations.
 */

import type { UUID } from 'crypto'
import type {
  BetaMessage,
  BetaUsage,
  ContentBlock,
  ToolUseBlock,
} from './openai-compat.js'

// ─── Base ─────────────────────────────────────────────────────────────────────

export type MessageOrigin = 'human' | 'assistant' | 'system'

export type MessageType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'attachment'
  | 'progress'
  | 'grouped_tool_use'
  | 'hook_result'
  | 'queue_operation'

// ─── User message ─────────────────────────────────────────────────────────────

export type UserMessage = {
  type: 'user'
  message: {
    role: 'user'
    content:
      | string
      | Array<{
          type: string
          text?: string
          source?: { type: string; media_type: string; data: string }
        }>
  }
  uuid: UUID
  timestamp: string
  isMeta?: boolean
  isInterruption?: boolean
  origin?: MessageOrigin
}

// ─── Assistant message ────────────────────────────────────────────────────────

export type AssistantMessage = {
  type: 'assistant'
  message: BetaMessage & {
    content: ContentBlock[]
  }
  uuid: UUID
  requestId: string | undefined
  timestamp: string
  origin?: MessageOrigin
}

export type NormalizedAssistantMessage = AssistantMessage

// ─── System messages ──────────────────────────────────────────────────────────

export type SystemAPIErrorMessage = {
  type: 'system'
  subtype?: 'api_error'
  level: 'error' | 'warning' | 'info'
  content: string
  uuid: UUID
  timestamp: string
  isError?: boolean
}

export type SystemInformationalMessage = {
  type: 'system'
  subtype?: 'informational'
  level: 'info' | 'warning'
  content: string
  uuid: UUID
  timestamp: string
}

export type SystemBridgeStatusMessage = {
  type: 'system'
  subtype: 'bridge_status'
  content: string
  level: 'info' | 'error' | 'warning'
  uuid: UUID
  timestamp: string
}

export type SystemThinkingMessage = {
  type: 'system'
  subtype: 'thinking'
  content: string
  uuid: UUID
  timestamp: string
}

export type SystemStopHookSummaryMessage = {
  type: 'system'
  subtype: 'stop_hook_summary'
  content: string
  uuid: UUID
  timestamp: string
}

export type SystemMemorySavedMessage = {
  type: 'system'
  subtype: 'memory_saved'
  content: string
  uuid: UUID
  timestamp: string
}

export type SystemTurnDurationMessage = {
  type: 'system'
  subtype: 'turn_duration'
  durationMs: number
  uuid: UUID
  timestamp: string
  content: string
}

export type SystemApiMetricsMessage = {
  type: 'system'
  subtype: 'api_metrics'
  usage: BetaUsage
  durationMs: number
  uuid: UUID
  timestamp: string
  content: string
}

export type SystemLocalCommandMessage = {
  type: 'system'
  subtype: 'local_command'
  content: string
  uuid: UUID
  timestamp: string
}

export type SystemMessage =
  | SystemAPIErrorMessage
  | SystemInformationalMessage
  | SystemBridgeStatusMessage
  | SystemThinkingMessage
  | SystemStopHookSummaryMessage
  | SystemMemorySavedMessage
  | SystemTurnDurationMessage
  | SystemApiMetricsMessage
  | SystemLocalCommandMessage

// ─── Progress message ─────────────────────────────────────────────────────────

export type ProgressMessage = {
  type: 'progress'
  content: unknown
  toolUseId: string
  uuid: UUID
  timestamp: string
}
export type ProgressMessageType = ProgressMessage

// ─── Attachment message ───────────────────────────────────────────────────────

export type AttachmentMessage = {
  type: 'attachment'
  content: string | Uint8Array
  mediaType: string
  uuid: UUID
  timestamp: string
}
export type AttachmentMessageType = AttachmentMessage

// ─── Grouped tool use ─────────────────────────────────────────────────────────

export type GroupedToolUseMessage = {
  type: 'grouped_tool_use'
  tools: ToolUseBlock[]
  uuid: UUID
  timestamp: string
}
export type GroupedToolUseMessageType = GroupedToolUseMessage

// ─── Hook result ──────────────────────────────────────────────────────────────

export type HookResultMessage = {
  type: 'hook_result'
  content: string
  uuid: UUID
  timestamp: string
}

// ─── Queue operation ──────────────────────────────────────────────────────────

export type QueueOperationMessage = {
  type: 'queue_operation'
  operation: 'add' | 'remove' | 'clear'
  uuid: UUID
  timestamp: string
}

// ─── StreamEvent ──────────────────────────────────────────────────────────────

export type StreamEvent = {
  type: 'text_delta' | 'thinking_delta' | 'input_json_delta' | 'stream_event'
  delta?: string
  index?: number
  uuid: UUID
  timestamp: string
}

// ─── RequestStartEvent ────────────────────────────────────────────────────────

export type RequestStartEvent = {
  type: 'request_start'
  model: string
  uuid: UUID
  timestamp: string
}

// ─── Compact types ────────────────────────────────────────────────────────────

export type PartialCompactDirection = 'start' | 'end' | 'full' | null

export type CompactMetadata = {
  compactedAt: string
  originalTokenCount?: number
  compactedTokenCount?: number
}

// ─── Stop hook info ───────────────────────────────────────────────────────────

export type StopHookInfo = {
  hookType: string
  result: unknown
}

// ─── Away summary ─────────────────────────────────────────────────────────────

export type SystemAwaySummaryMessage = {
  type: 'system'
  subtype: 'away_summary'
  content: string
  uuid: UUID
  timestamp: string
}

// ─── Agents killed ────────────────────────────────────────────────────────────

export type SystemAgentsKilledMessage = {
  type: 'system'
  subtype: 'agents_killed'
  content: string
  uuid: UUID
  timestamp: string
}

// ─── Compact boundary ────────────────────────────────────────────────────────

export type SystemCompactBoundaryMessage = {
  type: 'system'
  subtype: 'compact_boundary'
  content: string
  compactMetadata?: CompactMetadata
  uuid: UUID
  timestamp: string
}

// ─── Normalized types ─────────────────────────────────────────────────────────

export type NormalizedUserMessage = UserMessage
export type NormalizedMessage = Message
export type RenderableMessage = Message

// ─── Union ────────────────────────────────────────────────────────────────────

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ProgressMessage
  | AttachmentMessage
  | GroupedToolUseMessage
  | HookResultMessage
  | QueueOperationMessage
  | SystemAwaySummaryMessage
  | SystemAgentsKilledMessage
  | SystemCompactBoundaryMessage
  | SystemApiMetricsMessage

export type TombstoneMessage = SystemMessage & { subtype: 'tombstone' }

export type SystemFileSnapshotMessage = {
  type: 'system'; subtype: 'file_snapshot'
  content: string; uuid: import('crypto').UUID; timestamp: string
}
// Re-export AssistantMessage (already defined, just ensure visible)
