/**
 * Tool Router - Match user queries to available tools locally
 * Supports all 27 tools + 3-tier modification workflow
 * Bypasses API tool schemas entirely (0 token cost for direct execution)
 */

import type { Tools } from '../Tool.js'
import { detectModificationIntent } from './modification-intent.js'

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

  // Tool keyword mappings - ALL 27 TOOLS
  const toolPatterns: Record<string, { keywords: string[]; confidence: number; modification?: boolean }> = {
    // FILE OPERATIONS (Direct execution tier)
    Read: {
      keywords: ['read', 'show', 'view', 'display', 'content', 'file', 'check', 'what', 'line', 'cat'],
      confidence: 0.95,
    },
    Write: {
      keywords: ['write', 'create', 'save', 'generate', 'output', 'file', 'make', 'new'],
      confidence: 0.90,
      modification: true,
    },
    Edit: {
      keywords: ['edit', 'modify', 'change', 'update', 'replace', 'fix', 'patch', 'refactor'],
      confidence: 0.95,
      modification: true,
    },
    Glob: {
      keywords: ['glob', 'find', 'list', 'search', 'pattern', 'files', 'ls', 'dir'],
      confidence: 0.85,
    },
    Grep: {
      keywords: ['grep', 'search', 'find', 'match', 'pattern', 'contains', 'look'],
      confidence: 0.85,
    },

    // BASH/SHELL (Direct execution tier)
    Bash: {
      keywords: ['bash', 'run', 'execute', 'command', 'shell', 'script', 'npm', 'bun', 'yarn', 'make', 'test'],
      confidence: 0.95,
    },
    PowerShell: {
      keywords: ['powershell', 'ps', 'windows', 'cmd', 'command'],
      confidence: 0.90,
    },

    // WEB (Direct execution tier)
    WebSearch: {
      keywords: ['search', 'web', 'find', 'google', 'query', 'research', 'lookup'],
      confidence: 0.85,
    },
    WebFetch: {
      keywords: ['fetch', 'get', 'retrieve', 'download', 'url', 'http', 'api'],
      confidence: 0.85,
    },

    // CODE ANALYSIS
    LSP: {
      keywords: ['lsp', 'type', 'definition', 'reference', 'hover', 'diagnostic', 'error', 'lint'],
      confidence: 0.80,
    },

    // NOTEBOOK/CELL OPERATIONS
    NotebookEdit: {
      keywords: ['notebook', 'cell', 'ipynb', 'jupyter'],
      confidence: 0.85,
      modification: true,
    },

    // TASKS/WORKFLOW
    TaskCreate: {
      keywords: ['task', 'create', 'todo', 'schedule', 'add'],
      confidence: 0.80,
      modification: true,
    },
    TaskGet: {
      keywords: ['task', 'get', 'list', 'show', 'view'],
      confidence: 0.75,
    },

    // AGENTS/SKILLS
    Agent: {
      keywords: ['agent', 'delegate', 'autonomous', 'run'],
      confidence: 0.75,
    },
    Skill: {
      keywords: ['skill', 'custom', 'function', 'plugin', 'extension'],
      confidence: 0.75,
    },

    // MCP (Model Context Protocol)
    ReadMcpResource: {
      keywords: ['mcp', 'resource', 'read', 'fetch'],
      confidence: 0.80,
    },
    ListMcpResources: {
      keywords: ['mcp', 'list', 'resources', 'available'],
      confidence: 0.75,
    },
    MCPTool: {
      keywords: ['mcp', 'tool', 'call'],
      confidence: 0.80,
    },
    McpAuth: {
      keywords: ['mcp', 'auth', 'authenticate'],
      confidence: 0.75,
    },

    // INTERACTION
    AskUserQuestion: {
      keywords: ['ask', 'question', 'confirm', 'prompt', 'user'],
      confidence: 0.85,
    },
    SendMessage: {
      keywords: ['send', 'message', 'notify', 'alert'],
      confidence: 0.80,
      modification: true,
    },

    // WORKSPACE/MODE
    EnterPlanMode: {
      keywords: ['plan', 'mode', 'enter', 'start'],
      confidence: 0.75,
    },
    ExitPlanMode: {
      keywords: ['exit', 'plan', 'mode', 'end'],
      confidence: 0.75,
    },
    EnterWorktree: {
      keywords: ['worktree', 'enter', 'switch'],
      confidence: 0.75,
    },
    ExitWorktree: {
      keywords: ['worktree', 'exit', 'leave'],
      confidence: 0.75,
    },

    // UTILITY
    Config: {
      keywords: ['config', 'configure', 'setting', 'setup'],
      confidence: 0.80,
    },
    Brief: {
      keywords: ['brief', 'summary', 'overview'],
      confidence: 0.75,
    },
    Sleep: {
      keywords: ['sleep', 'wait', 'pause', 'delay'],
      confidence: 0.80,
    },
    ScheduleCron: {
      keywords: ['schedule', 'cron', 'timer'],
      confidence: 0.80,
      modification: true,
    },
    REPL: {
      keywords: ['repl', 'interactive', 'shell'],
      confidence: 0.85,
    },
    RemoteTrigger: {
      keywords: ['remote', 'trigger', 'webhook', 'callback'],
      confidence: 0.75,
    },
    SyntheticOutput: {
      keywords: ['synthetic', 'output', 'generate'],
      confidence: 0.70,
    },
  }

  // Check modification intent
  const modIntent = detectModificationIntent(userQuery)

  // Score all tools
  for (const [toolName, pattern] of Object.entries(toolPatterns)) {
    let score = 0

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (query.includes(keyword)) {
        score = Math.max(score, pattern.confidence)
        break
      }
    }

    // Boost if modification tool and query is modification
    if (pattern.modification && modIntent.isModification) {
      score = Math.max(score, pattern.confidence * 0.9)
    }

    if (score > 0.3) {
      const tool = availableTools.find((t) => t.name === toolName)
      if (tool) {
        matches.push({
          tool,
          confidence: score,
          reason: `Matched keyword(s) for ${toolName}`,
        })
      }
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Determine if query needs direct execution (0 tokens)
 * or LLM-based modification (40-60 tokens)
 */
export function getExecutionTier(
  userQuery: string,
  matchedTools: ToolMatch[]
): 'direct' | 'modification' | 'analysis' {
  // Tier 1: Direct execution (read/bash/simple actions)
  const directTools = ['Read', 'Bash', 'PowerShell', 'Glob', 'Grep']
  if (matchedTools.some((m) => directTools.includes(m.tool.name)) && matchedTools[0]?.confidence > 0.6) {
    return 'direct'
  }

  // Tier 2: Modification (needs LLM + specific tools)
  const modificationTools = ['Write', 'Edit', 'NotebookEdit', 'TaskCreate']
  const modIntent = detectModificationIntent(userQuery)
  if (modIntent.isModification && modificationTools.some((t) => matchedTools.map((m) => m.tool.name).includes(t))) {
    return 'modification'
  }

  // Tier 3: Analysis/Question
  return 'analysis'
}

/**
 * Check if query suggests direct tool execution
 */
export function needsDirectExecution(userQuery: string): boolean {
  const query = userQuery.toLowerCase()
  // Quick check for direct execution keywords
  const directKeywords = [
    'bash',
    'run',
    'execute',
    'read',
    'show',
    'view',
    'find',
    'grep',
    'search',
    'ls',
    'cat',
  ]
  return directKeywords.some((kw) => query.includes(kw))
}

/**
 * Check if result needs LLM interpretation (long output)
 */
export function needsLLMInterpretation(output: string): boolean {
  // If output is very long, ask LLM to summarize
  return output.split('\n').length > 50 || output.length > 5000
}
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
