export type KeyBinding = {
  key: string
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  description?: string
}
export type KeyMap = Record<string, KeyBinding>
