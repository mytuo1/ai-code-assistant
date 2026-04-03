/**
 * Tool progress and result types
 */

export type BashProgress = {
  type: 'bash_progress'
  command: string
  output: string
  exitCode?: number
}

export type ShellProgress = BashProgress

export type MCPProgress = {
  type: 'mcp_progress'
  serverName: string
  toolName: string
  status: 'running' | 'done' | 'error'
  result?: unknown
}

export type REPLToolProgress = {
  type: 'repl_progress'
  output: string
}

export type SkillToolProgress = {
  type: 'skill_progress'
  skillName: string
  status: string
}

export type AgentToolProgress = {
  type: 'agent_progress'
  agentId: string
  status: string
  output?: string
}

export type TaskOutputProgress = {
  type: 'task_output_progress'
  output: string
}

export type WebSearchProgress = {
  type: 'web_search_progress'
  query: string
  status: 'searching' | 'done'
  resultCount?: number
}

export type HookProgress = {
  type: 'hook_progress'
  hookType: string
  status: string
}

export type SdkWorkflowProgress = {
  type: 'sdk_workflow_progress'
  workflowId: string
  step: string
  status: string
}

export type ToolProgressData =
  | BashProgress
  | ShellProgress
  | MCPProgress
  | REPLToolProgress
  | SkillToolProgress
  | AgentToolProgress
  | TaskOutputProgress
  | WebSearchProgress
  | HookProgress
  | SdkWorkflowProgress
