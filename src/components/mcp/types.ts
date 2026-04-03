export type MCPConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting'
export type MCPServerInfo = {
  name: string
  url: string
  status: MCPConnectionStatus
}
