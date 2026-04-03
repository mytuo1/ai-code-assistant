/**
 * API Provider detection
 * Replaces Anthropic-specific provider logic (bedrock / vertex / foundry)
 * with OpenAI equivalents.
 */

import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'openai' | 'azure' | 'proxy'

export function getAPIProvider(): APIProvider {
  if (process.env.AZURE_OPENAI_ENDPOINT) return 'azure'
  if (process.env.OPENAI_BASE_URL) return 'proxy'
  return 'openai'
}

/** Retained for call-sites that still reference this function name */
export function getAPIProviderForStatsig(): string {
  return getAPIProvider()
}

/**
 * Returns true when pointing at the real OpenAI API (no custom base URL).
 * Used to gate first-party-only request headers.
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.OPENAI_BASE_URL
  if (!baseUrl) return true
  try {
    return new URL(baseUrl).host === 'api.openai.com'
  } catch {
    return false
  }
}
