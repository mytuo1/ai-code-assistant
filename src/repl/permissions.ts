import { createInterface } from 'readline'

export type PermissionDecision = 'yes' | 'no' | 'always' | 'never'

export interface PermissionPreferences {
  [toolName: string]: PermissionDecision
}

/**
 * Prompt user for tool execution permission
 * Options: Y=yes once, N=no, A=always (remember), V=never (remember)
 */
export async function promptForToolPermission({
  toolName,
  description,
  remembered,
}: {
  toolName: string
  description: string
  remembered?: PermissionDecision
}): Promise<PermissionDecision> {
  
  // If we have a remembered preference, use it
  if (remembered && ['always', 'never'].includes(remembered)) {
    const action = remembered === 'always' ? 'Allowing' : 'Denying'
    process.stdout.write(
      `\x1b[2;33m${action} ${toolName} (remembered)\x1b[0m\n`
    )
    return remembered
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    process.stdout.write(`
\x1b[1;33m🔧 Tool: ${toolName}\x1b[0m
${description}

\x1b[1;33m[Y]es / [N]o / [A]lways / [Ne]V]er?\x1b[0m `)

    prompt.once('line', (answer) => {
      prompt.close()
      
      const normalized = answer.trim().toLowerCase()
      
      switch (normalized) {
        case 'y':
        case 'yes':
          resolve('yes')
          break
        case 'a':
        case 'always':
          resolve('always')
          break
        case 'v':
        case 'never':
          resolve('never')
          break
        case 'n':
        case 'no':
        default:
          resolve('no')
      }
    })
  })
}

/**
 * Prompt user for Y/N confirmation
 */
export async function promptConfirmation(message: string): Promise<boolean> {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    process.stdout.write(`\x1b[1;33m${message} [Y/n]\x1b[0m `)
    
    prompt.once('line', (answer) => {
      prompt.close()
      const normalized = answer.trim().toLowerCase()
      resolve(normalized !== 'n' && normalized !== 'no')
    })
  })
}

/**
 * Display tool execution result
 */
export function printToolResult(
  toolName: string,
  success: boolean,
  message: string,
): void {
  if (success) {
    process.stdout.write(`\x1b[1;32m✓ ${toolName} completed\x1b[0m\n`)
  } else {
    process.stdout.write(`\x1b[1;31m✗ ${toolName} failed: ${message}\x1b[0m\n`)
  }
}

export function printToolSkipped(toolName: string, reason: string): void {
  process.stdout.write(`\x1b[2;33m⊘ ${toolName} skipped: ${reason}\x1b[0m\n`)
}

/**
 * Save permission preferences to config
 */
export async function savePermissionPreferences(
  preferences: PermissionPreferences,
  configPath: string,
): Promise<void> {
  // This will be called by REPL.ts to persist remembered choices
  // For now, we just return — the REPL will handle persistence
}
