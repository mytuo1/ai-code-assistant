import { createInterface } from 'readline'
import { homedir } from 'os'
import { resolve, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'

import type { REPLConfig } from './config.js'
import {
  loadConfig,
  validateConfig,
  printConfigSummary,
} from './config.js'
import {
  streamLLMResponse,
  printStreamingStart,
  printStreamingToken,
  printStreamingEnd,
  formatResponseSummary,
} from './streaming.js'
import {
  promptForToolPermission,
  promptConfirmation,
  printToolResult,
  printToolSkipped,
  type PermissionPreferences,
  type PermissionDecision,
} from './permissions.js'

export interface ConversationMessage {
  id: string
  type: 'user' | 'assistant'
  timestamp: Date
  content: Array<{
    type: 'text' | 'tool_use'
    text?: string
    id?: string
    name?: string
    input?: unknown
  }>
  toolCalls?: Array<{ id: string; name: string; input: unknown }>
  usage?: { input_tokens: number; output_tokens: number }
}

/**
 * Main REPL class — orchestrates config, LLM streaming, tool execution, history
 */
export class REPL {
  private config: REPLConfig
  private conversation: ConversationMessage[] = []
  private permissionPreferences: PermissionPreferences = {}
  private abortController: AbortController
  private cwd: string

  constructor(config: REPLConfig, cwd: string = process.cwd()) {
    this.config = config
    this.cwd = cwd
    this.abortController = new AbortController()
  }

  /**
   * Start the REPL main loop
   */
  async start(): Promise<void> {
    this.printHeader()

    // Check for session resume
    const resumed = await this.tryResumeSession()
    if (!resumed) {
      this.conversation = []
    }

    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })

    // Main loop
    const loop = async () => {
      prompt.question('\x1b[1;33m> \x1b[0m', async (input) => {
        if (!input.trim()) {
          loop()
          return
        }

        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          this.printGoodbye()
          prompt.close()
          return
        }

        try {
          // Add user message to history
          this.conversation.push({
            id: randomUUID(),
            type: 'user',
            timestamp: new Date(),
            content: [{ type: 'text', text: input }],
          })

          // Submit query to LLM
          const response = await this.submitQuery(input)

          // Add assistant response to history
          this.conversation.push(response)

          // Process any tool calls
          if (response.toolCalls && response.toolCalls.length > 0) {
            await this.processToolCalls(response.toolCalls)
          }

          // Save session
          await this.saveSession()

          loop()
        } catch (err: any) {
          process.stderr.write(`\x1b[1;31m❌ Error: ${err?.message}\x1b[0m\n`)
          loop()
        }
      })
    }

    loop()
  }

  /**
   * Submit a user query to the LLM
   */
  private async submitQuery(userInput: string): Promise<ConversationMessage> {
    // Build message context (respect context window)
    const messages = this.buildMessageContext()

    // Stream response from LLM
    printStreamingStart()

    const accumulator = await streamLLMResponse({
      messages,
      systemPrompt: this.config.systemPrompt,
      tools: [], // TODO: Load from Tool.ts
      model: this.config.mainLoopModel,
      signal: this.abortController.signal,
      onToken: (token) => printStreamingToken(token),
    })

    printStreamingEnd()

    // Print summary with tool info
    if (accumulator.toolCalls.length > 0) {
      process.stdout.write(formatResponseSummary(accumulator))
    }

    return {
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: [
        {
          type: 'text',
          text: accumulator.textContent,
        },
        ...accumulator.toolCalls.map((tc) => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })),
      ],
      toolCalls: accumulator.toolCalls,
      usage: {
        input_tokens: accumulator.inputTokens,
        output_tokens: accumulator.outputTokens,
      },
    }
  }

  /**
   * Process tool calls with interactive confirmation
   */
  private async processToolCalls(
    toolCalls: Array<{ id: string; name: string; input: unknown }>,
  ): Promise<void> {
    for (const tc of toolCalls) {
      const toolName = tc.name

      // Determine permission
      let decision: PermissionDecision = 'no'

      if (this.config.tools.permissionMode === 'interactive') {
        // Prompt user
        decision = await promptForToolPermission({
          toolName,
          description: `Input: ${JSON.stringify(tc.input).substring(0, 100)}...`,
          remembered: this.permissionPreferences[toolName],
        })

        // Remember if "always" or "never"
        if (['always', 'never'].includes(decision)) {
          this.permissionPreferences[toolName] = decision
        }
      } else if (this.config.tools.permissionMode === 'auto') {
        decision = 'always'
      }

      // Execute if allowed
      if (['yes', 'always'].includes(decision)) {
        try {
          // TODO: Call actual tool
          // For now, just simulate success
          printToolResult(toolName, true, 'Tool execution simulated')
        } catch (err: any) {
          printToolResult(toolName, false, err?.message ?? 'Unknown error')
        }
      } else {
        printToolSkipped(toolName, 'User denied or tool unsupported')
      }
    }
  }

  /**
   * Build message context respecting context window limit
   */
  private buildMessageContext(): any[] {
    // Import Message type from types/message.js
    // For now, return a simplified structure
    const messages: any[] = []

    // Walk backward through history until we hit token limit
    let tokenCount = 0
    const systemPromptTokens = Math.ceil(this.config.systemPrompt.length / 4) // rough estimate

    for (let i = this.conversation.length - 1; i >= 0; i--) {
      const msg = this.conversation[i]
      const msgTokens = Math.ceil(JSON.stringify(msg).length / 4)

      if (
        tokenCount + msgTokens >
        this.config.contextWindowSize - systemPromptTokens - 1000
      ) {
        break
      }

      messages.unshift({
        type: msg.type,
        message: {
          content: msg.content,
        },
      })
      tokenCount += msgTokens
    }

    return messages
  }

  /**
   * Try to resume last session
   */
  private async tryResumeSession(): Promise<boolean> {
    const sessionFile = this.expandPath(this.config.conversation.sessionFile)

    if (
      !this.config.conversation.persistSession ||
      !existsSync(sessionFile)
    ) {
      return false
    }

    // Prompt user
    const shouldResume = await promptConfirmation(
      'Resume last session? (Yes/No)'
    )

    if (!shouldResume) {
      return false
    }

    try {
      const data = readFileSync(sessionFile, 'utf-8')
      const sessions = JSON.parse(data)
      const lastSession = sessions[sessions.length - 1]

      if (lastSession && lastSession.messages) {
        this.conversation = lastSession.messages
        process.stdout.write(
          `\x1b[2;36m[Resumed ${this.conversation.length} messages]\x1b[0m\n\n`
        )
        return true
      }
    } catch (err) {
      process.stderr.write(`[WARN] Could not resume session: ${err}\n`)
    }

    return false
  }

  /**
   * Save conversation to session file
   */
  private async saveSession(): Promise<void> {
    if (!this.config.conversation.persistSession) {
      return
    }

    try {
      const sessionFile = this.expandPath(
        this.config.conversation.sessionFile
      )

      // Ensure directory exists
      const dir = sessionFile.substring(0, sessionFile.lastIndexOf('/'))
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      // Load existing sessions
      let sessions: any[] = []
      if (existsSync(sessionFile)) {
        try {
          sessions = JSON.parse(readFileSync(sessionFile, 'utf-8'))
        } catch {
          sessions = []
        }
      }

      // Add/update current session
      sessions.push({
        timestamp: new Date().toISOString(),
        messages: this.conversation,
      })

      // Keep only last 10 sessions
      if (sessions.length > 10) {
        sessions = sessions.slice(-10)
      }

      writeFileSync(sessionFile, JSON.stringify(sessions, null, 2))
    } catch (err) {
      process.stderr.write(`[WARN] Could not save session: ${err}\n`)
    }
  }

  /**
   * Expand ~ to home directory
   */
  private expandPath(path: string): string {
    if (path.startsWith('~')) {
      return join(homedir(), path.slice(1))
    }
    return resolve(this.cwd, path)
  }

  /**
   * Print welcome header
   */
  private printHeader(): void {
    process.stdout.write('\x1b[2J\x1b[H') // Clear screen
    process.stdout.write('\x1b[1;36m')
    process.stdout.write('╔════════════════════════════════════════╗\n')
    process.stdout.write('║  AI Code Assistant - REPL (Provider    ║\n')
    process.stdout.write(`║  Agnostic)                  ${this.config.provider.padEnd(10, ' ')}║\n`)
    process.stdout.write('║  (type "exit" to quit)                 ║\n')
    process.stdout.write('╚════════════════════════════════════════╝\n')
    process.stdout.write('\x1b[0m\n')

    printConfigSummary(this.config)
  }

  /**
   * Print goodbye message
   */
  private printGoodbye(): void {
    process.stdout.write(
      '\n\x1b[2;36m[Session saved. Goodbye!]\x1b[0m\n'
    )
  }

  /**
   * Static factory method
   */
  static async initialize(cwd: string = process.cwd()): Promise<REPL> {
    const config = await loadConfig(cwd)
    const validation = validateConfig(config)

    if (!validation.valid) {
      throw new Error(
        `Invalid configuration:\n${validation.errors.join('\n')}`
      )
    }

    return new REPL(config, cwd)
  }
}
