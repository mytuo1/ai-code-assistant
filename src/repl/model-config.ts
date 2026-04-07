/**
 * Model Configuration System - REASONING ONLY
 * Manages model selection for different query complexity tiers
 * ONLY uses: gpt-5.4-nano (light) and gpt-5.4-mini (heavy)
 */

export interface ModelConfig {
  name: string
  id: string
  type: 'nano' | 'mini'
  maxTokens: number
  thinkingBudget: number
  costPer1kTokens: number
}

// ONLY reasoning models - no fallbacks to non-reasoning models
export const MODEL_TIERS = {
  // Tier 1: Simple queries (0 tokens - direct execution)
  // No model needed

  // Tier 2: Modifications - Light reasoning with nano
  modification: {
    default: 'gpt-5.4-nano',
    type: 'nano',
  } as const,

  // Tier 3-Light: Light analysis - Nano reasoning
  analysis_light: {
    default: 'gpt-5.4-nano',
    type: 'nano',
  } as const,

  // Tier 3-Heavy: Heavy analysis - Mini reasoning
  analysis_heavy: {
    default: 'gpt-5.4-mini',
    type: 'mini',
  } as const,
}

// ONLY reasoning models - no gpt-3.5, gpt-4, etc.
export const MODEL_SPECS: Record<string, ModelConfig> = {
  'gpt-5.4-nano': {
    name: 'GPT-5.4-Nano',
    id: 'gpt-5.4-nano',
    type: 'nano',
    maxTokens: 4096,
    thinkingBudget: 2000,
    costPer1kTokens: 0.05,
  },
  'gpt-5.4-mini': {
    name: 'GPT-5.4-Mini',
    id: 'gpt-5.4-mini',
    type: 'mini',
    maxTokens: 16000,
    thinkingBudget: 8000,
    costPer1kTokens: 0.15,
  },
}

export function getModelConfig(modelName: string): ModelConfig {
  const config = MODEL_SPECS[modelName]
  if (!config) {
    throw new Error(
      `Model "${modelName}" not found. Only reasoning models supported: ${Object.keys(MODEL_SPECS).join(', ')}`
    )
  }
  return config
}

export function selectModelForTier(
  tier: 'modification' | 'analysis_light' | 'analysis_heavy',
  overrideModel?: string
): string {
  // If explicitly provided, validate it's a reasoning model
  if (overrideModel) {
    if (!(overrideModel in MODEL_SPECS)) {
      throw new Error(
        `Override model "${overrideModel}" not found. Only reasoning models supported: ${Object.keys(MODEL_SPECS).join(', ')}`
      )
    }
    return overrideModel
  }

  // Check environment variables for tier-specific overrides
  const envKey = `MODEL_${tier.toUpperCase()}`
  const envModel = process.env[envKey]
  if (envModel) {
    if (!(envModel in MODEL_SPECS)) {
      throw new Error(
        `Environment variable ${envKey}="${envModel}" is not a reasoning model. Use: ${Object.keys(MODEL_SPECS).join(', ')}`
      )
    }
    return envModel
  }

  // Use tier default (always a reasoning model)
  return MODEL_TIERS[tier].default
}
