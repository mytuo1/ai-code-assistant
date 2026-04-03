export type NotebookCell = {
  id: string
  type: 'code' | 'markdown'
  content: string
  outputs?: unknown[]
}
export type Notebook = {
  cells: NotebookCell[]
  metadata?: Record<string, unknown>
}
