/**
 * Modification Intent Detection (Simplified)
 * Detects: edit, create, delete, move requests
 */

export interface ModificationIntent {
  isModification: boolean
  type: 'edit' | 'create' | 'delete' | 'move' | null
  confidence: number
}

export function detectModificationIntent(query: string): ModificationIntent {
  const lower = query.toLowerCase()
  let confidence = 0
  let type: 'edit' | 'create' | 'delete' | 'move' | null = null

  // Edit keywords
  if (/\b(change|fix|refactor|modify|update|replace|remove|add|rename|convert|optimize|improve)\b/.test(lower)) {
    confidence = 0.85
    type = 'edit'
  }

  // Create keywords
  if (/\b(create|write|generate|new|make|scaffold)\b/.test(lower)) {
    confidence = 0.90
    type = 'create'
  }

  // Delete keywords
  if (/\b(delete|remove|drop)\b/.test(lower)) {
    confidence = 0.80
    type = 'delete'
  }

  // Move keywords
  if (/\b(move|rename|mv)\b/.test(lower)) {
    confidence = 0.75
    type = 'move'
  }

  // Negative signals
  if (/\b(how|what|why|explain|describe|compare)\b/.test(lower) && type === null) {
    confidence = Math.max(0, confidence - 0.5)
  }

  return {
    isModification: confidence >= 0.45,
    type: confidence >= 0.45 ? type : null,
    confidence: Math.min(1, Math.max(0, confidence)),
  }
}
