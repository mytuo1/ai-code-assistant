export type FileSuggestion = {
  path: string
  score: number
  type: 'file' | 'directory'
}
