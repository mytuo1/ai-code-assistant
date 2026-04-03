/**
 * OpenAI-compatible API client factory.
 * Replaces the Anthropic SDK client with OpenAI SDK client.
 */
import OpenAI from 'openai'
import { getSessionId } from 'src/bootstrap/state.js'
import { getOpenAIApiKey } from 'src/utils/auth.js'
import { getUserAgent } from 'src/utils/http.js'
import { getSmallFastModel } from 'src/utils/model/model.js'
import { getAPIProvider } from 'src/utils/model/providers.js'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import { logForDebugging } from 'src/utils/debug.js'

// Type alias for backward compatibility
export type AnthropicClient = OpenAI

export type ClientOptions = ConstructorParameters<typeof OpenAI>[0] & {
  logger?: {
    error?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    debug?: (...args: unknown[]) => void
  }
}

export async function getAnthropicClient({
  apiKey,
  maxRetries = 2,
  model,
}: {
  apiKey?: string
  maxRetries?: number
  model?: string
  fetchOverride?: unknown
  source?: string
} = {}): Promise<OpenAI> {
  const key = apiKey ?? getOpenAIApiKey()
  const provider = getAPIProvider(model ?? getSmallFastModel())
  
  logForDebugging(`[API:request] Creating OpenAI-compatible client, provider: ${provider}`)
  
  const baseURL = process.env.OPENAI_BASE_URL ?? 
    (process.env.AZURE_OPENAI_ENDPOINT 
      ? `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`
      : undefined)

  return new OpenAI({
    apiKey: key || 'placeholder',
    baseURL,
    maxRetries,
    defaultHeaders: {
      'User-Agent': getUserAgent(),
      'X-Session-Id': getSessionId(),
    },
    ...(await getProxyFetchOptions() as object),
  })
}

// Alias for compatibility
export const getClient = getAnthropicClient

// Aliases
export const getOpenAIClient = getAnthropicClient
export const createClient = getAnthropicClient
