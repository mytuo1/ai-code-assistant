/**
 * Token Tracker - Monitor all API spending in real-time
 * Tracks per-query and cumulative token usage with cost estimation
 */

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

export interface QueryMetrics {
  queryId: string
  query: string
  toolsUsed: string[]
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
  timestamp: Date
  duration: number
}

export class TokenTracker {
  private queries: QueryMetrics[] = []
  private sessionStartTime: Date = new Date()

  // Pricing per 1K tokens (gpt-3.5-turbo)
  private INPUT_COST_PER_1K = 0.0005
  private OUTPUT_COST_PER_1K = 0.0015

  /**
   * Track a query's token usage
   */
  trackQuery(
    queryId: string,
    query: string,
    inputTokens: number,
    outputTokens: number,
    toolsUsed: string[] = [],
    duration: number = 0
  ): QueryMetrics {
    const totalTokens = inputTokens + outputTokens
    const estimatedCost =
      (inputTokens / 1000) * this.INPUT_COST_PER_1K +
      (outputTokens / 1000) * this.OUTPUT_COST_PER_1K

    const metric: QueryMetrics = {
      queryId,
      query: query.slice(0, 100), // Truncate long queries
      toolsUsed,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      timestamp: new Date(),
      duration,
    }

    this.queries.push(metric)
    return metric
  }

  /**
   * Get total tokens used in session
   */
  getTotalTokens(): TokenUsage {
    const inputTokens = this.queries.reduce((sum, q) => sum + q.inputTokens, 0)
    const outputTokens = this.queries.reduce((sum, q) => sum + q.outputTokens, 0)
    const totalTokens = inputTokens + outputTokens
    const estimatedCost = this.queries.reduce((sum, q) => sum + q.estimatedCost, 0)

    return { inputTokens, outputTokens, totalTokens, estimatedCost }
  }

  /**
   * Get average tokens per query
   */
  getAverageTokens(): Partial<TokenUsage> {
    if (this.queries.length === 0) return {}

    const total = this.getTotalTokens()
    return {
      inputTokens: Math.round(total.inputTokens / this.queries.length),
      outputTokens: Math.round(total.outputTokens / this.queries.length),
      totalTokens: Math.round(total.totalTokens / this.queries.length),
      estimatedCost: total.estimatedCost / this.queries.length,
    }
  }

  /**
   * Get query metrics
   */
  getQueryMetrics(): QueryMetrics[] {
    return [...this.queries]
  }

  /**
   * Get session summary
   */
  getSessionSummary(): string {
    const total = this.getTotalTokens()
    const avg = this.getAverageTokens()
    const sessionDuration = new Date().getTime() - this.sessionStartTime.getTime()
    const durationMinutes = Math.round(sessionDuration / 60000)

    return `
╔════════════════════════════════════════╗
║          SESSION TOKEN SUMMARY         ║
╚════════════════════════════════════════╝

📊 Total Usage:
   Input:     ${total.inputTokens.toLocaleString()} tokens
   Output:    ${total.outputTokens.toLocaleString()} tokens
   Total:     ${total.totalTokens.toLocaleString()} tokens

💰 Estimated Cost:
   Total:     $${total.estimatedCost.toFixed(4)}
   Per Query: $${(total.estimatedCost / Math.max(1, this.queries.length)).toFixed(4)}

📈 Averages per Query:
   Input:     ${(avg.inputTokens || 0).toLocaleString()} tokens
   Output:    ${(avg.outputTokens || 0).toLocaleString()} tokens
   Total:     ${(avg.totalTokens || 0).toLocaleString()} tokens

⏱️  Session Duration: ${durationMinutes} minute(s)
📝 Total Queries: ${this.queries.length}
`.trim()
  }

  /**
   * Get detailed query breakdown
   */
  getDetailedBreakdown(): string {
    if (this.queries.length === 0) {
      return 'No queries tracked yet.'
    }

    const lines = [
      '╔════════════════════════════════════════════════════════════════╗',
      '║               DETAILED QUERY BREAKDOWN                         ║',
      '╚════════════════════════════════════════════════════════════════╝\n',
    ]

    for (let i = 0; i < this.queries.length; i++) {
      const q = this.queries[i]
      const timeStr = q.timestamp.toLocaleTimeString()
      lines.push(
        `Query ${i + 1}: ${timeStr} | ${q.query.slice(0, 40).padEnd(40, ' ')}`
      )
      lines.push(
        `  └─ Input: ${q.inputTokens.toString().padStart(5)} | Output: ${q.outputTokens.toString().padStart(4)} | Cost: $${q.estimatedCost.toFixed(4).padStart(8)}`
      )
      if (q.toolsUsed.length > 0) {
        lines.push(`  └─ Tools: ${q.toolsUsed.join(', ')}`)
      }
      if (q.duration > 0) {
        lines.push(`  └─ Duration: ${q.duration}ms`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Get real-time display string
   */
  getRealTimeDisplay(): string {
    const total = this.getTotalTokens()
    return `\x1b[2;36m[${this.queries.length} queries | ${total.totalTokens} total tokens | $${total.estimatedCost.toFixed(4)}]\x1b[0m`
  }

  /**
   * Display real-time token usage (called after each query)
   */
  displayQueryMetrics(metric: QueryMetrics): void {
    process.stdout.write(
      `\n\x1b[2;33m[Query ${this.queries.length}] Input: ${metric.inputTokens} | Output: ${metric.outputTokens} | Cost: $${metric.estimatedCost.toFixed(4)}\x1b[0m\n`
    )
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        session: {
          startTime: this.sessionStartTime,
          totalQueries: this.queries.length,
          ...this.getTotalTokens(),
        },
        queries: this.queries,
      },
      null,
      2
    )
  }
}

/**
 * Global token tracker instance
 */
let globalTracker: TokenTracker | null = null

export function getTokenTracker(): TokenTracker {
  if (!globalTracker) {
    globalTracker = new TokenTracker()
  }
  return globalTracker
}

export function resetTokenTracker(): void {
  globalTracker = new TokenTracker()
}
