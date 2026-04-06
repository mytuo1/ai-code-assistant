/**
 * Smart File Reading - Returns summaries instead of full content
 * Prevents large files from bloating conversation history
 */

import { readFileSync, statSync } from 'fs'
import { isPathAllowed, REPL_PROJECT_SCOPE } from '../../repl/project-scope'

export interface FileReadResult {
  filePath: string
  isSummary: boolean
  content: string
  metadata: {
    lines: number
    bytes: number
    truncated: boolean
  }
}

const MAX_FILE_SIZE = 10000 // bytes
const MAX_PREVIEW_LINES = 30

export function readFileSmart(filePath: string): FileReadResult {
  // Validate scope
  if (!isPathAllowed(filePath, REPL_PROJECT_SCOPE)) {
    throw new Error(
      `File blocked by scope: ${filePath}\nAllowed: ${REPL_PROJECT_SCOPE.include.join(', ')}`
    )
  }

  try {
    const stats = statSync(filePath)
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    // If file is small, return full content
    if (stats.size < MAX_FILE_SIZE) {
      return {
        filePath,
        isSummary: false,
        content: content,
        metadata: {
          lines: lines.length,
          bytes: stats.size,
          truncated: false,
        },
      }
    }

    // For large files, return preview + summary
    const preview = lines.slice(0, MAX_PREVIEW_LINES).join('\n')
    const summary = `[File too large: ${Math.round(stats.size / 1024)}KB with ${lines.length} lines]\n\nFirst ${MAX_PREVIEW_LINES} lines:\n${preview}\n\n[... content omitted, use readLine() for specific lines ...]`

    return {
      filePath,
      isSummary: true,
      content: summary,
      metadata: {
        lines: lines.length,
        bytes: stats.size,
        truncated: true,
      },
    }
  } catch (err: any) {
    throw new Error(`Failed to read file: ${err.message}`)
  }
}

export function readFileLine(filePath: string, lineNum: number): string {
  if (!isPathAllowed(filePath, REPL_PROJECT_SCOPE)) {
    throw new Error(`File blocked by scope: ${filePath}`)
  }

  try {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    if (lineNum < 1 || lineNum > lines.length) {
      return `Line ${lineNum} not found (file has ${lines.length} lines)`
    }

    return lines[lineNum - 1]
  } catch (err: any) {
    throw new Error(`Failed to read line: ${err.message}`)
  }
}

export function readFileRange(
  filePath: string,
  startLine: number,
  endLine: number
): string {
  if (!isPathAllowed(filePath, REPL_PROJECT_SCOPE)) {
    throw new Error(`File blocked by scope: ${filePath}`)
  }

  try {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    const actualStart = Math.max(0, startLine - 1)
    const actualEnd = Math.min(lines.length, endLine)

    if (actualStart >= lines.length) {
      return `Start line ${startLine} is beyond file length (${lines.length})`
    }

    return lines.slice(actualStart, actualEnd).join('\n')
  } catch (err: any) {
    throw new Error(`Failed to read range: ${err.message}`)
  }
}
