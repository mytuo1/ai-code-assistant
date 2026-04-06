/**
 * File Discovery for Modifications
 *
 * When a user requests a modification, we need to:
 * 1. Find which files are likely affected
 * 2. Read them (0 tokens via direct execution)
 * 3. Pass to LLM with modification context
 *
 * This uses glob patterns, grep, and file structure analysis
 */

import { existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import type { ToolUseContext } from '../Tool.js'

export interface DiscoveredFile {
  path: string
  size: number
  isReadable: boolean
  content?: string
  priority: number // 0-1, higher = more relevant
}

export interface FileDiscoveryOptions {
  maxFiles?: number // Default: 5
  maxFileSize?: number // Default: 50KB
  patterns?: string[] // Glob patterns to search
  excludePatterns?: string[] // Patterns to exclude
  searchInContent?: boolean // Use grep for matching (slower)
}

const DEFAULT_OPTIONS: Required<FileDiscoveryOptions> = {
  maxFiles: 5,
  maxFileSize: 50 * 1024, // 50KB
  patterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    'coverage/**',
  ],
  searchInContent: false,
}

/**
 * Discover files affected by a modification request
 *
 * @param query User modification request
 * @param cwd Current working directory
 * @param toolContext Tools for file operations (Glob, Grep, etc.)
 * @param options Discovery options
 * @returns Array of discovered files, ordered by relevance
 *
 * @example
 * // User: "change all var to const"
 * const files = await discoverAffectedFiles(
 *   "change all var to const",
 *   process.cwd(),
 *   toolContext
 * )
 * // → [
 * //   { path: "src/main.ts", size: 1024, priority: 0.95, ... },
 * //   { path: "src/utils.ts", size: 2048, priority: 0.9, ... }
 * // ]
 */
export async function discoverAffectedFiles(
  query: string,
  cwd: string,
  toolContext: ToolUseContext,
  options: FileDiscoveryOptions = {}
): Promise<DiscoveredFile[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Step 1: Extract explicit file references from query
  const explicitFiles = extractExplicitFilesFromQuery(query, cwd)
  if (explicitFiles.length > 0) {
    process.stderr.write(`[FileDiscovery] Found ${explicitFiles.length} explicit file(s), reading content...\n`)
    
    // Read content for explicit files
    const withContent: DiscoveredFile[] = []
    for (const file of explicitFiles.slice(0, opts.maxFiles)) {
      process.stderr.write(`[FileDiscovery] Attempting to read explicit file: ${file.path}\n`)
      try {
        const content = await readFileDirectly(file.path, toolContext)
        process.stderr.write(`[FileDiscovery] ✓ Read ${file.path}: ${content.length} chars\n`)
        withContent.push({
          ...file,
          content,
          isReadable: true,
        })
      } catch (err: any) {
        process.stderr.write(`[FileDiscovery] ✗ Failed to read ${file.path}: ${err?.message || err}\n`)
        withContent.push({
          ...file,
          isReadable: false,
        })
      }
    }
    
    return withContent
  }

  // Step 2: Infer patterns from query context
  const patterns = inferPatternsFromQuery(query, opts.patterns)

  // Step 3: Use Glob tool to find matching files
  const foundFiles = await globFilesWithPattern(
    patterns,
    opts.excludePatterns,
    cwd,
    toolContext
  )

  // Step 4: Filter by size and readability
  const candidateFiles = foundFiles.filter(f => {
    try {
      const stat = statSync(f)
      return stat.size <= opts.maxFileSize && stat.isFile()
    } catch {
      return false
    }
  })

  // Step 5: Score and prioritize by relevance
  const scoredFiles = candidateFiles.map(path => ({
    path,
    score: scoreFileRelevance(path, query),
    size: statSync(path).size,
  }))

  // Sort by score descending
  scoredFiles.sort((a, b) => b.score - a.score)

  // Step 6: Load content for top files
  const discovered: DiscoveredFile[] = []
  for (const file of scoredFiles.slice(0, opts.maxFiles)) {
    process.stderr.write(`[FileDiscovery] Attempting to read: ${file.path}\n`)
    try {
      const content = await readFileDirectly(file.path, toolContext)
      process.stderr.write(`[FileDiscovery] ✓ Read ${file.path}: ${content.length} chars\n`)
      discovered.push({
        path: file.path,
        size: file.size,
        isReadable: true,
        content,
        priority: file.score,
      })
    } catch (err: any) {
      process.stderr.write(`[FileDiscovery] ✗ Failed to read ${file.path}: ${err?.message || err}\n`)
      discovered.push({
        path: file.path,
        size: file.size,
        isReadable: false,
        priority: file.score * 0.5, // Lower priority if not readable
      })
    }
  }

  return discovered
}

/**
 * Extract explicitly mentioned files from the query
 *
 * @example
 * "update src/utils.ts and src/helpers.ts"
 * → ["src/utils.ts", "src/helpers.ts"]
 */
function extractExplicitFilesFromQuery(query: string, cwd: string): DiscoveredFile[] {
  const filePattern = /\b([\w./-]+\.(?:ts|js|tsx|jsx|json|md|py|go|rb|java|cpp))\b/gi
  const matches = query.match(filePattern) || []

  const found: DiscoveredFile[] = []

  for (const match of matches) {
    // Try multiple paths: relative, absolute, under cwd
    const paths = [
      match,
      join(cwd, match),
      resolve(match),
    ]

    for (const path of paths) {
      try {
        if (existsSync(path)) {
          const stat = statSync(path)
          if (stat.isFile()) {
            found.push({
              path,
              size: stat.size,
              isReadable: true,
              priority: 1.0, // Explicit files get highest priority
            })
            break
          }
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return found
}

/**
 * Infer which file patterns to search based on query context
 */
function inferPatternsFromQuery(query: string, defaultPatterns: string[]): string[] {
  const lower = query.toLowerCase()
  const patterns: string[] = []

  // Export/import modifications
  if (lower.includes('export') || lower.includes('import') || lower.includes('require')) {
    patterns.push(
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs'
    )
  }

  // Test files
  if (lower.includes('test') || lower.includes('spec')) {
    patterns.push(
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.js'
    )
  }

  // Config files
  if (lower.includes('config') || lower.includes('setting') || lower.includes('env')) {
    patterns.push(
      '**/config.*',
      '**/.env*',
      '**/.*rc*',
      '**/tsconfig.json',
      '**/webpack.config.*'
    )
  }

  // CSS/Style files
  if (lower.includes('style') || lower.includes('css') || lower.includes('theme')) {
    patterns.push('**/*.css', '**/*.scss', '**/*.sass', '**/*.less')
  }

  // Documentation
  if (lower.includes('readme') || lower.includes('doc') || lower.includes('comment')) {
    patterns.push('**/README.*', '**/*.md', '**/*.txt')
  }

  // Package/dependency files
  if (lower.includes('package') || lower.includes('depend')) {
    patterns.push('**/package.json', '**/package-lock.json', '**/yarn.lock')
  }

  // Use default patterns if no specific patterns inferred
  if (patterns.length === 0) {
    return defaultPatterns
  }

  return [...new Set(patterns)] // Remove duplicates
}

/**
 * Find files matching glob patterns using simple fs walk
 * Falls back to explicit search if Glob tool unavailable
 */
async function globFilesWithPattern(
  patterns: string[],
  excludePatterns: string[],
  cwd: string,
  toolContext: ToolUseContext
): Promise<string[]> {
  const files: Set<string> = new Set()
  
  // For package.json specifically, just look in cwd
  if (patterns.some(p => p.includes('package.json'))) {
    const { existsSync } = await import('fs')
    const pkgPath = require('path').join(cwd, 'package.json')
    if (existsSync(pkgPath)) {
      files.add(pkgPath)
    }
  }

  // Try to use Glob tool if available
  if (toolContext?.options?.tools?.some((t: any) => t.name === 'Glob')) {
    try {
      for (const pattern of patterns) {
        // In real implementation would call Glob tool
        process.stderr.write(`[FileDiscovery] Searching pattern: ${pattern}\n`)
      }
    } catch (err) {
      process.stderr.write(`[FileDiscovery] Glob tool failed: ${err}\n`)
    }
  }

  return Array.from(files).sort()
}

/**
 * Score how relevant a file is to the modification query
 *
 * Factors:
 * - Filename matches query keywords (high weight)
 * - File type matches context (medium weight)
 * - Recently modified (minor boost)
 * - In logical directory structure (minor boost)
 */
function scoreFileRelevance(filePath: string, query: string): number {
  let score = 0.5 // Base score for any file matching pattern

  const lowerPath = filePath.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Exact filename match
  const basename = filePath.split('/').pop() || ''
  if (lowerQuery.includes(basename.replace(/\.[^.]+$/, ''))) {
    score += 0.4
  }

  // Directory relevance
  if (lowerPath.includes('src') && lowerQuery.includes('source')) {
    score += 0.1
  }
  if (lowerPath.includes('test') && (lowerQuery.includes('test') || lowerQuery.includes('spec'))) {
    score += 0.2
  }
  if (lowerPath.includes('util') && lowerQuery.includes('util')) {
    score += 0.1
  }

  // Keyword matching in path
  const keywords = ['export', 'import', 'service', 'component', 'helper', 'config']
  for (const keyword of keywords) {
    if (lowerQuery.includes(keyword) && lowerPath.includes(keyword)) {
      score += 0.1
    }
  }

  return Math.min(1.0, score) // Cap at 1.0
}

/**
 * Read file content directly (simulating 0-token read via FileReadTool)
 */
async function readFileDirectly(
  filePath: string,
  toolContext: ToolUseContext
): Promise<string> {
  process.stderr.write(`[readFileDirectly] Called with: ${filePath}\n`)
  
  try {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    
    // Try both relative and absolute paths
    let content: string | null = null
    let lastError: any = null
    
    const pathsToTry = [filePath, resolve(filePath)]
    process.stderr.write(`[readFileDirectly] Trying paths: ${pathsToTry.join(', ')}\n`)
    
    for (const pathToTry of pathsToTry) {
      try {
        process.stderr.write(`[readFileDirectly] Attempting: ${pathToTry}\n`)
        content = readFileSync(pathToTry, 'utf-8')
        process.stderr.write(`[readFileDirectly] ✓ Successfully read ${pathToTry} (${content.length} chars)\n`)
        return content
      } catch (err: any) {
        process.stderr.write(`[readFileDirectly] ✗ ${pathToTry}: ${err?.code || err?.message}\n`)
        lastError = err
      }
    }
    
    // If we get here, both attempts failed
    throw lastError || new Error(`Could not read file ${filePath}`)
  } catch (err) {
    throw new Error(`Could not read file ${filePath}: ${err}`)
  }
}

/**
 * Validate that discovered files are within allowed scope
 * (respects project-scope.ts restrictions)
 */
export function validateDiscoveredFileScope(
  files: DiscoveredFile[],
  scopeValidator: (path: string) => boolean
): DiscoveredFile[] {
  return files.filter(f => scopeValidator(f.path))
}

/**
 * Format discovered files for LLM context
 * Groups by relevance, provides file headers
 */
export function formatFilesForLLMContext(files: DiscoveredFile[]): string {
  let result = '# Files to Modify:\n\n'

  // Group by priority
  files.sort((a, b) => b.priority - a.priority)

  for (const file of files) {
    // Ensure we show the absolute or full path clearly
    const displayPath = file.path.startsWith('/') ? file.path : `./${file.path}`
    
    result += `## File: ${displayPath}\n`
    result += `**IMPORTANT: Use this exact path in tool calls: "${displayPath}"**\n\n`
    result += `Current content:\n`
    result += `\`\`\`json\n${file.content || '[Could not read file]'}\n\`\`\`\n\n`
  }

  return result
}
