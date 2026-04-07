/**
 * Detect debug/fix requests and extract relevant information
 */

export function detectDebugIntent(query: string): {
  isDebug: boolean
  confidence: number
  command?: string
  errorMessage?: string
} {
  const lower = query.toLowerCase()
  
  // Check if query contains an error message (user pasted it)
  const errorMatch = query.match(/error[:\s]+([\s\S]+?)(?:\n|$)/i)
  const hasErrorPasted = errorMatch || /\b(?:error|failed|failed:|stderr|exception|uncaught|at\s+\w+\.ts:\d+)\b/i.test(query)

  const debugPatterns = [
    { pattern: /(?:something'?s? |it'?s? )(?:not working|broken|failing|erroring)/i, weight: 0.7 },
    { pattern: /(?:fix|debug|resolve|troubleshoot)\s+(?:it|the|this|my)/i, weight: 0.7 },
    { pattern: /why\s+(?:is|does|doesn't|isnt)\s+[\w\s]+(?:work|run|fail|error)/i, weight: 0.6 },
    { pattern: /^(?:run|execute|start)\s+(.+?)\s+and\s+(?:see|check|test|debug)/i, weight: 0.8 },
    { pattern: /there'?s?\s+(?:an\s+)?(?:error|bug|issue|problem)/i, weight: 0.7 },
    { pattern: /not\s+(?:working|working properly|running|executing)/i, weight: 0.6 },
  ]

  let confidence = 0
  let matchedPatterns = 0

  for (const { pattern, weight } of debugPatterns) {
    if (pattern.test(query)) {
      confidence = Math.max(confidence, weight)
      matchedPatterns++
    }
  }

  // Boost confidence if error is pasted
  if (hasErrorPasted) {
    confidence = Math.min(1.0, confidence + 0.3)
  }

  // Extract command if mentioned
  const commandMatch = query.match(/(?:run|execute|start|try)\s+(?:the\s+)?(?:command\s+)?[`"]?([^`"\n]+)[`"]?(?:\s+and|$)/i)
  const command = commandMatch?.[1]?.trim()

  // Extract error message if pasted
  const errorMsg = errorMatch?.[1]?.trim()

  return {
    isDebug: confidence >= 0.5,
    confidence,
    command,
    errorMessage: errorMsg,
  }
}

export function extractCommand(query: string): string | null {
  // Look for common commands
  const patterns = [
    /(?:run|execute|start)\s+(?:the\s+)?(?:command\s+)?[`"]?([^`"\n]+?)[`"]?(?:\s|$)/i,
    /(?:npm|bun|yarn)\s+([^\n]+?)(?:\s+and|$)/i,
    /(?:DEBUG_\w+=\w+\s+)?bun\s+(?:run\s+)?([^\n]+?)(?:\s+and|$)/i,
  ]

  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      return match[1]?.trim()
    }
  }

  return null
}
