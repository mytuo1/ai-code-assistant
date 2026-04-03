export type MessageQueueItem = {
  id: string
  content: unknown
  priority: number
  timestamp: number
}
export type MessageQueueState = {
  items: MessageQueueItem[]
  processing: boolean
}
