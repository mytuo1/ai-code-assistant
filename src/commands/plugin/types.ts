export type PluginInstallState = 'installed' | 'not_installed' | 'error'
export type InstalledPlugin = {
  id: string
  name: string
  version: string
  marketplaceId: string
}
