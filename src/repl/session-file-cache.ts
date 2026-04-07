/**
 * Session File Cache
 * Remembers files that have been read in the current session
 * Allows reasoning models to reference cached content without re-reading
 */

import { readFileSync, existsSync } from 'fs'

export interface CachedFile {
  path: string
  content: string
  readAt: Date
  lastModified: number
  isStale: boolean
}

export class SessionFileCache {
  private cache: Map<string, CachedFile> = new Map()
  private maxCacheSize = 50 // Max 50 files in cache
  private staleThresholdMs = 5 * 60 * 1000 // 5 minutes

  /**
   * Add file to cache
   */
  addFile(filePath: string, content: string): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const oldest = Array.from(this.cache.values()).sort(
        (a, b) => a.readAt.getTime() - b.readAt.getTime()
      )[0]
      if (oldest) {
        this.cache.delete(oldest.path)
      }
    }

    const now = Date.now()
    this.cache.set(filePath, {
      path: filePath,
      content,
      readAt: new Date(now),
      lastModified: now,
      isStale: false,
    })
  }

  /**
   * Get file from cache if available and not stale
   */
  getFile(filePath: string): CachedFile | null {
    const cached = this.cache.get(filePath)
    if (!cached) return null

    // Check if file is stale (modified since cached)
    if (Date.now() - cached.lastModified > this.staleThresholdMs) {
      cached.isStale = true
    }

    return cached
  }

  /**
   * Check if file is in cache
   */
  hasFile(filePath: string): boolean {
    return this.cache.has(filePath) && !this.getFile(filePath)?.isStale
  }

  /**
   * Get cached file or read from disk
   */
  getOrRead(filePath: string): CachedFile | null {
    // Try cache first
    const cached = this.getFile(filePath)
    if (cached && !cached.isStale) {
      return cached
    }

    // Read from disk if not in cache or stale
    try {
      if (!existsSync(filePath)) {
        return null
      }

      const content = readFileSync(filePath, 'utf-8')
      this.addFile(filePath, content)
      return this.getFile(filePath)
    } catch (err) {
      return null
    }
  }

  /**
   * List all cached files
   */
  listCached(): string[] {
    return Array.from(this.cache.keys()).filter(
      (key) => !this.cache.get(key)?.isStale
    )
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear specific file
   */
  clearFile(filePath: string): void {
    this.cache.delete(filePath)
  }

  /**
   * Get cache stats
   */
  getStats(): {
    totalCached: number
    files: Array<{ path: string; ageMs: number }>
  } {
    const now = Date.now()
    return {
      totalCached: this.cache.size,
      files: Array.from(this.cache.values())
        .filter((f) => !f.isStale)
        .map((f) => ({
          path: f.path,
          ageMs: now - f.readAt.getTime(),
        })),
    }
  }
}

/**
 * Format cached files for inclusion in LLM context
 */
export function formatCachedFilesForContext(
  cache: SessionFileCache,
  filePaths: string[]
): string {
  const cached: string[] = []

  for (const filePath of filePaths) {
    const file = cache.getFile(filePath)
    if (file && !file.isStale) {
      cached.push(`\n## Cached File: ${filePath}\n\`\`\`\n${file.content}\n\`\`\``)
    }
  }

  if (cached.length === 0) return ''

  return (
    '\n\n═══════════════════════════════════════\n' +
    '📋 CACHED FILES FROM SESSION\n' +
    '═══════════════════════════════════════' +
    cached.join('\n---\n') +
    '\n═══════════════════════════════════════'
  )
}
