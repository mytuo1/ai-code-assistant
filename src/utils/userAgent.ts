/**
 * User-Agent string helpers.
 *
 * Kept dependency-free so SDK-bundled code (bridge, cli/transports) can
 * import without pulling in auth.ts and its transitive dependency tree.
 */

export function getAgentUserAgent(): string {
  return `ai-assistant/${"1.0.0"}`
}

// Alias for backward compatibility
export const getClaudeCodeUserAgent = getAgentUserAgent
