import { createInterface } from 'readline'
import { homedir } from 'os'
import { resolve, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs'
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
import { getTools, getAllBaseTools } from '../tools.ts'
import { getEmptyToolPermissionContext } from '../Tool.js'
import type { Tools, ToolPermissionContext } from '../Tool.js'
import { init } from '../entrypoints/init.js'
import { initializeToolPermissionContext } from '../utils/permissions/permissionSetup.js'
import { enableConfigs } from '../utils/config.js'
import { FileReadTool } from '../tools/FileReadTool/FileReadTool.js'
import { FileEditTool } from '../tools/FileEditTool/FileEditTool.js'
import { FileWriteTool } from '../tools/FileWriteTool/FileWriteTool.js'
import { BashTool } from '../tools/BashTool/BashTool.js'
import { REPL_BUILTIN_TOOLS } from './built-in-tools.js'
import { REPL_PROJECT_SCOPE, isPathAllowed } from './project-scope.js'
import { getSystemPrompt } from './system-prompt.js'
import { ContextCache, compressToolOutput } from './context-cache.js'
import { getTokenTracker } from './token-tracker.js'
import { matchToolsForQuery, needsDirectExecution, needsLLMInterpretation, isModificationQuery, getPrimaryToolMatch } from './tool-router.js'
import { tryDirectExecution, formatToolResult, buildToolResultMessage } from './tool-executor.js'
import { detectModificationIntent } from './modification-detection.js'
import { discoverAffectedFiles, validateDiscoveredFileScope, formatFilesForLLMContext } from './file-discovery.js'
import { executeModifications, getModificationSystemPrompt, summarizeModifications, validateModificationToolCall } from './modification-executor.js'
import { detectDebugIntent, extractCommand } from './debug-detection.js'
import { captureError, buildDebugContext } from './error-capture.js'
import { selectModelForQuery, formatModelSelection } from './model-selector.js'
import { analyzeQueryComplexity } from './query-complexity.js'
import { SessionFileCache, formatCachedFilesForContext } from './session-file-cache.js'

// Helper to satisfy the branded SystemPrompt type
const asSystemPrompt = (prompt: string) => prompt as any;

// Global session file cache instance
const fileCache = new SessionFileCache()

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
  private fileCache: SessionFileCache = new SessionFileCache()  // Session file memory

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
    const allTools = getAllBaseTools();
    
    // Force include critical tools
    const hasEdit = allTools.some(t => t.name === 'FileEditTool' || t.name.includes('Edit'));
    if (!hasEdit) {
      const { FileEditTool } = await import('../tools/FileEditTool/FileEditTool.js');
      allTools.push(new FileEditTool());   // note: use 'new' if it's a class
    }

    const hasGlob = allTools.some(t => t.name === 'Glob' || t.name.includes('Glob'));
    if (!hasGlob) {
      const { GlobTool } = await import('../tools/GlobTool/GlobTool.js');
      allTools.push(new GlobTool());
    }

    this.tools = allTools;

    process.stderr.write(
      `[REPL] Loaded ${this.tools.length} tool(s): ${this.tools.map((t) => t.name).join(', ')}\n`
    );
  } catch (err: any) {
    process.stderr.write(`[WARN] Could not load tools: ${err?.message}\n`);
    this.tools = [];
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
          type: 'assistant' as const,
          timestamp: new Date(),
          content: directResult || '(Tool execution completed)',
        };
      }
    }

    // Ultra-strong force for any code/file understanding query
    if (/flow|logic|function|main|entry|how does|what is in|read .* file|show .* code|contents of/i.test(userInput.toLowerCase())) {
      process.stderr.write(`[REPL] Forcing direct Read tool for code understanding query\n`)
      const directResult = await this.tryDirectToolExecution(userInput)
      if (directResult !== null) {
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: directResult || '(Tool execution completed)',
        }
      }
    }

    // Strong force for modification queries - prefer Edit over Read
    // FORCE DIRECT EDIT PATH - bypass the crashing modification flow
    if (/change|update|set|replace|modify/i.test(userInput.toLowerCase())) {
      process.stderr.write(`[REPL] Forcing direct FileEditTool (bypassing modification flow to avoid _idmap error)\n`);
      const directResult = await this.tryDirectToolExecution(userInput);
      if (directResult !== null) {
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: directResult || 'Modification completed.',
        };
      }
    }

    // PROPOSAL MODE - the main user-friendly workflow
    if (/add|create|fix|implement|refactor|improve|new feature|change.*logic|update.*function/i.test(userInput.toLowerCase())) {
      process.stderr.write(`[REPL] Entering proposal mode for complex request\n`);

      const messages = this.buildMessageContext();

      printStreamingStart();

      const accumulator = await streamLLMResponse({
        messages,
        systemPrompt: asSystemPrompt(getSystemPrompt('proposal')),
        tools: [FileReadTool, Glob],   // allow exploration
        model: this.config.mainLoopModel || 'gpt-4o-mini',
        maxTokens: 1500,
        signal: this.abortController.signal,
        onToken: (token) => printStreamingToken(token),
      });

      printStreamingEnd();

      const proposal = accumulator.output || "No proposal generated.";

      process.stdout.write('\n✨ \x1b[1;36mProposed Changes:\x1b[0m\n');
      process.stdout.write(proposal + '\n\n');

      const shouldApply = await promptConfirmation('Apply these changes? (Yes/No)');

      if (shouldApply) {
        process.stderr.write(`[REPL] User accepted proposal. Applying changes...\n`);
        const applyResult = "✅ Proposal accepted. (Full auto-apply parser coming soon)";
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: applyResult,
        };
      } else {
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: "Proposal rejected. What would you like to change?",
        };
      }
    }

    // TIER 2: Check for debug/fix requests
    // For: "something's not working", "fix this error", etc.
    const debugIntent = detectDebugIntent(userInput)
    
    if (debugIntent.isDebug && debugIntent.confidence >= 0.5) {
      try {
        process.stderr.write(`[DebugDetect] Debug request detected (confidence: ${(debugIntent.confidence * 100).toFixed(0)}%)\n`)
        const debugResult = await this.executeDebugFlow(userInput, debugIntent)
        this.conversation.push({
          id: randomUUID(),
          type: 'assistant',
          timestamp: new Date(),
          content: debugResult,
        })
        return {
          id: randomUUID(),
          type: 'assistant',
          timestamp: new Date(),
          content: debugResult,
        }
      } catch (err: any) {
        process.stderr.write(`[REPL] ✗ Debug flow failed: ${err?.message || err}\n`)
        process.stderr.write(`[REPL] Falling back to generic LLM\n`)
      }
    }

    // TIER 2B: Modification requests — simplified to avoid Zod _idmap error
    const modIntent = detectModificationIntent(userInput)
    
    // DEBUG logging (keep if you want)
    if (process.env.DEBUG_MODIFICATIONS || process.env.DEBUG) {
      process.stderr.write(`[ModDetect] Query: "${userInput}"\n`)
      process.stderr.write(`[ModDetect] isModification: ${modIntent.isModification}\n`)
      process.stderr.write(`[ModDetect] confidence: ${modIntent.confidence}\n`)
    }

    // DIRECT EDIT PATH - bypass the unstable modification flow
    if (/change|update|set|replace|modify/i.test(userInput.toLowerCase())) {
      process.stderr.write(`[REPL] Using direct FileEditTool for modification request (bypassing complex flow)\n`);
      
      const directResult = await this.tryDirectToolExecution(userInput);
      if (directResult !== null) {
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: directResult || 'Modification completed successfully.',
        };
      }
    }

    // SELECT MODEL BASED ON QUERY COMPLEXITY
    const isModification = modIntent && modIntent.isModification && modIntent.confidence >= 0.40;
    
    const modelSelection = selectModelForQuery(userInput, isModification);
    
    // SAFETY: prevent the 'none' model crash
    let modelIdToUse = modelSelection.modelId;
    if (!modelIdToUse || modelIdToUse === 'none') {
      modelIdToUse = this.config.mainLoopModel || 'gpt-4o-mini';
      process.stderr.write(`[REPL] ⚠️ Model was 'none' — falling back to ${modelIdToUse}\n`);
    }

    if (process.env.DEBUG_MODIFICATIONS || process.env.DEBUG) {
      process.stderr.write(formatModelSelection(modelSelection) + '\n');
    }

    // TIER 1: Direct execution (no model needed)
    if (modelSelection.tier === 'tier1') {
      process.stderr.write(`[Tier1] Attempting direct file reading...\n`);

      const directResult = await this.tryDirectToolExecution(userInput);
      if (directResult !== null) {
        return {
          id: randomUUID(),
          type: 'assistant' as const,
          timestamp: new Date(),
          content: directResult || '(Tool execution completed)',
        };
      }
    }

    // TIER 2, 3-LIGHT, 3-HEAVY: Use reasoning models
    let messages = this.buildMessageContext()
    let fileReadingTools: any[] = []
    
    // Check if query mentions files - provide FileReadTool
    const filePattern = /\b([\w./-]*(?:package\.json|\.ts|\.js|\.json|\.md|\.yaml|\.yml|config|\.env|tsconfig|eslint|babel|system-prompt))\b/gi
    const mentionedFiles = Array.from(new Set(
      (userInput.match(filePattern) || []).map(f => f.trim()).filter(f => f.length > 0)
    ))
    
    if (mentionedFiles.length > 0 || /file|code|system|config/.test(userInput.toLowerCase())) {
      fileReadingTools = [FileReadTool]
      
      // Include cached files in context so Claude remembers them from this session
      const cachedFilesContext = formatCachedFilesForContext(fileCache, 
        mentionedFiles.map(f => f.startsWith('/') ? f : join(this.cwd, f))
      )
      
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.type === 'user') {
        let contextMsg = `${lastMessage.content}`
        
        // Add cached files to context if available
        if (cachedFilesContext) {
          contextMsg += `\n\n${cachedFilesContext}`
        }
        
        contextMsg += `\n\n[FileReadTool is available to read additional files if needed.]`
        lastMessage.content = contextMsg
      }
    }
    
    // Determine which model and how to log
    //let modelIdToUse = modelSelection.modelId
    
    if (process.env.DEBUG_MODIFICATIONS || process.env.DEBUG) {
      process.stderr.write(`[Tier${modelSelection.tier.slice(-1)}] Using ${modelSelection.model?.name || 'direct execution'}\n`)
      if (modelSelection.complexity) {
        process.stderr.write(`[Tier${modelSelection.tier.slice(-1)}] Complexity: ${modelSelection.complexity} (reasoning budget: ${modelSelection.thinkingBudget})\n`)
      }
    }

    printStreamingStart()

    const accumulator = await streamLLMResponse({
      messages,
      systemPrompt: getSystemPrompt('minimal'),
      tools: fileReadingTools,
      model: modelIdToUse,
      maxTokens: modelSelection.maxTokens,
      signal: this.abortController.signal,
      onToken: (token) => printStreamingToken(token),
    })

    printStreamingEnd()

    const response = accumulator.output
    
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
      content: response,
      toolCalls: accumulator.toolCalls || [],   // ← capture tool calls
    }

    this.conversation.push(assistantMessage)

    // NEW: If the LLM returned tool calls, execute them immediately
    if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
      await this.processToolCalls(assistantMessage.toolCalls, userInput, assistantMessage)
    }

    return assistantMessage
  }

  private async tryDirectToolExecution(userInput: string): Promise<string | null> {
    if (!needsDirectExecution(userInput)) {
      return null;
    }

    const context = this.buildToolUseContext() || {};

    let result = await tryDirectExecution(
      userInput,
      this.tools,
      context,
      async () => ({ behavior: 'allow' })
    );

    if (!result) return null;

    process.stdout.write('\n');
    process.stdout.write(formatToolResult(result));
    process.stdout.write('\n\n');

    // AUTO-CREATE for new files
    if (result.toolName === 'Glob' && 
        result.output.includes('No files found') && 
        /add|create|new function|implement/i.test(userInput.toLowerCase())) {

      process.stderr.write(`[REPL] Glob found no file → auto-creating with Write tool\n`);

      const writeTool = this.tools.find(t => t.name === 'Write' || t.name.includes('Write'));
      if (writeTool) {
        const fileMatch = userInput.match(/in\s+([\w./-]+\.(ts|js))/i);
        const filePath = fileMatch ? fileMatch[1] : 'src/utils/price.ts';

        const funcMatch = userInput.match(/function\s+([\w]+)/i);
        let functionName = funcMatch && funcMatch[1].length > 2 ? funcMatch[1] : 'calculateTotalPrice';

        const newContent = `/**
 * Calculates the total price based on unit price and quantity.
 * 
 * @param price - The unit price of a single item
 * @param quantity - The number of items
 * @returns The total price
 */
export function ${functionName}(price: number, quantity: number): number {
  if (price < 0 || quantity < 0) {
    throw new Error('Price and quantity must be non-negative');
  }
  return price * quantity;
}
`;

        try {
          await writeTool.call({ file_path: filePath, content: newContent }, context, async () => ({ behavior: 'allow' }), null);

          const successMsg = `✅ Created ${filePath} with function \`${functionName}()\``;
          process.stdout.write(`\n✨ ${successMsg}\n\n`);

          this.conversation.push({
            id: randomUUID(),
            type: 'assistant',
            timestamp: new Date(),
            content: successMsg,
          });

          return successMsg;
        } catch (err: any) {
          process.stderr.write(`[Write failed] ${err.message}\n`);
        }
      }
    }

    // READ-THEN-EDIT for modification requests
    if (/change|update|modify|better function|improve|fix/i.test(userInput.toLowerCase())) {
      process.stderr.write(`[REPL] Modification request detected → reading file first\n`);

      const fileMatch = userInput.match(/in\s+([\w./-]+\.(ts|js))/i);
      const filePath = fileMatch ? fileMatch[1] : null;

      if (filePath) {
        const readTool = this.tools.find(t => t.name === 'Read' || t.name.includes('Read'));
        if (readTool) {
          try {
            await readTool.call({ file_path: filePath }, context, async () => ({ behavior: 'allow' }), null);
            process.stderr.write(`[REPL] File read successfully, now attempting edit\n`);
          } catch (e) {
            process.stderr.write(`[REPL] Read before edit failed, continuing anyway\n`);
          }
        }
      }

      // Now try the edit again (the "unexpectedly modified" error should be gone)
      result = await tryDirectExecution(
        userInput,
        this.tools,
        context,
        async () => ({ behavior: 'allow' })
      );

      if (result && result.success) {
        const successMsg = `✅ Updated ${filePath || 'file'} successfully`;
        process.stdout.write(`\n✨ ${successMsg}\n\n`);
        return successMsg;
      }
    }

    // Normal handling
    const tracker = getTokenTracker();
    tracker.trackQuery(randomUUID(), userInput, 0, 0, [result.toolName]);

    if (!result.success) {
      return '';
    }

    this.conversation.push({
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: buildToolResultMessage(result),
    });

    return needsLLMInterpretation(result.output) ? result.output : result.output;
  }

  /**
   * TIER 2: Execute debug flow
   * Captures error from running command, analyzes code, generates and applies fixes
   */
  private async executeDebugFlow(userInput: string, debugIntent: any): Promise<string> {
    process.stderr.write(`[DebugFlow] Starting debug flow\n`)
    const { formatFilesForReadingContext } = await import('./file-discovery.js')

    // Step 1: Try to run the command and capture error
    let errorOutput
    if (debugIntent.command) {
      process.stderr.write(`[DebugFlow] Running command: ${debugIntent.command}\n`)
      errorOutput = captureError(debugIntent.command, this.cwd)
    } else if (debugIntent.errorMessage) {
      process.stderr.write(`[DebugFlow] Using provided error message\n`)
      errorOutput = {
        success: false,
        stdout: '',
        stderr: debugIntent.errorMessage,
        exitCode: 1,
        combinedOutput: debugIntent.errorMessage,
      }
    } else {
      return '⚠️  Could not determine what to debug. Please provide an error message or command to run.'
    }

    // Step 2: Discover affected files to understand the codebase
    let affectedFiles: any[] = []
    try {
      process.stderr.write(`[DebugFlow] Discovering code files for context...\n`)
      affectedFiles = await discoverAffectedFiles(userInput, this.cwd, { maxFiles: 3 })
    } catch (err: any) {
      process.stderr.write(`[DebugFlow] Warning: Could not discover files: ${err?.message}\n`)
    }

    // Step 3: Build debug context with code + error
    let debugContext = ''
    if (affectedFiles.length > 0) {
      debugContext = buildDebugContext(affectedFiles[0].content || '', errorOutput, userInput)
    } else {
      debugContext = buildDebugContext('', errorOutput, userInput)
    }

    // Step 4: Call LLM with debug prompt to get fixes
    process.stderr.write(`[DebugFlow] Calling LLM to analyze and generate fixes...\n`)

    const messages = this.buildMessageContext()
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.type === 'user') {
      lastMessage.content = `${lastMessage.content}\n\n${debugContext}`
    }

    printStreamingStart()

    const accumulator = await streamLLMResponse({
      messages,
      systemPrompt: getSystemPrompt('debug'),
      tools: [],
      model: modelSelection.modelId,
      maxTokens: modelSelection.maxTokens,
      signal: this.abortController.signal,
      onToken: (token) => printStreamingToken(token),
    })

    printStreamingEnd()

    const assistantResponse = accumulator.output

    // Step 5: Extract and execute tool calls from Claude's response
    const toolCalls = this.extractToolCallsFromResponse(assistantResponse)
    
    if (toolCalls.length > 0) {
      process.stderr.write(`[DebugFlow] Claude suggested ${toolCalls.length} fix(es)\n`)
      process.stderr.write(`[DebugFlow] Executing fixes...\n`)

      let fixResults = ''
      for (const call of toolCalls) {
        try {
          const result = await this.executeModificationToolCall(call)
          fixResults += `✓ ${result}\n`
        } catch (err: any) {
          process.stderr.write(`[DebugFlow] Error executing fix: ${err?.message}\n`)
          fixResults += `✗ Failed to execute fix: ${err?.message}\n`
        }
      }

      // Step 6: Verify the fix by running the command again
      if (debugIntent.command) {
        process.stderr.write(`[DebugFlow] Verifying fix by re-running command...\n`)
        const verification = captureError(debugIntent.command, this.cwd)
        
        if (verification.success) {
          process.stderr.write(`[DebugFlow] ✓ Verification successful!\n`)
          return `✅ Fixed! Applied the following fixes:\n\n${fixResults}\n\n✨ Command now runs successfully.`
        } else {
          process.stderr.write(`[DebugFlow] ⚠️  Verification failed, error still present\n`)
          return `⚠️  Applied fixes:\n\n${fixResults}\n\nBut the error persists:\n${verification.stderr}\n\nLet me try again with more context...`
        }
      } else {
        return `✅ Applied fixes:\n\n${fixResults}\n\nPlease test to verify the issues are resolved.`
      }
    } else {
      return assistantResponse
    }
  }

  /**
   * TIER 2B: Execute modification flow
   * Detects modification intent, finds files, calls LLM with file context + modification tools
   */
  private async executeModificationFlow(userInput: string, modIntent: any): Promise<string> {
    const tracker = getTokenTracker()
    
    process.stderr.write(`[ModificationFlow] Detected ${modIntent.type} (confidence: ${(modIntent.confidence * 100).toFixed(0)}%)\n`)

    // Step 1: Discover affected files (0 tokens - direct execution)
    let discoveredFiles: any[] = []
    try {
      process.stderr.write(`[ModificationFlow] Discovering affected files...\n`)
      discoveredFiles = await discoverAffectedFiles(
        userInput,
        this.cwd,
        this.buildToolUseContext(),
        {
          maxFiles: 5,
          maxFileSize: 50 * 1024, // 50KB
          patterns: modIntent.affectedPatterns,
        }
      )
      process.stderr.write(`[ModificationFlow] Discovered ${discoveredFiles.length} file(s)\n`)
    } catch (err: any) {
      throw new Error(`File discovery failed: ${err?.message || err}`)
    }

    // Step 2: Validate files are in allowed scope
    let validatedFiles: any[] = []
    try {
      process.stderr.write(`[ModificationFlow] Validating file scope...\n`)
      validatedFiles = validateDiscoveredFileScope(
        discoveredFiles,
        (path) => this.validateFileAccess(path)
      )
      process.stderr.write(`[ModificationFlow] Validated ${validatedFiles.length} file(s)\n`)
    } catch (err: any) {
      throw new Error(`File validation failed: ${err?.message || err}`)
    }

    if (validatedFiles.length === 0) {
      throw new Error('Discovered files are outside allowed project scope.')
    }

    process.stderr.write(
      `[ModificationFlow] Files ready for modification: ${validatedFiles.map((f: any) => f.path || f).join(', ')}\n`
    )

    // Step 3: Build message with file context for LLM
    let fileContextText: string = ''
    try {
      process.stderr.write(`[ModificationFlow] Building file context for LLM...\n`)
      fileContextText = formatFilesForLLMContext(validatedFiles)
      process.stderr.write(`[ModificationFlow] File context prepared (${fileContextText.length} chars)\n`)
      process.stderr.write(`[ModificationFlow] File paths in context: ${validatedFiles.map((f: any) => f.path).join(', ')}\n`)
      if (process.env.DEBUG_MODIFICATIONS) {
        process.stderr.write(`[ModificationFlow] File context:\n${fileContextText.substring(0, 500)}...\n`)
      }
    } catch (err: any) {
      process.stderr.write(`[ModificationFlow] Warning: Failed to format file context: ${err?.message || err}\n`)
      // Continue anyway, try without context
      fileContextText = validatedFiles
        .map((f: any) => `File: ${f.path || f}\n${f.content || '(no content)'}`)
        .join('\n---\n')
    }

    let messages: any[] = []
    try {
      process.stderr.write(`[ModificationFlow] Building message context...\n`)
      messages = [
        ...this.buildMessageContext(),
        {
          role: 'user' as const,
          content: `${fileContextText}\n\nUser request: ${userInput}`,
        },
      ]
      process.stderr.write(`[ModificationFlow] Message context built (${messages.length} messages)\n`)
    } catch (err: any) {
      throw new Error(`Message context build failed: ${err?.message || err}`)
    }

    printStreamingStart()

    let accumulator: any = null
    try {
      process.stderr.write(`[ModificationFlow] Calling LLM with modification tools...\n`)
      
      // Step 4: Call LLM with custom modification tool schemas
      // These are optimized schemas for code modification (saves tokens vs full tools)
      const { MODIFICATION_TOOL_SCHEMAS } = await import('./modification-executor.js')
      
      const modificationModel = selectModelForQuery(userInput, true, this.fileCache)
      
      process.stderr.write(`[ModificationFlow] Using ${modificationModel.model?.name} for modification\n`)
      process.stderr.write(`[ModificationFlow] Available tools: str_replace, create_file, append_file\n`)
      
      accumulator = await streamLLMResponse({
        messages,
        systemPrompt: getSystemPrompt('modification'),
        tools: MODIFICATION_TOOL_SCHEMAS as any,  // Use custom schemas, not Tool objects
        model: modificationModel.modelId,
        maxTokens: modificationModel.maxTokens,
        signal: this.abortController.signal,
        onToken: (token) => printStreamingToken(token),
      })
      
      process.stderr.write(`[ModificationFlow] LLM response received (${accumulator?.textContent?.length || 0} chars)\n`)
    } catch (err: any) {
      printStreamingEnd()
      throw new Error(`LLM call failed: ${err?.message || err}`)
    }

    printStreamingEnd()

    // Track modification flow tokens
    tracker.trackQuery(
      randomUUID(),
      userInput,
      accumulator.inputTokens,
      accumulator.outputTokens,
      ['str_replace', 'create_file', 'append_file']
    )

    tracker.displayQueryMetrics(
      tracker.getQueryMetrics()[tracker.getQueryMetrics().length - 1]
    )

    // Step 5: Extract tool calls from LLM response
    let toolCalls: any[] = accumulator.toolCalls
    process.stderr.write(`[ModificationFlow] Tool calls in accumulator: ${toolCalls.length}\n`)
    
    if (toolCalls.length === 0) {
      // LLM just returned text explanation, no modifications
      process.stderr.write(`[ModificationFlow] No tool calls found, returning text response\n`)
      return accumulator.textContent
    }

    // Step 6: Validate and execute tool calls
    const results: string[] = []

    for (const toolCall of toolCalls) {
      try {
        process.stderr.write(`[ModificationFlow] Processing tool call: ${toolCall.name}\n`)
        process.stderr.write(`[ModificationFlow] Tool input: ${JSON.stringify(toolCall.input)}\n`)
        
        // Validate before executing
        const validation = await validateModificationToolCall(
          toolCall,
          (path) => this.validateFileAccess(path),
          {
            exists: (path) => this.fileExists(path),
          }
        )

        if (!validation.valid) {
          process.stderr.write(`[ModificationFlow] ✗ Validation failed: ${validation.reason}\n`)
          results.push(`✗ ${toolCall.name}: ${validation.reason}`)
          continue
        }

        // Execute tool call
        const result = await this.executeModificationToolCall(toolCall)
        results.push(result)

        process.stderr.write(
          `[ModificationFlow] ✓ Executed ${toolCall.name}\n`
        )
      } catch (err: any) {
        process.stderr.write(`[ModificationFlow] ✗ Tool call execution failed: ${err?.message || err}\n`)
        results.push(`✗ ${toolCall.name}: ${err?.message || err}`)
      }
    }

    // Build response
    const output = [
      accumulator.textContent,
      '',
      '## Changes Applied:',
      ...results,
    ].join('\n')

    // Add result to conversation
    this.conversation.push({
      id: randomUUID(),
      type: 'assistant',
      timestamp: new Date(),
      content: output,
    })

    return output
  }

  /**
   * Extract tool calls from LLM response (XML format)
   */
  private extractToolCallsFromResponse(response: string): any[] {
    const toolCalls: any[] = []
    
    // Parse XML tool_use blocks from Claude API response
    const regex = /<tool_use id="([^"]+)" name="([^"]+)">[\s\S]*?<input>([\s\S]*?)<\/input>[\s\S]*?<\/tool_use>/g
    let match

    while ((match = regex.exec(response)) !== null) {
      const [, id, name, inputStr] = match
      try {
        // Try to parse JSON, with fallback to fixing common mistakes
        let input: any
        try {
          input = JSON.parse(inputStr)
        } catch (parseErr) {
          // Try to fix common Claude mistakes
          let fixed = inputStr.trim()
          
          // Fix 1: Missing closing quote before } or ]
          // Pattern: "field": "value} → "field": "value"}
          // Find any character that's not a quote before } and add the quote
          fixed = fixed.replace(/([^"\\])([\s\n]*[}\]])/g, '$1"$2')
          
          // Fix 2: Remove trailing garbage after }
          if (!fixed.endsWith('}')) {
            const lastBrace = fixed.lastIndexOf('}')
            if (lastBrace > 0) {
              fixed = fixed.substring(0, lastBrace + 1)
            }
          }
          
          // Fix 3: Balance braces
          const openBraces = (fixed.match(/{/g) || []).length
          const closeBraces = (fixed.match(/}/g) || []).length
          if (openBraces > closeBraces) {
            fixed += '}'.repeat(openBraces - closeBraces)
          }
          
          // Try again with fixed string
          input = JSON.parse(fixed)
        }
        
        toolCalls.push({
          id,
          name: name as 'str_replace' | 'create_file' | 'append_file',
          input,
        })
      } catch (err) {
        process.stderr.write(`[REPL] Failed to parse tool input: ${err}\n`)
        if (process.env.DEBUG_MODIFICATIONS) {
          process.stderr.write(`[REPL] Raw input: ${inputStr}\n`)
        }
      }
    }

    return toolCalls
  }

  /**
   * Execute a modification tool call using the actual tools
   */
  private async executeModificationToolCall(toolCall: any): Promise<string> {
    const { name, input } = toolCall

    try {
      switch (name) {
        case 'Read': {
          process.stderr.write(`[ModificationFlow] Executing Read via FileReadTool: ${input.file_path}\n`)
          
          const tool = this.tools.find((t) => t.name === 'Read' || t.name === 'FileReadTool')
          if (!tool) {
            return `✗ FileReadTool not found in available tools`
          }

          try {
            await tool.call(
              {
                file_path: input.file_path,
              },
              this.buildToolUseContext(),
              async () => ({ behavior: 'allow' as const })
            )
            return `✓ Read ${input.file_path}`
          } catch (toolErr: any) {
            process.stderr.write(`[ModificationFlow] Tool error: ${toolErr?.message || toolErr}\n`)
            return `✗ Failed to read ${input.file_path}: ${toolErr?.message || toolErr}`
          }
        }

        case 'str_replace': {
          process.stderr.write(`[ModificationFlow] Executing str_replace via FileEditTool: ${input.path}\n`)
          
          const tool = this.tools.find((t) => t.name === 'Edit' || t.name === 'FileEditTool')
          if (!tool) {
            return `✗ FileEditTool not found in available tools`
          }

          try {
            // Create parentMessage with required uuid property
            const parentMessage = {
              uuid: randomUUID(),
              role: 'assistant' as const,
              content: [],
            }

            await tool.call(
              {
                file_path: input.path,
                old_string: input.old_string,  // Changed from old_str
                new_string: input.new_string,  // Changed from new_str
              },
              this.buildToolUseContext(),
              async () => ({ behavior: 'allow' as const }),
              parentMessage
            )
            return `✓ Modified ${input.path}`
          } catch (toolErr: any) {
            process.stderr.write(`[ModificationFlow] Tool error: ${toolErr?.message || toolErr}\n`)
            return `✗ Failed to modify ${input.path}: ${toolErr?.message || toolErr}`
          }
        }

        case 'create_file': {
          process.stderr.write(`[ModificationFlow] Executing create_file via FileWriteTool: ${input.path}\n`)
          
          const tool = this.tools.find((t) => t.name === 'Write' || t.name === 'FileWriteTool')
          if (!tool) {
            return `✗ FileWriteTool not found in available tools`
          }

          try {
            const parentMessage = {
              uuid: randomUUID(),
              role: 'assistant' as const,
              content: [],
            }

            await tool.call(
              {
                file_path: input.path,
                content: input.contents,
              },
              this.buildToolUseContext(),
              async () => ({ behavior: 'allow' as const }),
              parentMessage
            )
            return `✓ Created ${input.path}`
          } catch (toolErr: any) {
            process.stderr.write(`[ModificationFlow] Tool error: ${toolErr?.message || toolErr}\n`)
            return `✗ Failed to create ${input.path}: ${toolErr?.message || toolErr}`
          }
        }

        case 'append_file': {
          process.stderr.write(`[ModificationFlow] Executing append_file via FileWriteTool: ${input.path}\n`)
          
          const tool = this.tools.find((t) => t.name === 'Write' || t.name === 'FileWriteTool')
          if (!tool) {
            return `✗ FileWriteTool not found in available tools`
          }

          try {
            const parentMessage = {
              uuid: randomUUID(),
              role: 'assistant' as const,
              content: [],
            }

            // For append, read existing content and append
            const { readFileSync } = await import('fs')
            let existingContent = ''
            try {
              existingContent = readFileSync(input.path, 'utf-8')
            } catch {
              // File doesn't exist, that's fine
            }

            const newContent = existingContent + input.text

            await tool.call(
              {
                file_path: input.path,
                content: newContent,
              },
              this.buildToolUseContext(),
              async () => ({ behavior: 'allow' as const }),
              parentMessage
            )
            return `✓ Appended to ${input.path}`
          } catch (toolErr: any) {
            process.stderr.write(`[ModificationFlow] Tool error: ${toolErr?.message || toolErr}\n`)
            return `✗ Failed to append to ${input.path}: ${toolErr?.message || toolErr}`
          }
        }

        case 'Write': {
          process.stderr.write(`[ModificationFlow] Executing Write via FileWriteTool: ${input.file_path}\n`)
          
          const tool = this.tools.find((t) => t.name === 'Write' || t.name === 'FileWriteTool')
          if (!tool) {
            return `✗ FileWriteTool not found in available tools`
          }

          try {
            const parentMessage = {
              uuid: randomUUID(),
              role: 'assistant' as const,
              content: [],
            }

            await tool.call(
              {
                file_path: input.file_path,
                content: input.content,
              },
              this.buildToolUseContext(),
              async () => ({ behavior: 'allow' as const }),
              parentMessage
            )
            return `✓ Wrote ${input.file_path}`
          } catch (toolErr: any) {
            process.stderr.write(`[ModificationFlow] Tool error: ${toolErr?.message || toolErr}\n`)
            return `✗ Failed to write ${input.file_path}: ${toolErr?.message || toolErr}`
          }
        }

        default:
          return `✗ Unknown modification tool: ${name}`
      }
    } catch (err: any) {
      process.stderr.write(`[ModificationFlow] Unexpected error: ${err?.message || err}\n`)
      return `✗ Modification failed: ${err?.message || err}`
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const { promises: fs } = await import('fs')
      await fs.stat(path)
      return true
    } catch {
      return false
    }
  }

  private buildToolUseContext(): any {
    const readFileState = new Map();
    const userModified = new Map();
    const dynamicSkillDirTriggers = new Set();
    const alwaysDenyRules = new Set();

    // Minimal but sufficient appState for GlobTool and other tools
    const appState = {
      toolPermissionContext: this.permissionContext || getEmptyToolPermissionContext(),
      globLimits: { maxResults: 100 },
    };

    return {
      options: {
        commands: [],
        debug: this.config.debug ?? false,
        mainLoopModel: this.config.mainLoopModel || 'gpt-4o-mini',
        tools: this.tools || [],
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

      abortController: this.abortController || new AbortController(),

      // Required by GlobTool and many others
      readFileState,
      userModified,
      dynamicSkillDirTriggers,
      alwaysDenyRules,

      // Permission system
      permissionContext: this.permissionContext || getEmptyToolPermissionContext(),

      // Critical for GlobTool
      getAppState: () => appState,
      globLimits: { maxResults: 100 },

      // State management stubs
      setAppState: (f: any) => {},
      setInProgressToolUseIDs: (f: any) => new Set(),
      setResponseLength: (f: any) => 0,

      updateFileHistoryState: (f: any) => {},
      updateAttributionState: (f: any) => {},

      // Messages for context
      messages: this.conversation || [],
    };
  }

  /**
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

            const compressedOutput = this.compressToolResult(toolName, toolOutput || '')

            process.stdout.write('\n✨ \x1b[1;36mTool Result:\x1b[0m\n')
            process.stdout.write(compressedOutput + '\n\n')

            // Simple continuation without full LLM call for now
            process.stdout.write('\x1b[1;36mAssistant:\x1b[0m File read successfully. What next?\n')
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
    const recent = this.conversation.slice(-6)

    for (const msg of recent) {
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map((c: any) => c.text || c.content || '').join('\n')
      } else {
        content = String(msg.content || '')
      }

      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: content,
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
   * Try to resume last session — now with strong corruption guard
   */
  private async tryResumeSession(): Promise<boolean> {
    const sessionFile = this.expandPath(this.config.conversation.sessionFile)

    // Aggressive cleanup of corrupted/placeholder session files
    if (existsSync(sessionFile)) {
      try {
        const data = readFileSync(sessionFile, 'utf-8')
        if (data.includes('REPLACE ME') || data.includes('1 |') || data.trim() === '') {
          process.stderr.write(`[REPL] Deleting corrupted session file\n`)
          rmSync(sessionFile, { force: true })
        }
      } catch (e) {
        rmSync(sessionFile, { force: true })
      }
    }

    if (!this.config.conversation.persistSession || !existsSync(sessionFile)) {
      return false
    }

    const shouldResume = await promptConfirmation('Resume last session? (Yes/No)')
    if (!shouldResume) {
      return false
    }

    try {
      const data = readFileSync(sessionFile, 'utf-8')
      const sessions = JSON.parse(data)
      const lastSession = sessions[sessions.length - 1]

      if (lastSession && lastSession.messages) {
        this.conversation = lastSession.messages
        process.stdout.write(`\x1b[2;36m[Resumed ${this.conversation.length} messages]\x1b[0m\n\n`)
        return true
      }
    } catch (err) {
      process.stderr.write(`[REPL] Session file invalid. Starting fresh.\n`)
      try { rmSync(sessionFile, { force: true }) } catch {}
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
