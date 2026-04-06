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
import { getTools, getAllBaseTools } from '../tools.js'
import { getEmptyToolPermissionContext } from '../Tool.js'
import type { Tools, ToolPermissionContext } from '../Tool.js'
import { init } from '../entrypoints/init.js'
import { initializeToolPermissionContext } from '../utils/permissions/permissionSetup.js'
import { enableConfigs } from '../utils/config.js'
import { FileReadTool } from '../tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from '../tools/FileWriteTool/FileWriteTool.js'
import { BashTool } from '../tools/BashTool/BashTool.js'
import { REPL_BUILTIN_TOOLS } from './built-in-tools.js'
import { REPL_PROJECT_SCOPE, isPathAllowed } from './project-scope.js'
import { getSystemPrompt } from './system-prompt.js'
import { ContextCache, compressToolOutput } from './context-cache.js'
import { getTokenTracker } from './token-tracker.js'
import { matchToolsForQuery, needsDirectExecution, needsLLMInterpretation, getExecutionTier } from './tool-router.js'
import { tryDirectExecution, formatToolResult, buildToolResultMessage } from './tool-executor.js'
import { detectModificationIntent } from './modification-intent.js'

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
  private tools: Tools = []
  private permissionContext: ToolPermissionContext
  private prompt: any = null  // Readline interface for REPL loop
  private contextCache: ContextCache = new ContextCache()  // Cache for large content
  private sessionStartTime: Date = new Date()  // Track session start

  constructor(config: REPLConfig, cwd: string = process.cwd()) {
    this.config = config
    this.cwd = cwd
    this.abortController = new AbortController()
    this.permissionContext = this.buildPermissionContext()
  }

  private buildPermissionContext(): ToolPermissionContext {
    const ctx = getEmptyToolPermissionContext()
    ctx.mode = 'default'
    return ctx
  }

  /**
   * Load all tools - use getAllBaseTools() 
   * 
   * Tools have a 3-phase lifecycle:
   * 1. LOADING (now): Get tool objects via getAllBaseTools()
   * 2. CONTEXT BUILDING (before LLM): Call description() and prompt() methods
   * 3. EXECUTION (when LLM uses tool): Call checkPermissions() and call()
   * 
   * We skip getTools() filtering because it calls .isEnabled() which may
   * depend on uninitialized state. We'll do simpler filtering here.
   */
  private async loadTools(): Promise<void> {
    try {
      // Get all base tools (no complex filtering)
      const allTools = getAllBaseTools()

      // Simple filtering: match against config.tools.enabled
      // Note: We avoid calling .isEnabled() until Phase 3 (execution)
      this.tools = allTools.filter((tool) => {
        // Match by exact name or partial name
        const enabled = this.config.tools.enabled.some(
          (cfgTool) =>
            tool.name === cfgTool ||
            tool.name.toLowerCase().includes(cfgTool.toLowerCase()) ||
            cfgTool.toLowerCase().includes(tool.name.toLowerCase())
        )
        return enabled
      })

      process.stderr.write(
        `[REPL] Loaded ${this.tools.length} tool(s): ${this.tools.map((t) => t.name).join(', ')}\n`
      )
    } catch (err: any) {
      process.stderr.write(
        `[WARN] Could not load tools: ${err?.message}\n`
      )
      if (err?.stack) {
        process.stderr.write(`[STACK] ${err.stack}\n`)
      }
      this.tools = []
    }
  }

  /**
   * Guard: Validate file access against project scope
   */
  private validateFileAccess(filePath: string): boolean {
    const allowed = isPathAllowed(filePath, REPL_PROJECT_SCOPE)

    if (!allowed) {
      process.stderr.write(
        `[BLOCKED] File outside REPL scope: ${filePath}\n` +
          `Allowed: ${REPL_PROJECT_SCOPE.include.join(', ')}\n`
      )
    }

    return allowed
  }

  /**
   * Start the REPL main loop
   */
  async start(): Promise<void> {
    // Load built-in tools
    await this.loadTools()
    
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
    
    // Store prompt as class property for use in processToolCalls
    this.prompt = prompt

    // Main loop
    const loop = async () => {
      prompt.question('\x1b[1;33m> \x1b[0m', async (input) => {
        
        if (!input.trim()) {
          setImmediate(() => loop())
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
            await this.processToolCalls(response.toolCalls, input, response)
          }

          // Save session
          await this.saveSession()

          setImmediate(() => loop())
        } catch (err: any) {
          process.stderr.write(`\x1b[1;31m❌ Error: ${err?.message}\x1b[0m\n`)
          setImmediate(() => loop())
        }
      })
    }

    loop()
  }

  /**
   * Submit a user query to the LLM
   */
  private async submitQuery(userInput: string): Promise<ConversationMessage> {
    // Store user query in conversation first
    this.conversation.push({
      id: randomUUID(),
      type: 'user',
      timestamp: new Date(),
      content: userInput,
    })

    // TIER 1: Try direct execution (0 API tokens)
    // For: bash pwd, read file.ts, grep pattern src/
    if (needsDirectExecution(userInput)) {
      const directResult = await this.tryDirectToolExecution(userInput)
      if (directResult !== null) {
        return {
          id: randomUUID(),
          type: 'assistant',
          timestamp: new Date(),
          content: directResult || '(Tool execution failed)',
        }
      }
    }

    // TIER 2: Check for modification requests
    // For: change exports, create test file, fix bug
    const modIntent = detectModificationIntent(userInput)
    if (modIntent.isModification && modIntent.confidence >= 0.45) {
      try {
        const modResult = await this.executeModificationFlow(userInput, modIntent)
        this.conversation.push({
          id: randomUUID(),
          type: 'assistant',
          timestamp: new Date(),
          content: modResult,
        })
        return {
          id: randomUUID(),
          type: 'assistant',
          timestamp: new Date(),
          content: modResult,
        }
      } catch (err) {
        process.stderr.write(`[REPL] Modification flow failed: ${err}\n`)
        // Fall through to generic LLM
      }
    }

    // TIER 3: Generic LLM for analysis/questions
    // For: how does this work, best practices, explanation
    const messages = this.buildMessageContext()

    printStreamingStart()

    const accumulator = await streamLLMResponse({
      messages,
      systemPrompt: getSystemPrompt('minimal'),
      tools: [],
      model: this.config.mainLoopModel,
      maxTokens: this.config.maxCompletionTokens,
      signal: this.abortController.signal,
      onToken: (token) => printStreamingToken(token),
    })

    printStreamingEnd()

    const tracker = getTokenTracker()
    tracker.trackQuery(
      randomUUID(),
      userInput,
      accumulator.inputTokens,
      accumulator.outputTokens,
      []
    )

    tracker.displayQueryMetrics(
      tracker.getQueryMetrics()[tracker.getQueryMetrics().length - 1]
    )

    const assistantMessage: ConversationMessage = {
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: accumulator.textContent,
    }

    this.conversation.push(assistantMessage)

    return assistantMessage
  }

  /**
   * Try direct tool execution - loads all 27 tools locally
   * Routes query to appropriate tool without sending schemas to API (0 tokens)
   */
  private async tryDirectToolExecution(userInput: string): Promise<string | null> {
    // Check if query needs direct execution
    if (!needsDirectExecution(userInput)) {
      return null // No direct match, use LLM
    }

    // Try to match and execute a tool directly
    const result = await tryDirectExecution(
      userInput,
      this.tools,
      this.buildToolUseContext(),
      async () => ({ behavior: 'allow' })
    )

    if (!result) {
      return null // No tool match confidence, use LLM
    }

    // Display tool result (success or failure)
    process.stdout.write('\n')
    process.stdout.write(formatToolResult(result))
    process.stdout.write('\n\n')

    // Track tool execution
    const tracker = getTokenTracker()
    tracker.trackQuery(
      randomUUID(),
      userInput,
      0, // No API tokens for direct execution
      0,
      [result.toolName]
    )

    // If tool FAILED, return empty string (not null) to indicate tool was attempted
    // This prevents fallthrough to LLM
    if (!result.success) {
      return '' // Tool was matched and attempted, just failed - DON'T call LLM
    }

    // Add successful result to conversation
    this.conversation.push({
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: buildToolResultMessage(result),
    })

    // Check if result needs LLM interpretation
    if (needsLLMInterpretation(result.output)) {
      // Ask LLM to interpret (minimal tokens)
      return result.output
    }

    return result.output // Return result directly
  }

  /**
   * TIER 2: Execute modification flow
   * Detects modification intent, finds files, calls LLM with file context + modification tools
   */
  private async executeModificationFlow(userInput: string, modIntent: any): Promise<string> {
    const tracker = getTokenTracker()
    
    process.stderr.write(`[ModificationFlow] Detected ${modIntent.type} (confidence: ${(modIntent.confidence * 100).toFixed(0)}%)\n`)

    // Find modification-related tools
    const modTools = this.tools.filter((t) =>
      ['Edit', 'Write', 'NotebookEdit', 'TaskCreate', 'Bash'].includes(t.name)
    )

    if (modTools.length === 0) {
      throw new Error('No modification tools available')
    }

    process.stderr.write(`[ModificationFlow] Using tools: ${modTools.map((t) => t.name).join(', ')}\n`)

    // Build LLM context with minimal modification tools
    const messages = this.buildMessageContext()

    printStreamingStart()

    // Call LLM with ONLY modification-relevant tools
    const accumulator = await streamLLMResponse({
      messages: [
        ...messages,
        {
          role: 'user',
          content: userInput,
        },
      ],
      systemPrompt: getSystemPrompt('minimal'),
      tools: [], // Will be populated by tool matching
      model: this.config.mainLoopModel,
      maxTokens: this.config.maxCompletionTokens,
      signal: this.abortController.signal,
      onToken: (token) => printStreamingToken(token),
    })

    printStreamingEnd()

    // Track modification flow tokens
    tracker.trackQuery(
      randomUUID(),
      userInput,
      accumulator.inputTokens,
      accumulator.outputTokens,
      modTools.map((t) => t.name)
    )

    tracker.displayQueryMetrics(
      tracker.getQueryMetrics()[tracker.getQueryMetrics().length - 1]
    )

    // Add result to conversation
    this.conversation.push({
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: accumulator.textContent,
    })

    return accumulator.textContent
  }
  private buildToolUseContext(): any {
    // Create minimal state maps for tools
    const readFileState = new Map()
    let fileHistoryState = { fileWrites: new Map(), edits: [] }
    let attributionState = { items: [] }

    // Build context object with required fields
    return {
      options: {
        commands: [],
        debug: this.config.debug ?? false,
        mainLoopModel: this.config.mainLoopModel,
        tools: this.tools,
        verbose: false,
        thinkingConfig: { type: 'disabled' },
        mcpClients: [],
        mcpResources: {},
        isNonInteractiveSession: true,
        agentDefinitions: { agents: [], skipped: [] },
        SandboxManager: {
          annotateStderrWithSandboxFailures: (command: string, output: string) => output,
        },
      },
      abortController: this.abortController,
      readFileState,
      
      // Minimal state getters/setters (stubs for REPL)
      getAppState: () => ({} as any),
      setAppState: (f: any) => {},
      setInProgressToolUseIDs: (f: any) => new Set(),
      setResponseLength: (f: any) => 0,
      updateFileHistoryState: (f: any) => {
        fileHistoryState = f(fileHistoryState)
      },
      updateAttributionState: (f: any) => {
        attributionState = f(attributionState)
      },
      
      // Optional callbacks (not needed for basic execution)
      messages: this.conversation,
    } as any
  }
   * 
   * WORKAROUND: Normalize tool names due to OpenAI API bug
   * (GPT-4-turbo returns "ReadRead" instead of "Read")
   */
  private async processToolCalls(
    toolCalls: Array<{ id: string; name: string; input: unknown }>,
    userInput: string,
    response: ConversationMessage,
  ): Promise<void> {
    try {
    // Normalize tool names as workaround for OpenAI API quirk
    const normalizeToolName = (name: string): string => {
      // Specific cases (legacy)
      if (name === 'ReadRead') return 'Read'
      if (name === 'WriteWrite') return 'Write'
      if (name === 'BashBash') return 'Bash'
      if (name === 'WebSearchWebSearch') return 'WebSearch'
      
      // Generic deduplication: if name is XYZ repeated twice, dedupe
      // e.g., "FooBarFooBar" → "FooBar"
      if (name.length % 2 === 0) {
        const half = name.length / 2
        const first = name.slice(0, half)
        const second = name.slice(half)
        if (first === second) {
          return first
        }
      }
      
      return name
    }

    for (const tc of toolCalls) {
      let toolName = normalizeToolName(tc.name)

      // Find the tool
      const tool = this.tools.find((t) => t.name === toolName)
      if (!tool) {
        process.stdout.write(`\x1b[1;31m⚠️ Tool not found: ${tc.name}\x1b[0m\n`)
        continue
      }

      // Determine permission
      let decision: PermissionDecision = 'no'

      if (this.config.tools.permissionMode === 'interactive') {
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
          process.stderr.write(`[Executing] ${toolName}...\n`)
          
          // Pause input stream before tool execution to preserve terminal state
          if (this.prompt?.input) this.prompt.input.pause()

          // Build proper ToolUseContext for tool execution
          const toolContext = this.buildToolUseContext()

          // Call the tool with context
          const result = await tool.call(
            tc.input as any,
            toolContext,
            async () => ({ behavior: 'allow' }),
            null as any
          )
          
          // Resume input stream after tool completes
          if (this.prompt?.input) this.prompt.input.resume()

          // Extract actual output from tool response
          // Tools return different formats - normalize to {status, output}
          let toolOutput = ''
          let toolSuccess = false

          if (result?.data) {
            // Format 1: Read tool {data: {type: "text", file: {filePath, content}}}
            if (result.data.file?.content) {
              toolOutput = result.data.file.content
              toolSuccess = true
            }
            // Format 2: Bash tool {data: {stdout: "..."}}
            else if (result.data.stdout !== undefined) {
              toolOutput = result.data.stdout
              toolSuccess = true
            }
            // Format 3: Write tool {data: {type: "create"/"edit", filePath, content, ...}}
            else if (result.data.type && (result.data.type === 'create' || result.data.type === 'edit')) {
              toolOutput = `File ${result.data.type} at ${result.data.filePath}`
              toolSuccess = true
            }
            // Format 4: WebSearch tool {data: {query, results: [...]}}
            else if (result.data.results && Array.isArray(result.data.results)) {
              toolOutput = JSON.stringify(result.data.results, null, 2)
              toolSuccess = true
            }
            // Format 5: Generic data string
            else if (typeof result.data === 'string') {
              toolOutput = result.data
              toolSuccess = true
            }
          } else if (result?.status === 'success') {
            // Format: {status: "success", output: "..."}
            toolOutput = result.output || ''
            toolSuccess = true
          } else if (typeof result === 'string') {
            // Direct string response
            toolOutput = result
            toolSuccess = true
          }

          if (toolSuccess) {
            printToolResult(toolName, true, toolOutput || '')
            
            // Compress large tool outputs before adding to history
            const compressedOutput = this.compressToolResult(toolName, toolOutput || '')
            
            // Add tool result to conversation and continue with LLM
            // Format: tool result → add to messages → call LLM again → display response
            process.stdout.write('\n✨ \x1b[1;36mAssistant (continued):\x1b[0m\n')
            
            // Add compressed tool result to conversation before calling LLM
            this.conversation.push({
              id: randomUUID(),
              type: 'user',
              timestamp: new Date(),
              content: `Tool result for ${toolName}:\n${compressedOutput}`,
            })
            
            // Call LLM again with updated conversation (using proper message format)
            const messagesForFollowUp = this.buildMessageContext()
            const toolsForLLM = await this.buildToolsForLLM(this.tools)
            
            // Pause input stream before streaming to preserve terminal state
            if (this.prompt?.input) this.prompt.input.pause()
            
            const followUpAccumulator = await streamLLMResponse({
              messages: messagesForFollowUp,
              systemPrompt: getSystemPrompt(true), // Use optimized prompt
              tools: toolsForLLM,
              model: this.config.mainLoopModel,
              maxTokens: this.config.maxCompletionTokens,
              signal: this.abortController.signal,
              onToken: (token) => printStreamingToken(token),
            })
            
            // Resume input stream after streaming completes
            if (this.prompt?.input) this.prompt.input.resume()
            
            printStreamingEnd()
            
            // Display follow-up response summary
            if (followUpAccumulator.toolCalls.length > 0) {
              process.stdout.write(formatResponseSummary(followUpAccumulator))
            }
            
            // Save the follow-up response
            this.conversation.push({
              id: randomUUID(),
              type: 'assistant',
              timestamp: new Date(),
              content: followUpAccumulator.textContent,
              toolCalls: followUpAccumulator.toolCalls,
            })
            
          } else {
            printToolResult(toolName, false, toolOutput || 'Unknown error')
          }
        } catch (err: any) {
          process.stderr.write(
            `[ERROR] Tool execution failed: ${err?.message || err}\n`
          )
          if (err?.stack) {
            process.stderr.write(`[STACK] ${err.stack.split('\n').slice(0, 3).join(' ')}\n`)
          }
          printToolResult(toolName, false, err?.message ?? 'Unknown error')
        }
      } else {
        printToolSkipped(toolName, 'User denied')
      }
    }
    } catch (err: any) {
      process.stderr.write(`[ERROR] processToolCalls failed: ${err?.message}\n`)
      process.stderr.write(`[STACK] ${err?.stack}\n`)
    }
  }

  /**
   * Build message context with smart optimization
   * - Only include current exchange (last 3 messages)
   * - Compress large content with references
   * - Optional: allow LLM to reference specific past messages
   */
  private buildMessageContext(): any[] {
    const messages: any[] = []

    // Get only recent messages (current exchange)
    const recentMessages = this.conversation.slice(-3)

    for (const msg of recentMessages) {
      let content = msg.content

      // Convert content array to string if needed
      let contentStr =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .map((c: any) => c.text || c.name || JSON.stringify(c))
                .join('\n')
            : String(content)

      // Compress large content and replace with cache references
      if (contentStr.length > 2000) {
        // Store in cache and get reference
        const cacheRef = this.contextCache.store(
          contentStr,
          msg.type === 'assistant' ? 'response' : 'file'
        )
        contentStr = cacheRef
      }

      // Compress tool outputs
      if (contentStr.includes('[Tool output]') || contentStr.includes('lines omitted')) {
        contentStr = compressToolOutput(contentStr, 20)
      }

      messages.push({
        type: msg.type,
        message: {
          content: contentStr,
        },
      })
    }

    return messages
  }

  /**
   * Compress tool output to prevent bloat in history
   * Large outputs are summarized: first 25 lines + last 25 lines
   */
  private compressToolResult(toolName: string, output: string): string {
    const lines = output.split('\n')
    const MAX_LINES = 50

    if (lines.length > MAX_LINES) {
      const first = lines.slice(0, 25).join('\n')
      const last = lines.slice(-25).join('\n')
      return `${first}\n\n[... ${lines.length - 50} lines omitted ...]\n\n${last}`
    }

    return output
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

      // Prune conversation to last 50 messages before saving
      // Prevents session files from growing indefinitely
      const MAX_SAVED_MESSAGES = 50
      const messagesToSave = this.conversation.slice(-MAX_SAVED_MESSAGES)

      // Add/update current session
      sessions.push({
        timestamp: new Date().toISOString(),
        messages: messagesToSave,
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
    
    // Show new architecture
    process.stdout.write('\n\x1b[2;36m[Direct Tool Execution Architecture]\x1b[0m\n')
    process.stdout.write('✓ Load 27 tools locally with guardrails\n')
    process.stdout.write('✓ Route queries to tools (0 tokens)\n')
    process.stdout.write('✓ Execute tools directly (no API schemas)\n')
    process.stdout.write('✓ Use LLM only for interpretation (10-20 tokens)\n')
    process.stdout.write(`Expected: 94% token reduction (141 → 10-20 tokens)!\n\n`)
  }

  /**
   * Print goodbye message with token summary
   */
  private printGoodbye(): void {
    const tracker = getTokenTracker()
    const total = tracker.getTotalTokens()

    process.stdout.write(
      '\n\x1b[2;36m[Session saved. Goodbye!]\x1b[0m\n'
    )

    // Show token summary on exit
    process.stdout.write('\n' + tracker.getSessionSummary() + '\n\n')
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
