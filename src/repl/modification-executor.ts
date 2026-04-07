/**
 * Modification Executor
 *
 * Handles the complete LLM-driven modification workflow:
 * 1. Detect modification intent
 * 2. Discover affected files
 * 3. Call LLM with file context + modification tool schemas
 * 4. Parse and execute tool calls
 * 5. Report results to user
 */

import type { ToolUseContext } from '../Tool.js'
import type { ModificationIntent } from './modification-detection.js'
import type { DiscoveredFile } from './file-discovery.js'

/**
 * Modification tool schemas - minimal set sent to LLM for code changes
 * Saves ~100 tokens compared to sending all 27 tool definitions
 */
export const MODIFICATION_TOOL_SCHEMAS = [
  {
    name: 'str_replace',
    description:
      'Replace a specific string in a file. Find the exact string to replace, including indentation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to modify',
        },
        old_str: {
          type: 'string',
          description:
            'The exact string to find and replace. Must include exact indentation/whitespace.',
        },
        new_str: {
          type: 'string',
          description: 'The new string to replace with. Must include proper indentation.',
        },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file with the specified content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path where the file will be created',
        },
        contents: {
          type: 'string',
          description: 'The complete file contents',
        },
      },
      required: ['path', 'contents'],
    },
  },
  {
    name: 'append_file',
    description: 'Append content to an existing file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to append to',
        },
        text: {
          type: 'string',
          description: 'Text to append',
        },
      },
      required: ['path', 'text'],
    },
  },
]

/**
 * System prompt for modification tasks
 * Instructs LLM how to use modification tools effectively
 */
export function getModificationSystemPrompt(): string {
  return `You are a code assistant helping to modify files.

When the user asks you to modify code:
1. Read the provided file contents carefully
2. Identify the exact string that needs to be changed (including whitespace/indentation)
3. Use the str_replace tool to make precise changes
4. For new files, use create_file tool

IMPORTANT: When using str_replace:
- The old_str MUST be the exact text including indentation
- Don't summarize or shorten - get the exact string
- Preserve formatting and comments
- Make multiple str_replace calls if needed for multiple changes

Verify your changes:
- Check that old_str exists in the file
- Ensure new_str maintains proper formatting
- Keep the intent of the original code

Provide clear explanations of what you changed and why.`
}

/**
 * LLM response containing tool calls for modifications
 */
export interface ModificationToolCall {
  id: string
  name: 'str_replace' | 'create_file' | 'append_file'
  input: Record<string, unknown>
}

export interface ModificationResponse {
  toolCalls: ModificationToolCall[]
  explanation: string
  changes: Array<{
    type: string
    file: string
    summary: string
  }>
}

/**
 * Execute modifications via LLM
 *
 * Flow:
 * 1. Format discovered files for LLM context
 * 2. Call LLM with user query + file context + modification schemas
 * 3. Parse tool calls from response
 * 4. Execute each modification
 * 5. Report what changed
 */
export async function executeModifications(args: {
  query: string
  intent: ModificationIntent
  discoveredFiles: DiscoveredFile[]
  toolContext: ToolUseContext
  onToken?: (token: string) => void
  onToolCall?: (toolCall: ModificationToolCall) => void
}): Promise<ModificationResponse> {
  const { query, intent, discoveredFiles, toolContext, onToken, onToolCall } = args

  // Step 1: Format files for LLM context
  const fileContext = formatFilesForModificationContext(discoveredFiles)

  // Step 2: Build LLM message
  const messages = [
    {
      role: 'user' as const,
      content: `${fileContext}\n\nUser request: ${query}`,
    },
  ]

  process.stderr.write(`[ModificationExecutor] Calling LLM for modification\n`)
  process.stderr.write(`[ModificationExecutor] Query: ${query}\n`)
  process.stderr.write(`[ModificationExecutor] Files: ${discoveredFiles.map(f => f.path).join(', ')}\n`)
  process.stderr.write(`[ModificationExecutor] Intent type: ${intent.type}\n`)

  // Step 3: Call LLM (this would be implemented in REPL.ts)
  // For now, return mock response for documentation
  const mockToolCalls: ModificationToolCall[] = [
    {
      id: '1',
      name: 'str_replace',
      input: {
        path: discoveredFiles[0]?.path,
        old_str: 'var helper = () => {}',
        new_str: 'const helper = () => {}',
      },
    },
  ]

  // Step 4: Execute tool calls
  const changes = []
  for (const toolCall of mockToolCalls) {
    onToolCall?.(toolCall)

    try {
      const result = await executeModificationToolCall(toolCall, toolContext)
      changes.push({
        type: toolCall.name,
        file: (toolCall.input.path as string) || 'unknown',
        summary: result,
      })

      process.stderr.write(`[ModificationExecutor] ✓ ${toolCall.name} succeeded\n`)
    } catch (err) {
      process.stderr.write(`[ModificationExecutor] ✗ ${toolCall.name} failed: ${err}\n`)
      throw err
    }
  }

  // Step 5: Build response
  return {
    toolCalls: mockToolCalls,
    explanation: `Applied ${mockToolCalls.length} modification(s)`,
    changes,
  }
}

/**
 * Execute a single modification tool call
 */
async function executeModificationToolCall(
  toolCall: ModificationToolCall,
  toolContext: ToolUseContext
): Promise<string> {
  const { name, input } = toolCall

  // In real implementation, would call actual tools:
  // const tool = toolContext.options.tools.find(t => t.name === 'FileEdit')
  // return tool.call(input)

  switch (name) {
    case 'str_replace':
      return `Replaced in ${input.path}: "${String(input.old_str).substring(0, 50)}..." → "${String(input.new_str).substring(0, 50)}..."`

    case 'create_file':
      return `Created ${input.path} (${String(input.contents).length} bytes)`

    case 'append_file':
      return `Appended to ${input.path} (${String(input.text).length} bytes)`

    default:
      throw new Error(`Unknown modification tool: ${name}`)
  }
}

/**
 * Format discovered files for LLM context
 *
 * Groups by priority, provides clear structure, includes file headers
 */
function formatFilesForModificationContext(files: DiscoveredFile[]): string {
  if (files.length === 0) {
    return '⚠️  No files discovered for modification. Please specify file paths explicitly.'
  }

  let result = '# Files to Modify:\n\n'

  // Sort by priority (most relevant first)
  const sorted = [...files].sort((a, b) => b.priority - a.priority)

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i]
    const relevance = ((file.priority * 100) | 0) + '%'

    result += `## File ${i + 1}: \`${file.path}\` (relevance: ${relevance})\n`

    if (!file.isReadable) {
      result += '⚠️  (Could not read this file)\n\n'
      continue
    }

    if (!file.content) {
      result += '(No content)\n\n'
      continue
    }

    // Wrap content in code block with language hint
    const lang = detectLanguageFromPath(file.path)
    result += `\`\`\`${lang}\n`
    result += file.content
    result += '\n```\n\n'
  }

  return result
}

/**
 * Detect programming language from file path for syntax highlighting hints
 */
function detectLanguageFromPath(path: string): string {
  const lower = path.toLowerCase()

  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return 'markdown'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.java')) return 'java'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.rs')) return 'rust'

  return 'plaintext'
}

/**
 * Validate a modification tool call before execution
 *
 * Checks:
 * - File path is within allowed scope
 * - str_replace has valid inputs
 * - File exists (for str_replace, append)
 * - File doesn't exist (for create_file)
 */
export async function validateModificationToolCall(
  toolCall: ModificationToolCall,
  scopeValidator: (path: string) => boolean,
  fileOps: { exists: (path: string) => Promise<boolean> }
): Promise<{ valid: boolean; reason?: string }> {
  const { name, input } = toolCall
  
  // Read and Write tools use file_path, others use path
  const filePath = (name === 'Read' || name === 'Write' ? input.file_path : input.path) as string

  if (!filePath) {
    return { valid: false, reason: `${name}: file path is required` }
  }

  // Check file scope
  if (!scopeValidator(filePath)) {
    return { valid: false, reason: `File ${filePath} is outside allowed scope` }
  }

  // Validate by tool type
  switch (name) {
    case 'Read': {
      const exists = await fileOps.exists(filePath)
      if (!exists) {
        return { valid: false, reason: `Read: file ${filePath} does not exist` }
      }
      break
    }

    case 'str_replace': {
      const oldStr = input.old_str as string
      const newStr = input.new_str as string

      if (!oldStr || !newStr) {
        return { valid: false, reason: 'str_replace: old_str and new_str must be non-empty' }
      }

      const exists = await fileOps.exists(filePath)
      if (!exists) {
        return { valid: false, reason: `str_replace: file ${filePath} does not exist` }
      }

      break
    }

    case 'create_file': {
      const contents = input.contents as string

      if (typeof contents !== 'string') {
        return { valid: false, reason: 'create_file: contents must be a string' }
      }

      const exists = await fileOps.exists(filePath)
      if (exists) {
        return { valid: false, reason: `create_file: file ${filePath} already exists` }
      }

      break
    }

    case 'append_file': {
      const text = input.text as string

      if (!text) {
        return { valid: false, reason: 'append_file: text must be non-empty' }
      }

      const exists = await fileOps.exists(filePath)
      if (!exists) {
        return { valid: false, reason: `append_file: file ${filePath} does not exist` }
      }

      break
    }

    case 'Write': {
      const content = input.content as string

      if (typeof content !== 'string') {
        return { valid: false, reason: 'Write: content must be a string' }
      }

      // Write can create or overwrite files - no existence check needed
      break
    }

    default: {
      return { valid: false, reason: `Unknown tool: ${name}` }
    }
  }

  return { valid: true }
}

/**
 * Build a summary of what modifications were made
 */
export function summarizeModifications(response: ModificationResponse): string {
  if (response.changes.length === 0) {
    return 'No modifications made.'
  }

  let summary = `✓ Applied ${response.changes.length} modification(s):\n\n`

  for (const change of response.changes) {
    summary += `• ${change.type.toUpperCase()} in \`${change.file}\`\n`
    summary += `  ${change.summary}\n`
  }

  return summary
}
