import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parse as parseYAML } from 'yaml'

/**
 * REPL Configuration — provider-agnostic setup
 * Loaded from .ai-assistant-config.yaml in CWD
 */

export interface REPLConfig {
  // Provider selection
  provider: 'openai' | 'xai' | 'ollama' | 'azure' | 'proxy'
  apiKey: string
  apiBaseUrl?: string

  // Model selection
  mainLoopModel: string
  smallFastModel: string
  maxCompletionTokens: number
  contextWindowSize: number

  // System prompt
  systemPrompt: string

  // Tools
  tools: {
    enabled: string[]
    fileOpsScope: 'project' | 'unrestricted'
    workingDirectory: string
    computerUseEnabled: boolean
    permissionMode: 'interactive' | 'auto' | 'ask'
    rememberPermissions: boolean
  }

  // MCP servers
  mcp: {
    enabled: boolean
    servers: Array<{
      name: string
      command: string
      env?: Record<string, string>
    }>
  }

  // Streaming & output
  streaming: {
    enabled: boolean
    displayToolCalls: boolean
    displayToolResults: boolean
  }

  // Conversation
  conversation: {
    maxHistory: number
    persistSession: boolean
    sessionFile: string
  }

  // Debug
  debug: boolean
  verbose: boolean
}

const DEFAULT_CONFIG: REPLConfig = {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY || '',
  apiBaseUrl: process.env.OPENAI_BASE_URL,

  mainLoopModel: 'gpt-5.4-nano',
  smallFastModel: 'gpt-5.4-mini',
  maxCompletionTokens: 4096,
  contextWindowSize: 128000,

  systemPrompt: `You are a helpful code assistant. You have access to tools to:
- Read and write files in the project
- Execute shell commands
- Access external services via MCP servers
- Take screenshots and interact with the UI (if enabled)

Your current working directory is: ${process.cwd()}

When using the Read tool to access files, use relative paths from the current directory (e.g., "package.json"), not absolute paths like "/mnt/data/".

When the user asks you to do something, use these tools as needed. Ask for confirmation before making destructive changes.`,

  tools: {
    enabled: ['Bash', 'Read', 'Write', 'WebSearch', 'WebFetch'],
    fileOpsScope: 'project',
    workingDirectory: '.',
    computerUseEnabled: false,
    permissionMode: 'interactive',
    rememberPermissions: true,
  },

  mcp: {
    enabled: false,
    servers: [],
  },

  streaming: {
    enabled: true,
    displayToolCalls: true,
    displayToolResults: true,
  },

  conversation: {
    maxHistory: 100,
    persistSession: true,
    sessionFile: '~/.ai-assistant/sessions.json',
  },

  debug: false,
  verbose: false,
}

/**
 * Recursively resolve environment variable references in config values
 */
function resolveEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // Match ${VAR_NAME} or ${VAR_NAME:default}
    return obj.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (_, key, defaultVal) => {
      return process.env[key] ?? defaultVal ?? `$\{${key}}`
    })
  }
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(resolveEnvVars)
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, resolveEnvVars(v)])
    )
  }
  return obj
}

/**
 * Load configuration from .ai-assistant-config.yaml in CWD
 * Falls back to DEFAULT_CONFIG if file not found
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<REPLConfig> {
  const configPath = resolve(cwd, '.ai-assistant-config.yaml')

  try {
    const yaml = readFileSync(configPath, 'utf-8')
    const parsed = parseYAML(yaml)
    
    // Deep merge with defaults
    const merged = deepMerge(DEFAULT_CONFIG, parsed || {})
    
    // Resolve environment variables
    const resolved = resolveEnvVars(merged)
    
    // Validate required fields
    if (!resolved.apiKey) {
      throw new Error(
        `Missing apiKey. Set OPENAI_API_KEY env var or add apiKey to ${configPath}`
      )
    }

    return resolved
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // Config file not found, use defaults
      if (!DEFAULT_CONFIG.apiKey) {
        throw new Error(
          'No .ai-assistant-config.yaml found and OPENAI_API_KEY not set'
        )
      }
      process.stderr.write(
        `[INFO] Using default config (no .ai-assistant-config.yaml found)\n`
      )
      return DEFAULT_CONFIG
    }
    throw err
  }
}

/**
 * Deep merge: objects are merged recursively, arrays are replaced
 */
function deepMerge(base: any, override: any): any {
  if (override === undefined) return base
  if (typeof override !== 'object' || override === null) return override
  if (Array.isArray(override)) return override

  const result = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] ?? {}, value)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Validate config before use
 */
export function validateConfig(config: REPLConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.apiKey) {
    errors.push('apiKey is required')
  }

  if (!config.mainLoopModel) {
    errors.push('mainLoopModel is required')
  }

  if (!config.provider) {
    errors.push('provider is required')
  }

  if (!['openai', 'xai', 'ollama', 'azure', 'proxy'].includes(config.provider)) {
    errors.push(`provider must be one of: openai, xai, ollama, azure, proxy`)
  }

  if (config.contextWindowSize < 1000) {
    errors.push('contextWindowSize must be at least 1000')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Print config summary to stderr
 */
export function printConfigSummary(config: REPLConfig): void {
  process.stderr.write(`
╔════════════════════════════════════════╗
║       REPL Configuration Summary       ║
╚════════════════════════════════════════╝
Provider:      ${config.provider}
Model:         ${config.mainLoopModel}
Context:       ${config.contextWindowSize.toLocaleString()} tokens
Tools:         ${config.tools.enabled.join(', ')}
MCP Enabled:   ${config.mcp.enabled ? 'Yes' : 'No'}
Streaming:     ${config.streaming.enabled ? 'Yes' : 'No'}
Debug:         ${config.debug ? 'Yes' : 'No'}

`)
}
