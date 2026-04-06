/**
 * Project Scope - Define which project parts are loaded into context
 * Prevents unnecessary 33MB project bloat
 * 
 * Can be overridden via REPL_SCOPE env var (JSON format)
 */

import { basename, join } from 'path'

export interface ProjectScope {
  include: string[]
  exclude: string[]
  allowedMaxSize: number
}

// Load scope from environment or use defaults
function getDefaultScope(): ProjectScope {
  // Try environment variable first
  if (process.env.REPL_SCOPE) {
    try {
      const custom = JSON.parse(process.env.REPL_SCOPE)
      console.log('[ProjectScope] Using custom scope from REPL_SCOPE env var')
      return custom
    } catch (err) {
      console.warn('[ProjectScope] Invalid REPL_SCOPE JSON, checking .reprc.json')
    }
  }

  // Try .reprc.json file
  try {
    const { existsSync, readFileSync } = require('fs')
    const reprcPath = join(process.cwd(), '.reprc.json')
    
    if (existsSync(reprcPath)) {
      const content = readFileSync(reprcPath, 'utf-8')
      const config = JSON.parse(content)
      if (config.scope) {
        console.log('[ProjectScope] Loaded custom scope from .reprc.json')
        return config.scope
      }
    }
  } catch (err) {
    // Ignore errors, fall through to defaults
  }

  return {
    // Only these directories can be accessed/loaded
    include: [
      'src/repl/**',
      'src/tools/**',
      'src/services/**',
      'src/utils/**',
      'src/types/**',
      'package.json',
      'tsconfig.json',
      '.env*',
    ],

    // Never load these
    exclude: [
      'src/components/**',
      'src/entrypoints/**',
      'src/main.tsx',
      'src/QueryEngine.ts',
      'src/providers/**',
      'src/upstreamproxy/**',
      'src/vim/**',
      'src/voice/**',
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
    ],

    allowedMaxSize: 2 * 1024 * 1024, // 2MB max
  }
}

export const REPL_PROJECT_SCOPE: ProjectScope = getDefaultScope()

export function isPathAllowed(
  filePath: string,
  scope: ProjectScope = REPL_PROJECT_SCOPE
): boolean {
  // Normalize path (remove leading slashes, handle both / and \)
  let normalized = filePath
    .replace(/^[/\\]+/, '') // Remove leading slashes
    .replace(/\\/g, '/') // Convert backslashes to forward slashes

  // If path contains the project directory name, extract relative part
  // e.g., "root/ai-code-assistant/src/repl/REPL.ts" → "src/repl/REPL.ts"
  const cwdBasename = basename(process.cwd())
  const cwdIndex = normalized.indexOf(cwdBasename)
  if (cwdIndex >= 0 && cwdIndex + cwdBasename.length < normalized.length) {
    const afterCwd = normalized.substring(cwdIndex + cwdBasename.length)
    if (afterCwd.startsWith('/')) {
      normalized = afterCwd.substring(1)
    }
  }

  // Check excludes first
  for (const pattern of scope.exclude) {
    if (matchPattern(normalized, pattern)) {
      return false
    }
  }

  // Then check includes
  for (const pattern of scope.include) {
    if (matchPattern(normalized, pattern)) {
      return true
    }
  }

  return false
}

function matchPattern(filePath: string, pattern: string): boolean {
  const regex = patternToRegex(pattern)
  
  // Match against full path
  if (regex.test(filePath)) {
    return true
  }

  // Also match against basename for simple filenames
  // e.g., "package.json" should match "/root/project/package.json"
  if (!pattern.includes('/') && !pattern.includes('*')) {
    const fileName = basename(filePath)
    return fileName === pattern
  }

  return false
}

function patternToRegex(pattern: string): RegExp {
  // Convert glob pattern to regex
  // "src/tools/**" → "^src/tools/.*$"
  // "package.json" → "^package.json$"
  let escaped = pattern
    .replace(/\./g, '\\.') // . → \.
    .replace(/\*\*/g, '<<DOUBLESTAR>>') // Preserve **
    .replace(/\*/g, '[^/]*') // * → [^/]* (matches anything except /)
    .replace(/<<DOUBLESTAR>>/g, '.*') // ** → .*

  return new RegExp(`^${escaped}$`)
}

export function validateProjectLoading(
  filePaths: string[],
  scope: ProjectScope = REPL_PROJECT_SCOPE
): { allowed: string[]; blocked: string[] } {
  const allowed: string[] = []
  const blocked: string[] = []

  for (const filePath of filePaths) {
    if (isPathAllowed(filePath, scope)) {
      allowed.push(filePath)
    } else {
      blocked.push(filePath)
    }
  }

  return { allowed, blocked }
}

/**
 * Create a custom scope for REPL_SCOPE environment variable
 * @example
 * const customScope = createCustomScope({
 *   addToInclude: ['src/config/**'],
 *   removeFromInclude: ['src/tools/**']
 * })
 * process.env.REPL_SCOPE = JSON.stringify(customScope)
 */
export function createCustomScope(options?: {
  addToInclude?: string[]
  removeFromInclude?: string[]
  addToExclude?: string[]
  removeFromExclude?: string[]
}): ProjectScope {
  const base = { ...REPL_PROJECT_SCOPE }

  if (options?.addToInclude) {
    base.include.push(...options.addToInclude)
  }
  if (options?.removeFromInclude) {
    base.include = base.include.filter(p => !options.removeFromInclude!.includes(p))
  }
  if (options?.addToExclude) {
    base.exclude.push(...options.addToExclude)
  }
  if (options?.removeFromExclude) {
    base.exclude = base.exclude.filter(p => !options.removeFromExclude!.includes(p))
  }

  return base
}

export function validateProjectLoading(
  filePaths: string[],
  scope: ProjectScope = REPL_PROJECT_SCOPE
): { allowed: string[]; blocked: string[] } {
  const allowed: string[] = []
  const blocked: string[] = []

  for (const filePath of filePaths) {
    if (isPathAllowed(filePath, scope)) {
      allowed.push(filePath)
    } else {
      blocked.push(filePath)
    }
  }

  return { allowed, blocked }
}
