/**
 * REPL Scope Configuration - Flexible project scope management
 * 
 * This module allows users to easily customize which files/directories
 * can be modified via the REPL without editing code.
 */

import { join, resolve } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export interface ReprcConfig {
  projectRoot?: string
  scope?: {
    include?: string[]
    exclude?: string[]
    allowedMaxSize?: number
  }
}

/**
 * Load .reprc.json from project root
 * Allows users to configure scope without environment variables
 */
export function loadReprcConfig(projectRoot: string = process.cwd()): ReprcConfig {
  const reprcPath = join(projectRoot, '.reprc.json')
  
  if (!existsSync(reprcPath)) {
    return {}
  }

  try {
    const content = readFileSync(reprcPath, 'utf-8')
    const config = JSON.parse(content)
    process.stderr.write(`[REPL] Loaded config from .reprc.json\n`)
    return config
  } catch (err) {
    process.stderr.write(`[REPL] Failed to load .reprc.json: ${err}\n`)
    return {}
  }
}

/**
 * Create a default .reprc.json file in project root
 */
export function createDefaultReprc(projectRoot: string = process.cwd()): void {
  const reprcPath = join(projectRoot, '.reprc.json')
  
  if (existsSync(reprcPath)) {
    process.stderr.write(`[REPL] .reprc.json already exists\n`)
    return
  }

  const defaultConfig: ReprcConfig = {
    projectRoot,
    scope: {
      // Files that CAN be modified
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
      // Files that CANNOT be modified
      exclude: [
        'src/components/**',
        'src/entrypoints/**',
        'src/main.tsx',
        'src/providers/**',
        'node_modules/**',
        '.git/**',
      ],
      allowedMaxSize: 50 * 1024, // 50KB per file
    },
  }

  try {
    writeFileSync(reprcPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
    process.stderr.write(`[REPL] Created .reprc.json with default scope\n`)
  } catch (err) {
    process.stderr.write(`[REPL] Failed to create .reprc.json: ${err}\n`)
  }
}

/**
 * Expand scope to include more directories
 * 
 * @example
 * // Allow entire project
 * expandScope(['**'])
 * 
 * @example
 * // Allow src/ directory
 * expandScope(['src/**'])
 */
export function expandScope(patterns: string[]): void {
  const reprcPath = join(process.cwd(), '.reprc.json')
  let config: ReprcConfig = {}

  if (existsSync(reprcPath)) {
    try {
      const content = readFileSync(reprcPath, 'utf-8')
      config = JSON.parse(content)
    } catch (err) {
      process.stderr.write(`[REPL] Failed to read .reprc.json\n`)
      return
    }
  }

  if (!config.scope) {
    config.scope = { include: [], exclude: [] }
  }

  if (!config.scope.include) {
    config.scope.include = []
  }

  config.scope.include.push(...patterns)
  config.scope.include = [...new Set(config.scope.include)] // Deduplicate

  try {
    writeFileSync(reprcPath, JSON.stringify(config, null, 2), 'utf-8')
    process.stderr.write(`[REPL] Updated scope: added ${patterns.join(', ')}\n`)
  } catch (err) {
    process.stderr.write(`[REPL] Failed to update .reprc.json: ${err}\n`)
  }
}

/**
 * Restrict scope to exclude more directories
 */
export function restrictScope(patterns: string[]): void {
  const reprcPath = join(process.cwd(), '.reprc.json')
  let config: ReprcConfig = {}

  if (existsSync(reprcPath)) {
    try {
      const content = readFileSync(reprcPath, 'utf-8')
      config = JSON.parse(content)
    } catch (err) {
      process.stderr.write(`[REPL] Failed to read .reprc.json\n`)
      return
    }
  }

  if (!config.scope) {
    config.scope = { include: [], exclude: [] }
  }

  if (!config.scope.exclude) {
    config.scope.exclude = []
  }

  config.scope.exclude.push(...patterns)
  config.scope.exclude = [...new Set(config.scope.exclude)] // Deduplicate

  try {
    writeFileSync(reprcPath, JSON.stringify(config, null, 2), 'utf-8')
    process.stderr.write(`[REPL] Updated scope: excluded ${patterns.join(', ')}\n`)
  } catch (err) {
    process.stderr.write(`[REPL] Failed to update .reprc.json: ${err}\n`)
  }
}

/**
 * Reset scope to default
 */
export function resetScope(): void {
  const reprcPath = join(process.cwd(), '.reprc.json')
  
  try {
    if (existsSync(reprcPath)) {
      const content = readFileSync(reprcPath, 'utf-8')
      const config = JSON.parse(content) as ReprcConfig
      if (config.scope) {
        delete config.scope
      }
      writeFileSync(reprcPath, JSON.stringify(config, null, 2), 'utf-8')
      process.stderr.write(`[REPL] Reset scope to defaults\n`)
    }
  } catch (err) {
    process.stderr.write(`[REPL] Failed to reset scope: ${err}\n`)
  }
}

/**
 * Print current scope configuration
 */
export function printScope(): void {
  const reprcPath = join(process.cwd(), '.reprc.json')
  
  if (!existsSync(reprcPath)) {
    process.stderr.write(`[REPL] No .reprc.json found (using defaults)\n`)
    return
  }

  try {
    const content = readFileSync(reprcPath, 'utf-8')
    const config = JSON.parse(content) as ReprcConfig
    process.stderr.write(`[REPL] Current scope:\n`)
    process.stderr.write(JSON.stringify(config.scope, null, 2))
    process.stderr.write('\n')
  } catch (err) {
    process.stderr.write(`[REPL] Failed to read scope: ${err}\n`)
  }
}
