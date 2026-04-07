/**
 * Session File Cache
 * Remembers files read during the session so Claude can reason about them
 * across multiple queries without re-reading (like how Claude remembers context)
 */

export interface CachedFile {
  path: string
  content: string
  size: number
  readAt: Date
  readCount: number
}

export class SessionCache {
  private cache: Map<string, CachedFile> = new Map()
  private sessionId: string
  private maxCacheSizePerFile = 100 * 1024 // 100KB per file
  private maxTotalFiles = 50 // Max files in cache

  constructor() {
    this.sessionId = `session-${Date.now()}`
  }

  /**
   * Add or update file in cache
   */
  cacheFile(path: string, content: string): CachedFile {
    // Enforce max size per file
    if (content.length > this.maxCacheSizePerFile) {
      const truncated = content.slice(0, this.maxCacheSizePerFile) + '\n... (truncated)'
      process.stderr.write(
        `[SessionCache] File ${path} exceeds max size, truncating to ${this.maxCacheSizePerFile} bytes\n`
      )
      content = truncated
    }

    // Evict LRU if cache is full
    if (this.cache.size >= this.maxTotalFiles && !this.cache.has(path)) {
      const lru = Array.from(this.cache.values()).sort((a, b) => a.readAt.getTime() - b.readAt.getTime())[0]
      if (lru) {
        this.cache.delete(lru.path)
        process.stderr.write(`[SessionCache] Evicted ${lru.path} (cache full, max ${this.maxTotalFiles} files)\n`)
      }
    }

    const cached: CachedFile = {
      path,
      content,
      size: content.length,
      readAt: new Date(),
      readCount: (this.cache.get(path)?.readCount || 0) + 1,
    }

    this.cache.set(path, cached)
    process.stderr.write(
      `[SessionCache] Cached ${path} (${cached.size} bytes, access #${cached.readCount})\n`
    )

    return cached
  }

  /**
   * Get file from cache
   */
  getFile(path: string): CachedFile | null {
    const file = this.cache.get(path)
    if (file) {
      file.readCount++
      file.readAt = new Date()
      process.stderr.write(`[SessionCache] Hit: ${path} (access #${file.readCount})\n`)
      return file
    }
    return null
  }

  /**
   * Check if file is in cache
   */
  hasFile(path: string): boolean {
    return this.cache.has(path)
  }

  /**
   * Get all cached files
   */
  getAllFiles(): CachedFile[] {
    return Array.from(this.cache.values())
  }

  /**
   * Format cache for including in LLM context
   * Claude will know about these files and can reason about them
   */
  formatForLLMContext(): string {
    if (this.cache.size === 0) {
      return ''
    }

    const files = Array.from(this.cache.values())
      .sort((a, b) => b.readCount - a.readCount) // Most accessed first
      .slice(0, 10) // Only include top 10 most accessed files

    const formatted = files
      .map(f => {
        const preview = f.content.length > 500 ? f.content.slice(0, 500) + '\n...' : f.content
        return `\n## File: ${f.path}\n(accessed ${f.readCount} times in this session)\n\`\`\`\n${preview}\n\`\`\``
      })
      .join('\n')

    return `[Session Context: Cached files from this session]\n${formatted}`
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    fileCount: number
    totalSize: number
    mostAccessed: Array<{ path: string; count: number }>
  } {
    const files = Array.from(this.cache.values())
    return {
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      mostAccessed: files
        .sort((a, b) => b.readCount - a.readCount)
        .slice(0, 5)
        .map(f => ({ path: f.path, count: f.readCount })),
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    const count = this.cache.size
    this.cache.clear()
    process.stderr.write(`[SessionCache] Cleared ${count} files from session\n`)
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId
  }
}

// Create global singleton instance
export const sessionCache = new SessionCache()
