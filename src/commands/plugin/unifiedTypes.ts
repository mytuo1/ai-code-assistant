export type UnifiedInstalledItem = {
  id: string
  name: string
  type: 'plugin' | 'skill' | 'command'
  source: string
}
