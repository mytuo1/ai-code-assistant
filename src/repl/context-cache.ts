/**
 * Context Cache - Store large content locally, reference by hash in API calls
 * Reduces history tokens from 800 to ~50 for follow-up queries
 */

import { createHash } from 'crypto'

export interface CachedContent {
  hash: string
  content: string
  type: 'file' | 'output' | 'response'
  timestamp: Date
  toolName?: string
}

export class ContextCache {
  private cache: Map<string, CachedContent> = new Map()
  private maxEntries = 50

  /**
   * Store content and return hash reference
   */
  store(content: string, type: 'file' | 'output' | 'response', toolName?: string): string {
    const hash = this.hashContent(content)

    // Don't cache small content (< 100 chars)
    if (content.length < 100) {
      return content
    }

    // If already cached, return hash
    if (this.cache.has(hash)) {
      return `[cached:${hash}]`
    }

    // Store new content
    this.cache.set(hash, {
      hash,
      content,
      type,
      timestamp: new Date(),
      toolName,
    })

    // Cleanup old entries if needed
    if (this.cache.size > this.maxEntries) {
      this.cleanupOldest()
    }

    return `[cached:${hash}]`
  }

  /**
   * Retrieve cached content by hash
   */
  retrieve(hash: string): string | null {
    const entry = this.cache.get(hash)
    return entry?.content || null
  }

  /**
   * Replace hash references with actual content for processing
   */
  expandReferences(text: string): string {
    return text.replace(/\[cached:([a-f0-9]{8})\]/g, (match, hash) => {
      const content = this.retrieve(hash)
      return content || match
    })
  }

  /**
   * Compress message by replacing large content with hashes
   */
  compressMessage(message: string): string {
    // Replace file content blocks with hashes
    return message.replace(
      /File content:[\s\S]{0,5000}?(?=\n\n|$)/g,
      (match) => {
        const hash = this.hashContent(match)
        this.cache.set(hash, {
          hash,
          content: match,
          type: 'file',
          timestamp: new Date(),
        })
        return `[file:${hash}]`
      }
    )
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      entries: this.cache.size,
      totalBytes: Array.from(this.cache.values()).reduce(
        (sum, entry) => sum + entry.content.length,
        0
      ),
      maxEntries: this.maxEntries,
    }
  }

  /**
   * Clear all cached content
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Private: Hash content with first 8 chars
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 8)
  }

  /**
   * Private: Remove oldest entries when cache is full
   */
  private cleanupOldest(): void {
    const sorted = Array.from(this.cache.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Remove oldest 10 entries
    for (let i = 0; i < 10 && i < sorted.length; i++) {
      this.cache.delete(sorted[i].hash)
    }
  }
}

/**
 * Compress tool output to reduce tokens
 * Keep first 10 lines + last 10 lines if output is > 20 lines
 */
export function compressToolOutput(output: string, maxLines: number = 20): string {
  const lines = output.split('\n')

  if (lines.length <= maxLines) {
    return output
  }

  const first = lines.slice(0, Math.ceil(maxLines / 2)).join('\n')
  const last = lines.slice(-Math.floor(maxLines / 2)).join('\n')
  const omitted = lines.length - maxLines

  return `${first}\n\n[... ${omitted} lines omitted ...]\n\n${last}`
}

/**
 * Estimate token reduction from compression
 */
export function estimateTokenSavings(
  originalLength: number,
  compressedLength: number
): { original: number; compressed: number; savings: number; percent: number } {
  const original = Math.ceil(originalLength / 4)
  const compressed = Math.ceil(compressedLength / 4)
  const savings = original - compressed
  const percent = Math.round((savings / original) * 100)

  return { original, compressed, savings, percent }
}
