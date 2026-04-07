/**
 * Capture errors from running commands/scripts
 */

import { execSync } from 'child_process'

export interface CapturedError {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  combinedOutput: string
}

export function captureError(command: string, cwd: string = process.cwd()): CapturedError {
  process.stderr.write(`[ErrorCapture] Running: ${command}\n`)

  try {
    const stdout = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000, // 15 second timeout
    })

    process.stderr.write(`[ErrorCapture] ✓ Command succeeded\n`)
    return {
      success: true,
      stdout,
      stderr: '',
      exitCode: 0,
      combinedOutput: stdout,
    }
  } catch (err: any) {
    const stdout = err.stdout?.toString() || ''
    const stderr = err.stderr?.toString() || err.message || ''
    const exitCode = err.status || 1

    process.stderr.write(`[ErrorCapture] ✗ Command failed with exit code ${exitCode}\n`)
    process.stderr.write(`[ErrorCapture] Error: ${stderr.substring(0, 200)}\n`)

    return {
      success: false,
      stdout,
      stderr,
      exitCode,
      combinedOutput: stdout + '\n' + stderr,
    }
  }
}

export function buildDebugContext(codeContent: string, errorOutput: CapturedError, query: string): string {
  return `CODE FILE:
\`\`\`typescript
${codeContent}
\`\`\`

ERROR MESSAGE:
${errorOutput.stderr || errorOutput.stdout || 'No error output'}

USER QUERY:
${query}

TASK: Analyze the code and error, identify the bug, and provide exact str_replace fixes to resolve it.`
}
