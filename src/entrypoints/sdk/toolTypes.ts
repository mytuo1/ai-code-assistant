export type ToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}
export type ToolResult = {
  toolUseId: string
  content: string | unknown[]
  isError?: boolean
}
