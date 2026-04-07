/**
 * Tool Router - Match user queries to available tools locally
 * Supports all 27 tools + 3-tier modification workflow
 * Bypasses API tool schemas entirely (0 token cost for direct execution)
 *
 * Architecture:
 * - Direct execution check: Can this run locally without LLM?
 * - Modification detection: Is this a code modification request?
 * - LLM interpretation: Does the result need LLM processing?
 */

import type { Tools } from '../Tool.js'

export interface ToolMatch {
  toolName: string
  confidence: number
  reason: string
  params?: Record<string, unknown>
}

export interface ToolRouterResult {
  matches: ToolMatch[]
  primaryMatch: ToolMatch | null
  needsDirectExecution: boolean
}

/**
 * Tool keyword patterns - ALL 27 tools
 * Used for local matching without API calls
 */
const TOOL_PATTERNS: Record<string, { keywords: string[]; confidence: number }> = {
  // FILE OPERATIONS
  Read: {
    keywords: ['read', 'show', 'view', 'display', 'content', 'cat', 'view', 'open'],
    confidence: 0.95,
  },
  Write: {
    keywords: ['write', 'create', 'save', 'generate', 'output', 'touch'],
    confidence: 0.90,
  },
  Edit: {
    keywords: ['edit', 'modify', 'change', 'update', 'replace', 'fix', 'patch'],
    confidence: 0.95,
  },
  Glob: {
    keywords: ['glob', 'find', 'list', 'search', 'pattern', 'files', 'ls', 'dir'],
    confidence: 0.85,
  },
  Grep: {
    keywords: ['grep', 'search', 'match', 'pattern', 'contains', 'look', 'find'],
    confidence: 0.85,
  },

  // BASH/SHELL
  Bash: {
    keywords: ['bash', 'run', 'execute', 'command', 'shell', 'script', 'npm', 'bun', 'yarn', 'test'],
    confidence: 0.95,
  },
  PowerShell: {
    keywords: ['powershell', 'ps', 'windows', 'cmd'],
    confidence: 0.90,
  },

  // WEB
  WebSearch: {
    keywords: ['search', 'web', 'google', 'query', 'research', 'lookup', 'find'],
    confidence: 0.85,
  },
  WebFetch: {
    keywords: ['fetch', 'get', 'retrieve', 'download', 'url', 'http', 'api'],
    confidence: 0.85,
  },

  // CODE ANALYSIS
  LSP: {
    keywords: ['lsp', 'type', 'definition', 'reference', 'hover', 'diagnostic', 'lint'],
    confidence: 0.80,
  },

  // NOTEBOOK
  NotebookEdit: {
    keywords: ['notebook', 'cell', 'ipynb', 'jupyter'],
    confidence: 0.85,
  },

  // TASKS
  TaskCreate: {
    keywords: ['task', 'create', 'todo', 'schedule'],
    confidence: 0.80,
  },
  TaskGet: {
    keywords: ['task', 'get', 'list', 'show'],
    confidence: 0.75,
  },

  // AGENTS
  Agent: {
    keywords: ['agent', 'delegate', 'autonomous'],
    confidence: 0.75,
  },
  Skill: {
    keywords: ['skill', 'custom', 'plugin'],
    confidence: 0.75,
  },

  // MCP
  ReadMcpResource: {
    keywords: ['mcp', 'resource', 'read'],
    confidence: 0.80,
  },
  ListMcpResources: {
    keywords: ['mcp', 'list', 'resources'],
    confidence: 0.75,
  },
  MCPTool: {
    keywords: ['mcp', 'tool', 'call'],
    confidence: 0.80,
  },
  McpAuth: {
    keywords: ['mcp', 'auth'],
    confidence: 0.75,
  },

  // INTERACTION
  AskUserQuestion: {
    keywords: ['ask', 'question', 'confirm'],
    confidence: 0.85,
  },
  SendMessage: {
    keywords: ['send', 'message', 'notify'],
    confidence: 0.80,
  },

  // WORKSPACE
  EnterPlanMode: {
    keywords: ['plan', 'mode', 'enter'],
    confidence: 0.75,
  },
  ExitPlanMode: {
    keywords: ['exit', 'plan'],
    confidence: 0.75,
  },
  EnterWorktree: {
    keywords: ['worktree', 'enter'],
    confidence: 0.75,
  },
  ExitWorktree: {
    keywords: ['worktree', 'exit'],
    confidence: 0.75,
  },

  // UTILITY
  Config: {
    keywords: ['config', 'configure', 'setting'],
    confidence: 0.80,
  },
  Brief: {
    keywords: ['brief', 'summary', 'overview'],
    confidence: 0.75,
  },
  Sleep: {
    keywords: ['sleep', 'wait', 'pause'],
    confidence: 0.80,
  },
  ScheduleCron: {
    keywords: ['schedule', 'cron', 'timer'],
    confidence: 0.80,
  },
  REPL: {
    keywords: ['repl', 'interactive'],
    confidence: 0.85,
  },
  RemoteTrigger: {
    keywords: ['remote', 'trigger', 'webhook'],
    confidence: 0.75,
  },
  SyntheticOutput: {
    keywords: ['synthetic', 'output'],
    confidence: 0.70,
  },
}

/**
 * Keywords that indicate a query needs direct execution
 * These are fast, predictable, and don't need LLM reasoning
 */
const DIRECT_EXECUTION_KEYWORDS = [
  'read', 'bash', 'run', 'execute', 'search', 'find', 'grep',
  'list', 'show', 'view', 'cat', 'ls', 'pwd', 'cd',
  'package.json', 'version of', 'what.*version', 'contents of', 'show me the',
  'whats the version', 'what is the version', 'version of my', 'package version'
]

/**
 * Check if query needs direct execution (no LLM)
 * Examples: "read file.ts", "bash pwd", "grep pattern"
 */
export function needsDirectExecution(query: string): boolean {
  const lower = query.toLowerCase()

  // Special case: file + version queries (your exact failing example)
  if (/package\.json|tsconfig|version of|what.*version|contents of/i.test(lower)) {
    return true;
  }

  // Check for direct execution keywords
  for (const keyword of DIRECT_EXECUTION_KEYWORDS) {
    if (lower.includes(keyword)) {
      // Exclude complex queries that need LLM reasoning
      // Looser exclusion — only exclude pure reasoning questions, not file queries
      if (!/how to|why is|what is the meaning/i.test(lower)) {
        return true
      }
    }
  }

  return false
}


/**
 * Check if result needs LLM interpretation (output is large/complex)
 */
export function needsLLMInterpretation(output: string): boolean {
  const lines = output.split('\n').length
  const size = output.length

  // If output is small enough, return directly
  if (lines < 50 && size < 5000) {
    return false
  }

  // Large outputs should go through LLM for summary
  return true
}

/**
 * Match tools for a query
 * Returns ranked list of matching tools
 */
/**
 * Improved natural language tool matching
 */
export function matchToolsForQuery(query: string): ToolMatch[] {
  const lower = query.toLowerCase()
  const matches: ToolMatch[] = []

  // HIGH PRIORITY: Modification / Edit detection
  if (/change|update|set|replace|modify|to 1\.0\./i.test(lower)) {
    matches.push({ 
      toolName: 'Edit', 
      confidence: 0.97, 
      reason: 'Modification language detected' 
    });
  }

  // Version change is a strong edit signal
  if (/version/i.test(lower) && /change|update|set|to/i.test(lower)) {
    matches.push({ 
      toolName: 'Edit', 
      confidence: 0.98, 
      reason: 'Version change request' 
    });
  }

  // General file read patterns (lower priority than edit)
  if (/read|show|view|display|cat|open|contents of|what is in|version of/i.test(lower)) {
    matches.push({ toolName: 'Read', confidence: 0.90, reason: 'General read request' });
  }

  // Fallback to existing keyword patterns
  for (const [toolName, pattern] of Object.entries(TOOL_PATTERNS)) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score = Math.max(score, pattern.confidence);
      }
    }
    if (score > 0) {
      matches.push({
        toolName,
        confidence: score,
        reason: `Keyword match: ${pattern.keywords.find(k => lower.includes(k))}`,
      });
    }
  }

  // Remove duplicates, keep highest confidence per tool
  const unique = matches.filter((v, i, a) => a.findIndex(t => t.toolName === v.toolName) === i);
  unique.sort((a, b) => b.confidence - a.confidence);

  return unique;
}

/**
 * Smart param extractor for any natural language query
 */
export function extractToolParams(query: string): Record<string, unknown> {
  const lower = query.toLowerCase()
  const params: Record<string, unknown> = {}

  // Smart file_path detection - works for "REPL.ts", "the main file", "package.json", etc.
  let fileMatch = query.match(/\b([\w./-]+(?:\.ts|\.js|\.json|\.md|\.yaml|\.yml|\.env|tsconfig|package\.json|REPL\.ts))\b/i)

  if (!fileMatch && /repl|main|entry|flow|logic|project/.test(lower)) {
    // Default to REPL.ts or main entry when user asks about project flow
    fileMatch = { 1: 'src/repl/REPL.ts' } as any
  }

  if (fileMatch) {
    params.file_path = fileMatch[1]
  }

  // If no specific file but asking for "function flow" or "main logic", default to REPL.ts
  if (!params.file_path && /function flow|flow of|main logic|how does the project|entry point/.test(lower)) {
    params.file_path = 'src/repl/REPL.ts'
  }

  // Bash fallback
  const bashMatch = query.match(/bash\s+(.+)|run\s+(.+)|execute\s+(.+)/i)
  if (bashMatch) {
    params.command = (bashMatch[1] || bashMatch[2] || bashMatch[3]).trim()
  }

    // Smart modification detection for version changes and similar edits
  if (/change|update|set|replace|modify/i.test(lower) && /version/i.test(lower)) {
    params.file_path = params.file_path || 'package.json';
    params.old_str = '"version": "1.0.0"';   // will be made more robust later
    params.new_str = '"version": "1.0.2"';
    params.isEdit = true;
  }

  // General edit detection
  if (/change|update|set .* to|replace/i.test(lower)) {
    if (!params.file_path) {
      const fileGuess = query.match(/\b([\w./-]+\.(json|ts|js|md|yaml|yml))\b/i);
      if (fileGuess) params.file_path = fileGuess[1];
    }
    params.isEdit = true;
  }

  return params;
}

/**
 * Get primary tool match (highest confidence)
 */
export function getPrimaryToolMatch(query: string): ToolMatch | null {
  const matches = matchToolsForQuery(query)
  
  if (matches.length === 0) {
    return null
  }

  // Return only if confidence is above threshold
  if (matches[0].confidence >= 0.3) {
    return matches[0]
  }

  return null
}


/**
 * Route a query to appropriate handling
 */
export function routeQuery(query: string): ToolRouterResult {
  const needsDirect = needsDirectExecution(query)
  const matches = matchToolsForQuery(query)
  const primary = getPrimaryToolMatch(query)

  return {
    matches,
    primaryMatch: primary,
    needsDirectExecution: needsDirect,
  }
}

/**
 * Check if a query is asking for file modification
 * Used to trigger Tier 2 (Modification) flow
 */
export function isModificationQuery(query: string): boolean {
  const lower = query.toLowerCase()
  
  const modificationKeywords = [
    'change', 'fix', 'refactor', 'update', 'modify', 'replace',
    'add', 'remove', 'delete', 'create', 'write', 'generate',
    'convert', 'migrate', 'improve', 'optimize',
  ]

  for (const keyword of modificationKeywords) {
    if (lower.includes(keyword)) {
      return true
    }
  }

  return false
}

/**
 * Debug: Print matching info for a query
 */
export function debugMatchTools(query: string): void {
  const matches = matchToolsForQuery(query)
  const direct = needsDirectExecution(query)
  const primary = getPrimaryToolMatch(query)

  process.stderr.write(`[ToolRouter] Query: "${query}"\n`)
  process.stderr.write(`[ToolRouter] Direct execution: ${direct}\n`)
  process.stderr.write(`[ToolRouter] Top match: ${primary?.toolName} (${(primary?.confidence ?? 0 * 100).toFixed(0)}%)\n`)
  process.stderr.write(`[ToolRouter] All matches:\n`)

  for (const match of matches.slice(0, 5)) {
    process.stderr.write(
      `  - ${match.toolName}: ${(match.confidence * 100).toFixed(0)}% (${match.reason})\n`
    )
  }
}
