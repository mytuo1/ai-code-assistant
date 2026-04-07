/**
 * Model Selector
 * Routes queries to appropriate reasoning model tier:
 * - Tier 1: Direct execution (no model)
 * - Tier 2: Modifications (nano)
 * - Tier 3-Light: Light analysis (nano)
 * - Tier 3-Heavy: Heavy analysis (mini)
 * 
 * Also handles session file caching for efficient reasoning
 */

import {
  selectModelForTier,
  getModelConfig,
  MODEL_TIERS,
  type ModelConfig,
} from './model-config.js'
import { analyzeQueryComplexity, type QueryComplexity } from './query-complexity.js'
import type { SessionFileCache } from './session-file-cache.js'

export interface ModelSelection {
  tier: 'tier1' | 'tier2' | 'tier3_light' | 'tier3_heavy'
  modelId: string
  model: ModelConfig | null
  complexity: QueryComplexity | null
  maxTokens: number
  thinkingBudget: number
  reason: string
  cachedFiles?: string[] // Files available in session cache
}

export function selectModelForQuery(
  userInput: string,
  isModification: boolean,
  fileCache?: SessionFileCache
): ModelSelection {
  // TIER 1: Direct execution (no model needed)
  if (isDirectExecutionQuery(userInput)) {
    return {
      tier: 'tier1',
      modelId: 'none',
      model: null,
      complexity: null,
      maxTokens: 0,
      thinkingBudget: 0,
      reason: 'Direct file reading, no model needed',
    }
  }

  // TIER 2: Modification queries (light reasoning with nano)
  if (isModification) {
    const modelId = selectModelForTier('modification')
    const model = getModelConfig(modelId)
    return {
      tier: 'tier2',
      modelId,
      model,
      complexity: 'light',
      maxTokens: model.maxTokens,
      thinkingBudget: model.thinkingBudget,
      reason: 'File modification - light reasoning needed',
      cachedFiles: fileCache ? fileCache.listCached() : undefined,
    }
  }

  // TIER 3: Analysis queries - split by complexity
  const complexityAnalysis = analyzeQueryComplexity(userInput)

  if (complexityAnalysis.complexity === 'heavy') {
    // TIER 3-HEAVY: Complex analysis (mini)
    const modelId = selectModelForTier('analysis_heavy')
    const model = getModelConfig(modelId)
    return {
      tier: 'tier3_heavy',
      modelId,
      model,
      complexity: 'heavy',
      maxTokens: model.maxTokens,
      thinkingBudget: model.thinkingBudget,
      reason: `Heavy reasoning needed (complexity score: ${complexityAnalysis.score})`,
      cachedFiles: fileCache ? fileCache.listCached() : undefined,
    }
  } else {
    // TIER 3-LIGHT: Simple analysis (nano)
    const modelId = selectModelForTier('analysis_light')
    const model = getModelConfig(modelId)
    return {
      tier: 'tier3_light',
      modelId,
      model,
      complexity: 'light',
      maxTokens: model.maxTokens,
      thinkingBudget: model.thinkingBudget,
      reason: `Light reasoning needed (complexity score: ${complexityAnalysis.score})`,
      cachedFiles: fileCache ? fileCache.listCached() : undefined,
    }
  }
}

/**
 * Check if query should be handled by direct execution (Tier 1)
 */
function isDirectExecutionQuery(userInput: string): boolean {
  // Simple field extraction patterns
  const simplePatterns = [
    /what'?s?.*?(version|name|description|author|license|type|main)/i,
    /show.*?(version|name|description|author|license|type|main)/i,
  ]

  // Must also mention a file
  const mentionsFile = /package\.json|config|\.env|\.ts|\.js|\.json/i.test(userInput)

  // Long queries are not direct execution
  if (userInput.trim().split(/\s+/).length > 8) {
    return false
  }

  return mentionsFile && simplePatterns.some(p => p.test(userInput))
}

/**
 * Format selection info for logging
 */
export function formatModelSelection(selection: ModelSelection): string {
  const lines = [
    `[ModelSelector] Tier: ${selection.tier}`,
    `[ModelSelector] Model: ${selection.model ? selection.model.name : 'None (direct execution)'}`,
    `[ModelSelector] Reason: ${selection.reason}`,
  ]

  if (selection.model) {
    lines.push(`[ModelSelector] Max tokens: ${selection.maxTokens}`)
    lines.push(`[ModelSelector] Thinking budget: ${selection.thinkingBudget}`)
  }

  return lines.join('\n')
}
