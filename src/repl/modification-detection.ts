/**
 * Modification Intent Detection
 *
 * Determines whether a user query is asking for:
 * 1. Direct file modification (str_replace)
 * 2. File creation (create_file)
 * 3. Complex refactoring (multiple modifications)
 *
 * This is critical for the hybrid architecture:
 * - No match → use direct execution or text analysis
 * - Match → read files + call LLM with modification schemas
 */

export type ModificationType = 'edit' | 'create' | 'batch' | 'delete' | 'move' | null

export interface ModificationIntent {
  isModification: boolean
  type: ModificationType
  confidence: number
  action: string // e.g., "change", "create", "refactor"
  target: string // e.g., "file.ts", "exports", "imports"
  affectedPatterns: string[] // glob patterns for affected files
  reasoning: string // why we think this is a modification
}

/**
 * Keywords that indicate different modification types
 */
const MODIFICATION_KEYWORDS = {
  edit: [
    // Direct modifications
    'change', 'replace', 'modify', 'update', 'alter', 'edit',
    'fix', 'correct', 'adjust', 'refactor', 'clean up', 'cleanup',
    'remove', 'delete', 'strip', 'trim', 'cut',
    'add', 'insert', 'inject', 'append', 'prepend',
    'rename', 'move', 'reorder', 'reorganize',
    'convert', 'transform', 'translate', 'migrate',
    'optimize', 'improve', 'enhance', 'simplify',
    'rewrite', 'restructure', 'redesign',
  ],
  create: [
    'create', 'write', 'generate', 'make', 'new', 'init',
    'scaffold', 'setup', 'initialize',
  ],
  batch: [
    'refactor', 'migrate', 'update', 'upgrade',
    'standardize', 'normalize', 'consolidate',
  ],
  delete: [
    'delete', 'remove', 'drop', 'clean', 'purge',
  ],
  move: [
    'move', 'mv', 'rename', 'relocate', 'transfer',
  ],
}

/**
 * Code-related patterns that indicate modification context
 */
const CODE_PATTERNS = [
  // Import/export modifications
  /\b(import|export|require|module)\b/i,
  // Function/class modifications
  /\b(function|const|let|var|class|interface|type)\b/i,
  // Specific code elements
  /\b(if|else|for|while|switch|try|catch|return)\b/i,
  // File operations
  /\b(file|files|dir|directory|path)\b/i,
]

/**
 * Detect if a query is requesting code modifications
 *
 * @param query User input
 * @returns Modification intent analysis
 *
 * @example
 * isModificationRequest("change all exports to named exports")
 * // → { isModification: true, type: 'edit', confidence: 0.95, ... }
 *
 * @example
 * isModificationRequest("create a new test file")
 * // → { isModification: true, type: 'create', confidence: 0.9, ... }
 *
 * @example
 * isModificationRequest("how does this file work?")
 * // → { isModification: false, type: null, confidence: 0, ... }
 */
export function detectModificationIntent(query: string): ModificationIntent {
  const lowerQuery = query.toLowerCase()
  let confidence = 0
  let type: ModificationType = null
  let action = ''
  let affectedPatterns: string[] = []

  // Check for modification keywords
  for (const [modType, keywords] of Object.entries(MODIFICATION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        confidence += 0.35  // Boost from 0.3 to 0.35
        type = modType as ModificationType
        action = keyword
        break
      }
    }
    if (confidence > 0) break
  }

  // Boost confidence if code patterns are present
  let codePatternMatches = 0
  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(query)) {
      codePatternMatches++
    }
  }
  confidence += codePatternMatches * 0.12  // Boost from 0.1 to 0.12

  // Check for file references
  const filePattern = /\b([\w.-]+\.(?:ts|js|tsx|jsx|json|md|py|go|rb|java|cpp))\b/gi
  const fileMatches = query.match(filePattern) || []
  if (fileMatches.length > 0) {
    confidence += 0.2  // Boost from 0.15 to 0.2
    // Extract specific filenames
    affectedPatterns = fileMatches.map(f => `**/${f}`)
  } else {
    // Try to infer file patterns from context
    affectedPatterns = inferFilePatterns(query)
    if (affectedPatterns.length > 0) {
      confidence += 0.12  // Boost from 0.1 to 0.12
    }
  }

  // BONUS: If both modification keyword AND file reference exist, add extra boost
  if (confidence >= 0.35 && (fileMatches.length > 0 || affectedPatterns.length > 0)) {
    confidence += 0.1  // +10% bonus for complete modification request
  }

  // Negative signals: question words indicate analysis, not modification
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'can', 'could', 'would', 'is', 'are', 'tell', 'explain', 'describe']
  const startsWithQuestion = questionWords.some(w => lowerQuery.startsWith(w))
  if (startsWithQuestion) {
    confidence -= 0.4
  }

  // Negative signal: comparison words suggest analysis
  const comparisonWords = ['compare', 'difference', 'similar', 'versus', 'vs', 'better', 'best']
  const hasComparison = comparisonWords.some(w => lowerQuery.includes(w))
  if (hasComparison && !action.includes('refactor')) {
    confidence -= 0.3
  }

  // Clamp confidence to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence))

  const isModification = confidence >= 0.45 // Threshold

  return {
    isModification,
    type: isModification ? type : null,
    confidence,
    action,
    target: extractTarget(query),
    affectedPatterns,
    reasoning: buildReasoning(query, confidence, action, fileMatches.length),
  }
}

function inferFilePatterns(query: string): string[] {
  const lowerQuery = query.toLowerCase()
  const patterns: string[] = []

  // Package.json patterns
  if (lowerQuery.includes('package.json') || lowerQuery.includes('version') || lowerQuery.includes('dependency')) {
    patterns.push('**/package.json', '**/package-lock.json')
  }

  // Export/import patterns
  if (lowerQuery.includes('export') || lowerQuery.includes('import')) {
    patterns.push('**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx')
  }

  // Config patterns
  if (lowerQuery.includes('config') || lowerQuery.includes('setting')) {
    patterns.push('**/config.*', '**/.*rc*', '**/.config/*')
  }

  // Test patterns
  if (lowerQuery.includes('test') || lowerQuery.includes('spec')) {
    patterns.push('**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js')
  }

  // Readme/docs
  if (lowerQuery.includes('readme') || lowerQuery.includes('documentation')) {
    patterns.push('**/README.*', '**/*.md')
  }

  // General TypeScript/JavaScript
  if (patterns.length === 0 && (lowerQuery.includes('code') || lowerQuery.includes('file'))) {
    patterns.push('**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx')
  }

  return [...new Set(patterns)] // Deduplicate
}

/**
 * Extract the primary target of modification from query
 *
 * @example
 * "change all exports to named exports" → "exports"
 * "fix the UserService class" → "UserService"
 * "update package.json" → "package.json"
 */
function extractTarget(query: string): string {
  // Look for explicit filenames
  const fileMatch = query.match(/\b([\w.-]+\.(?:ts|js|tsx|jsx|json|md|py|go|rb|java|cpp))\b/i)
  if (fileMatch) return fileMatch[1]

  // Look for code elements
  const codeElements = [
    'export', 'import', 'function', 'class', 'interface', 'type',
    'variable', 'const', 'let', 'var', 'config', 'test'
  ]
  for (const element of codeElements) {
    if (query.toLowerCase().includes(element)) {
      return element
    }
  }

  return 'code'
}

/**
 * Build human-readable reasoning for the detection
 */
function buildReasoning(
  query: string,
  confidence: number,
  action: string,
  fileCount: number
): string {
  const reasons: string[] = []

  if (action) {
    reasons.push(`Found action verb: "${action}"`)
  }

  if (fileCount > 0) {
    reasons.push(`Found ${fileCount} file reference(s)`)
  }

  if (confidence < 0.5) {
    reasons.push('Low confidence - may be question/analysis instead')
  }

  if (query.toLowerCase().includes('?')) {
    reasons.push('Query contains question mark - likely question, not instruction')
  }

  return reasons.join(' | ') || 'Modification intent unclear'
}

/**
 * Score how "modification-y" a query is
 * Used for logging and debugging
 */
export function scoreModificationConfidence(query: string): number {
  return detectModificationIntent(query).confidence
}

/**
 * Batch detection: analyze multiple queries
 * Useful for understanding user intent over conversation
 */
export function detectModificationIntentBatch(queries: string[]): {
  modificationQueries: string[]
  analysisQueries: string[]
  ratio: number // % that are modifications
} {
  const results = queries.map(q => detectModificationIntent(q))
  const modificationQueries = queries.filter((_, i) => results[i].isModification)
  const analysisQueries = queries.filter((_, i) => !results[i].isModification)

  return {
    modificationQueries,
    analysisQueries,
    ratio: modificationQueries.length / queries.length,
  }
}
