export type RuntimeConfig = {
  model: string
  maxTokens?: number
  tools?: unknown[]
}
export type RuntimeContext = {
  sessionId: string
  agentId?: string
}

export type EffortLevel = 'low' | 'medium' | 'high' | 'max' | 'auto'
