/**
 * Tool Executor - Execute matched tools directly locally
 * Bypasses API entirely for tool execution (0 token cost)
 */

import { randomUUID } from 'crypto'
import type { Tools, ToolUseContext } from '../Tool.js'
import { matchToolsForQuery, extractToolParams } from './tool-router.js'

export interface ToolExecutionResult {
  toolName: string
  success: boolean
  output: string
  error?: string
  duration: number
}

/**
 * Execute tool directly without sending to API
 * Returns result that can be fed back to LLM if needed
 */
export async function executeTool(
  toolName: string,
  userQuery: string,
  tool: any,
  context: ToolUseContext,
  canUse: any
): Promise<ToolExecutionResult> {
  const startTime = Date.now()

  try {
    // Extract parameters from natural language
    const params = extractToolParams(toolName, userQuery)

    // Log for debugging
    process.stderr.write(`[Tool] Executing ${toolName} with params: ${JSON.stringify(params)}\n`)

    // Check permission
    let permission = 'allow'
    try {
      const permResult = await canUse()
      permission = permResult?.behavior || 'allow'
    } catch (err) {
      // If permission check fails, continue anyway
      process.stderr.write(`[Tool] Permission check failed: ${err}\n`)
    }

    if (permission !== 'allow' && permission !== true) {
      return {
        toolName,
        success: false,
        output: `Tool ${toolName} execution denied by user`,
        duration: Date.now() - startTime,
      }
    }

    // Execute tool - try different calling conventions
    let result: any

    try {
      // Try: tool.call(input, context, canUse, parentMsg)
      result = await tool.call(params, context, canUse, null)
    } catch (err1) {
      try {
        // Try: tool.call(input) - simple call
        result = await tool.call(params)
      } catch (err2) {
        try {
          // Try: tool.call with file_path as direct property
          if (params.file_path) {
            result = await tool.call({ file_path: params.file_path }, context)
          } else {
            throw err2
          }
        } catch (err3) {
          process.stderr.write(`[Tool] Call failed with all conventions: ${err3}\n`)
          throw err3
        }
      }
    }

    // Extract output from various possible response formats
    let output = ''
    try {
      if (!result) {
        output = '(no output)'
      } else if (result?.data?.file?.content) {
        output = result.data.file.content
      } else if (result?.data?.stdout) {
        output = result.data.stdout
      } else if (result?.data?.content) {
        output = result.data.content
      } else if (typeof result?.data === 'string') {
        output = result.data
      } else if (typeof result === 'string') {
        output = result
      } else if (result.content) {
        output = result.content
      } else {
        output = JSON.stringify(result, null, 2).slice(0, 500)
      }
    } catch (parseErr) {
      output = `(Could not parse tool output: ${parseErr})`
    }

    return {
      toolName,
      success: true,
      output,
      duration: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      toolName,
      success: false,
      output: '',
      error: err?.message || String(err),
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Try to execute query using matched tools first
 * Returns result or null if no direct tool match
 */
export async function tryDirectExecution(
  userQuery: string,
  availableTools: Tools,
  context: ToolUseContext,
  canUse: any
): Promise<ToolExecutionResult | null> {
  // Match tools to query
  const matches = matchToolsForQuery(userQuery, availableTools)

  if (matches.length === 0 || matches[0].confidence < 0.3) {
    return null // No confident match, need LLM
  }

  const match = matches[0]
  const result = await executeTool(
    match.tool.name,
    userQuery,
    match.tool,
    context,
    canUse
  )

  return result
}

/**
 * Format tool result for display
 */
export function formatToolResult(result: ToolExecutionResult): string {
  if (!result.success) {
    return `❌ ${result.toolName} failed: ${result.error}`
  }

  const lines = result.output.split('\n').length
  const preview =
    result.output.length > 500
      ? result.output.slice(0, 500) + '\n...(truncated)'
      : result.output

  return `✓ ${result.toolName} (${result.duration}ms, ${lines} lines):\n${preview}`
}

/**
 * Compress tool output for conversation history
 */
export function compressToolResultForHistory(
  result: ToolExecutionResult,
  maxLines: number = 20
): string {
  if (!result.success) {
    return `Tool error: ${result.error}`
  }

  const lines = result.output.split('\n')

  if (lines.length <= maxLines) {
    return result.output
  }

  const first = lines.slice(0, Math.ceil(maxLines / 2)).join('\n')
  const last = lines.slice(-Math.floor(maxLines / 2)).join('\n')
  const omitted = lines.length - maxLines

  return `${first}\n\n[... ${omitted} lines omitted ...]\n\n${last}`
}

/**
 * Build a summary message from tool execution for LLM context
 */
export function buildToolResultMessage(result: ToolExecutionResult): string {
  if (!result.success) {
    return `Tool ${result.toolName} failed: ${result.error}`
  }

  const compressed = compressToolResultForHistory(result.output)
  return `Tool ${result.toolName} executed successfully:\n\n${compressed}`
}
