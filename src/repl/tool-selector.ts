/**
 * Tool Selector - Select only relevant tools for each query
 * Reduces tool schemas from 800 tokens to ~50-100 tokens
 */

export function selectRelevantTools(userQuery: string): string[] {
  const q = userQuery.toLowerCase()

  // Check for specific keywords
  if (q.includes('read') || q.includes('view') || q.includes('show') || q.includes('display')) {
    return ['Read']
  }

  if (q.includes('write') || q.includes('create') || q.includes('edit') || q.includes('modify')) {
    return ['Write', 'Read']
  }

  if (q.includes('bash') || q.includes('run') || q.includes('execute') || q.includes('find') || q.includes('grep') || q.includes('search file')) {
    return ['Bash', 'Read']
  }

  if (q.includes('search') || q.includes('google') || q.includes('look up')) {
    return ['WebSearch']
  }

  if (q.includes('fetch') || q.includes('download') || q.includes('get http') || q.includes('get url')) {
    return ['WebFetch']
  }

  // Default: Read + Bash for general queries
  return ['Read', 'Bash']
}

export function getMinimalSchema(toolName: string): any {
  const schemas: Record<string, any> = {
    Read: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File to read' },
      },
      required: ['file_path'],
    },
    Write: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['file_path', 'content'],
    },
    Bash: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command' },
      },
      required: ['command'],
    },
    WebSearch: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    WebFetch: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    Edit: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File to edit' },
        changes: { type: 'string', description: 'Edit instructions' },
      },
      required: ['file_path', 'changes'],
    },
    Glob: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern' },
      },
      required: ['pattern'],
    },
  }

  return schemas[toolName] || {}
}

export function getMinimalDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    Read: 'Read file contents',
    Write: 'Write or create files',
    Bash: 'Execute shell commands',
    WebSearch: 'Search the web',
    WebFetch: 'Fetch web content',
    Edit: 'Edit files with patches',
    Glob: 'Find files by pattern',
  }

  return descriptions[toolName] || toolName
}

export function estimateToolSchemaTokens(toolNames: string[]): number {
  // Each minimal tool schema ≈ 50 tokens
  // Full tool schema ≈ 100+ tokens
  return toolNames.length * 50
}
