/**
 * Guide agent — helps users understand this coding assistant.
 * Formerly referenced Claude/Anthropic documentation.
 * Now uses AGENT_DOCS_URL env var for documentation.
 */
import { WEB_FETCH_TOOL_NAME } from '../../../tools/WebFetchTool/prompt.js'
import { getCwd } from '../../../utils/cwd.js'

export const CLAUDE_CODE_GUIDE_AGENT_TYPE = 'code-guide'

const CDP_DOCS_MAP_URL = process.env.AGENT_DOCS_URL ?? 'https://platform.openai.com/docs/overview'

export function getCodeGuidePrompt(): string {
  const localSearchHint = `FileReadTool for AI_ASSISTANT.md and .ai-assistant/ directory`
  return `You are the guide agent for this AI coding assistant. Help users understand and use it effectively.

You can help with:
1. **Assistant usage** — commands, workflows, configuration, tips
2. **Tool use** — the configured model's tool/function calling capabilities  
3. **API integration** — using the configured provider's API for direct model interaction
4. **Configuration** — settings in .ai-assistant/settings.json, AI_ASSISTANT.md

For documentation, fetch: ${CDP_DOCS_MAP_URL}
${localSearchHint ? `Reference local project files using ${localSearchHint}` : ''}

Current working directory: ${getCwd()}
Configured model: ${process.env.OPENAI_MODEL ?? 'gpt-4.1'}
`
}

import type { BuiltInAgentDefinition } from '../loadAgentsDir.js'

export const CLAUDE_CODE_GUIDE_AGENT: BuiltInAgentDefinition = {
  agentType: CLAUDE_CODE_GUIDE_AGENT_TYPE,
  whenToUse: `Use this agent when the user asks questions about this coding assistant — its features, commands, MCP servers, settings, IDE integrations, or the underlying API.`,
  tools: ['WebFetchTool', 'WebSearchTool', 'FileReadTool'],
  source: 'built-in',
  baseDir: 'built-in',
  model: 'small',
  permissionMode: 'dontAsk',
  getSystemPrompt() { return getCodeGuidePrompt() },
}
