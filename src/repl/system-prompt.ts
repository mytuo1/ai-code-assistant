/**
 * Optimized System Prompt - No tool schemas needed anymore
 * Ultra-minimal since tools execute locally
 */

export const ULTRA_MINIMAL_SYSTEM_PROMPT = `You are a code assistant. Help users with programming tasks. Be concise.`

export const MINIMAL_SYSTEM_PROMPT = `You are a code assistant. You can:
- Read and write files
- Execute bash commands
- Search the web
- Analyze code

Be concise. Think step by step.`

export const DETAILED_SYSTEM_PROMPT = `You are an AI code assistant with expertise in software development. 
Your role is to help users write, understand, and maintain code.
You have access to 27 tools for file operations, shell commands, web searches, and more.
Help users accomplish their programming goals efficiently and safely.`

export function getSystemPrompt(optimized: 'ultra' | 'minimal' | 'detailed' = 'minimal'): string {
  switch (optimized) {
    case 'ultra':
      return ULTRA_MINIMAL_SYSTEM_PROMPT
    case 'minimal':
      return MINIMAL_SYSTEM_PROMPT
    case 'detailed':
      return DETAILED_SYSTEM_PROMPT
    default:
      return MINIMAL_SYSTEM_PROMPT
  }
}

export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

export function getPromptTokenEstimate(promptLevel: 'ultra' | 'minimal' | 'detailed'): number {
  const prompt = getSystemPrompt(promptLevel)
  return estimateTokens(prompt)
}
