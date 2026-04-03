/**
 * Model capabilities
 *
 * Provides context window and output token limits for any configured model.
 * Static data covers major providers. For custom/local models, use env vars:
 *   MODEL_CONTEXT_WINDOW=200000
 *   MODEL_MAX_OUTPUT_TOKENS=32768
 *
 * No remote calls — works offline.
 */

export type ModelCapability = {
  id: string
  max_input_tokens?: number
  max_tokens?: number
}

// Static capability data for major models
const KNOWN_CAPABILITIES: ModelCapability[] = [
  // OpenAI
  { id: 'gpt-4.1',           max_input_tokens: 1_047_576, max_tokens: 32_768 },
  { id: 'gpt-4.1-mini',      max_input_tokens: 1_047_576, max_tokens: 32_768 },
  { id: 'gpt-4.1-nano',      max_input_tokens: 1_047_576, max_tokens: 32_768 },
  { id: 'gpt-4o',            max_input_tokens:   128_000, max_tokens: 16_384 },
  { id: 'gpt-4o-mini',       max_input_tokens:   128_000, max_tokens: 16_384 },
  { id: 'o3',                max_input_tokens:   200_000, max_tokens: 100_000 },
  { id: 'o3-mini',           max_input_tokens:   200_000, max_tokens: 100_000 },
  { id: 'o4-mini',           max_input_tokens:   200_000, max_tokens: 100_000 },
  // xAI
  { id: 'grok-3',            max_input_tokens:   131_072, max_tokens: 131_072 },
  { id: 'grok-3-mini',       max_input_tokens:   131_072, max_tokens: 131_072 },
  // Google Gemini
  { id: 'gemini-2.5-pro',    max_input_tokens: 1_048_576, max_tokens:  65_536 },
  { id: 'gemini-2.5-flash',  max_input_tokens: 1_048_576, max_tokens:  65_536 },
  { id: 'gemini-1.5-pro',    max_input_tokens: 2_097_152, max_tokens:   8_192 },
  // Mistral
  { id: 'mistral-large',     max_input_tokens:   131_072, max_tokens:   4_096 },
  { id: 'mistral-small',     max_input_tokens:   131_072, max_tokens:   4_096 },
  // Groq / Llama
  { id: 'llama-3.3-70b',     max_input_tokens:   128_000, max_tokens:   8_192 },
  { id: 'llama-3.1-8b',      max_input_tokens:   128_000, max_tokens:   8_192 },
]

export function getModelCapability(model: string): ModelCapability | undefined {
  // Env var override always wins
  const ctxOverride  = process.env.MODEL_CONTEXT_WINDOW
  const outOverride  = process.env.MODEL_MAX_OUTPUT_TOKENS
  if (ctxOverride || outOverride) {
    return {
      id: model,
      max_input_tokens: ctxOverride  ? parseInt(ctxOverride,  10) : undefined,
      max_tokens:       outOverride  ? parseInt(outOverride, 10) : undefined,
    }
  }

  const m = model.toLowerCase()
  // Exact match
  const exact = KNOWN_CAPABILITIES.find(c => c.id === m)
  if (exact) return exact
  // Prefix match (e.g. "gpt-4o-2024-11-20" → "gpt-4o")
  return KNOWN_CAPABILITIES.find(c => m.startsWith(c.id))
}

/** No-op — capability data is static, no remote fetch needed */
export async function refreshModelCapabilities(): Promise<void> {}
