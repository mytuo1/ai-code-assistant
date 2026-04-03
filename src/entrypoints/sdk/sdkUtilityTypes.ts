import type { BetaUsage } from '../types/openai-compat.js'

export type NonNullableUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  server_tool_use?: { web_search_requests?: number }
}
