/**
 * Connector text types (streaming text from MCP connectors)
 */

export type ConnectorTextBlock = {
  type: 'connector_text'
  connector_text: string
  connector_id?: string
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return (block as ConnectorTextBlock)?.type === 'connector_text'
}
