/**
 * Tool Router - Match user queries to available tools locally
 * Bypasses API tool schemas entirely (0 token cost)
 */

import type { Tools } from '../Tool.js'

export interface ToolMatch {
  tool: any
  confidence: number
  reason: string
}

/**
 * Analyze query and find matching tools from the 27 available
 * Uses tool metadata, descriptions, and keyword matching
 */
export function matchToolsForQuery(
  userQuery: string,
  availableTools: Tools
): ToolMatch[] {
  const query = userQuery.toLowerCase()
  const matches: ToolMatch[] = []

  // Tool keyword mappings - MUST match actual tool names!
  const toolPatterns: Record<string, { keywords: string[]; confidence: number }> = {
    // Actual tool names from getAllBaseTools()
    Bash: {
      keywords: [
        'bash',
        'run',
        'execute',
        'command',
        'shell',
        'script',
        'npm',
        'bun',
        'find',
        'grep',
        'ls',
      ],
      confidence: 0.95,
    },
    Read: {
      keywords: [
        'read',
        'show',
        'view',
        'display',
        'content',
        'file',
        'check',
        'what',
        'line',
        'cat',
      ],
      confidence: 0.9,
    },
    Write: {
      keywords: [
        'write',
        'create',
        'save',
        'generate',
        'output',
        'file',
        'make',
        'new',
      ],
      confidence: 0.9,
    },
    Edit: {
      keywords: [
        'edit',
        'modify',
        'change',
        'update',
        'replace',
        'fix',
        'patch',
        'refactor',
      ],
      confidence: 0.9,
    },
    WebSearch: {
      keywords: [
        'search',
        'find',
        'look',
        'query',
        'research',
        'web',
        'google',
        'info',
        'what',
      ],
      confidence: 0.85,
    },
    WebFetch: {
      keywords: [
        'fetch',
        'get',
        'download',
        'url',
        'http',
        'page',
        'website',
        'curl',
      ],
      confidence: 0.85,
    },
    Glob: {
      keywords: ['find', 'glob', 'pattern', 'list', 'files', 'search', 'ls'],
      confidence: 0.8,
    },
    Grep: {
      keywords: ['grep', 'search', 'find', 'text', 'contains', 'match', 'pattern'],
      confidence: 0.8,
    },
    Todo: {
      keywords: ['todo', 'task', 'note', 'remember', 'checklist', 'list'],
      confidence: 0.85,
    },
    Notebook: {
      keywords: ['notebook', 'ipynb', 'jupyter', 'cell', 'run'],
      confidence: 0.9,
    },
    Skill: {
      keywords: ['skill', 'ability', 'can', 'help', 'do'],
      confidence: 0.7,
    },
  }

  // Match tools based on keywords
  for (const tool of availableTools) {
    const pattern = toolPatterns[tool.name]
    if (!pattern) continue

    let matchCount = 0
    for (const keyword of pattern.keywords) {
      if (query.includes(keyword)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      // NEW: Much more lenient confidence calculation
      // 1 keyword match = 0.5 confidence, 2+ = 0.8+, 3+ = 1.0
      let confidence = pattern.confidence * Math.min(1.0, (matchCount / 2))
      
      // Boost confidence if it's a primary keyword (first 3)
      const primaryKeywords = pattern.keywords.slice(0, 3)
      const hasPrimaryMatch = primaryKeywords.some(kw => query.includes(kw))
      if (hasPrimaryMatch) {
        confidence = Math.min(1.0, confidence + 0.3)
      }
      
      matches.push({
        tool,
        confidence,
        reason: `Matched ${matchCount} keyword(s): ${pattern.keywords
          .filter((kw) => query.includes(kw))
          .join(', ')}`,
      })
    }
  }

  // Sort by confidence
  return matches.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Get primary tool match (highest confidence)
 */
export function getPrimaryToolMatch(
  userQuery: string,
  availableTools: Tools,
  minConfidence: number = 0.3  // Lowered from 0.6 to allow single keyword matches
): ToolMatch | null {
  const matches = matchToolsForQuery(userQuery, availableTools)
  const primary = matches[0]

  if (primary && primary.confidence >= minConfidence) {
    return primary
  }

  return null
}

/**
 * Check if query likely needs direct tool execution vs LLM reasoning
 */
export function needsDirectExecution(userQuery: string): boolean {
  const directKeywords = [
    'read',
    'write',
    'create',
    'execute',
    'run',
    'bash',
    'command',
    'show',
    'find',
    'search',
    'fetch',
    'download',
  ]

  const query = userQuery.toLowerCase()
  return directKeywords.some((kw) => query.includes(kw))
}

/**
 * Check if query needs LLM reasoning after tool execution
 */
export function needsLLMInterpretation(toolOutput: string): boolean {
  // If tool output is very large or complex, might need LLM to summarize/analyze
  const lines = toolOutput.split('\n').length
  const chars = toolOutput.length

  // More than 50 lines or 5KB probably needs interpretation
  return lines > 50 || chars > 5000
}

/**
 * Extract tool parameters from natural language query
 */
export function extractToolParams(
  toolName: string,
  userQuery: string
): Record<string, any> {
  const params: Record<string, any> = {}

  switch (toolName) {
    case 'Read':
      // Extract file path - match filename with extension (no spaces)
      // Filenames typically: word.extension, word-dash.ext, word_under.ext
      const fileMatch = userQuery.match(/\b([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)\b/i)
      
      if (fileMatch) {
        params.file_path = fileMatch[1].trim()
      }
      break

    case 'Write':
      // Extract file path - match filename with extension (no spaces)
      const writeMatch = userQuery.match(/\b([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)\b/i)
      if (writeMatch) params.file_path = writeMatch[1].trim()
      break

    case 'Bash':
      // Extract command - everything after "bash", "run", "execute"
      const cmdMatch = userQuery.match(/(?:bash|run|execute)\s+(.+)/i)
      if (cmdMatch) params.command = cmdMatch[1].trim()
      break

    case 'WebSearch':
      // Query is everything after search/find
      const searchMatch = userQuery.match(/(?:search|find|look for|query)\s+(.+)/i)
      params.query = (searchMatch ? searchMatch[1] : userQuery).trim()
      break

    case 'WebFetch':
      // Extract URL
      const urlMatch = userQuery.match(/(https?:\/\/[^\s]+)/i)
      if (urlMatch) params.url = urlMatch[1].trim()
      break

    case 'Glob':
      // Extract pattern
      const patternMatch = userQuery.match(/(?:find|glob|list)\s+(['"]?)([^'"]+)(['"]?)/)
      if (patternMatch) params.pattern = patternMatch[2].trim()
      break

    case 'Grep':
      // Extract pattern
      const grepMatch = userQuery.match(/(?:grep|search for)\s+(['"]?)([^'"]+)(['"]?)/)
      if (grepMatch) params.pattern = grepMatch[2].trim()
      break
  }

  return params
}
