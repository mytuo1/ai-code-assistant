export type StdoutMessage = {
  type: string
  data?: unknown
}
export type SDKControlResponse = {
  type: string
  data?: unknown
}
export type ControlMessage = StdoutMessage | SDKControlResponse

export type SDKControlRequest = { type: string; [k: string]: unknown }
export type SDKControlInitializeRequest = { type: 'initialize'; sessionId: string }
export type SDKControlInitializeResponse = { type: 'initialize_response'; ok: boolean }
export type SDKControlMcpSetServersResponse = { type: 'mcp_set_servers_response'; ok: boolean }
export type SDKControlReloadPluginsResponse = { type: 'reload_plugins_response'; ok: boolean }
export type SDKPartialAssistantMessage = { type: 'partial_assistant_message'; content: string }
export type StdinMessage = { type: 'stdin'; content: string }
