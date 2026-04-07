/**
 * Query Complexity Detection
 * Routes queries to appropriate reasoning model tier:
 * - light: gpt-5.4-nano (simpler tasks)
 * - heavy: gpt-5.4-mini (complex analysis)
 */

export type QueryComplexity = 'light' | 'heavy'

export interface ComplexityAnalysis {
  complexity: QueryComplexity
  score: number // 0-10, where 0-4 is light, 5-10 is heavy
  reasons: string[]
}

/**
 * Calculate complexity score (0-10)
 * Light reasoning (0-4): Simple modifications, basic explanations
 * Heavy reasoning (5-10): Architecture, deep analysis, why questions
 */
export function analyzeQueryComplexity(userInput: string): ComplexityAnalysis {
  const input = userInput.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Heavy indicators (add 3 points each)
  const heavyPatterns = [
    /\b(why|explain.*why|how.*work|architecture|design|pattern|implement|comprehensive|detailed|deeply|exactly|understand|reasoning)\b/i,
    /\b(system|flow|integration|relationship|dependency|structure|organize)\b/i,
    /\b(multiple|various|different|compare|contrast|alternative)\b/i,
  ]

  for (const pattern of heavyPatterns) {
    if (pattern.test(input)) {
      score += 3
      reasons.push(`Heavy pattern: ${pattern.source.slice(0, 30)}...`)
    }
  }

  // Medium indicators (add 1-2 points each)
  const mediumPatterns = [
    /\b(explain|how does|what is|describe|show|tell)\b/i,
    /\b(modify|change|update|fix|improve)\b/i,
    /\b(analyze|review|check|verify)\b/i,
  ]

  for (const pattern of mediumPatterns) {
    if (pattern.test(input)) {
      score += 2
      reasons.push(`Medium pattern: ${pattern.source.slice(0, 20)}...`)
    }
  }

  // Light indicators (add 0-1 points, don't add to heavy)
  const lightIndicators = [/\b(simple|quick|fast|just|only|simple)\b/i]

  for (const pattern of lightIndicators) {
    if (pattern.test(input)) {
      score = Math.max(0, score - 1)
      reasons.push(`Light indicator detected`)
    }
  }

  // File/code context multiplier (heavy)
  const fileCount = (input.match(/\b(file|code|system|config|setup|architecture)\b/gi) || []).length
  if (fileCount >= 2) {
    score += 2
    reasons.push(`Multiple code/system references (+${fileCount * 1})`)
  }

  // Single word commands are light (e.g., just "update" or "fix")
  const wordCount = input.trim().split(/\s+/).length
  if (wordCount <= 3) {
    score = Math.min(4, score) // Cap at light level
    reasons.push('Single/simple command (short input)')
  }

  // Long explanations are heavier
  if (wordCount > 20) {
    score += 1
    reasons.push('Complex query (long input)')
  }

  // Clamp score 0-10
  score = Math.max(0, Math.min(10, score))

  const complexity: QueryComplexity = score <= 4 ? 'light' : 'heavy'

  return { complexity, score, reasons }
}

/**
 * Simple boolean check for routing
 */
export function requiresHeavyReasoning(userInput: string): boolean {
  return analyzeQueryComplexity(userInput).complexity === 'heavy'
}

/**
 * Get thinking budget based on complexity
 */
export function getThinkingBudget(complexity: QueryComplexity): number {
  return complexity === 'light' ? 2000 : 8000
}

/**
 * Get max output tokens based on complexity
 */
export function getMaxOutputTokens(complexity: QueryComplexity): number {
  return complexity === 'light' ? 4096 : 16000
}
