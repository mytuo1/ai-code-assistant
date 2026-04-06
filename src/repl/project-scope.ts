/**
 * Project Scope - Define which project parts are loaded into context
 * Prevents unnecessary 33MB project bloat
 */

export interface ProjectScope {
  include: string[]
  exclude: string[]
  allowedMaxSize: number
}

export const REPL_PROJECT_SCOPE: ProjectScope = {
  // Only these directories can be accessed/loaded
  include: [
    'src/repl/**',
    'src/tools/**',
    'src/services/**',
    'src/utils/**',
    'src/types/**',
    'package.json',
    'tsconfig.json',
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

export function isPathAllowed(
  filePath: string,
  scope: ProjectScope = REPL_PROJECT_SCOPE
): boolean {
  // Check excludes first
  for (const pattern of scope.exclude) {
    if (matchPattern(filePath, pattern)) {
      return false
    }
  }

  // Then check includes
  for (const pattern of scope.include) {
    if (matchPattern(filePath, pattern)) {
      return true
    }
  }

  return false
}

function matchPattern(filePath: string, pattern: string): boolean {
  const regex = patternToRegex(pattern)
  return regex.test(filePath)
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
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
